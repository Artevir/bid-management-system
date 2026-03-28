/**
 * 回收站服务
 * 提供资源的软删除、恢复、物理删除等功能
 */

import { db } from '@/db';
import {
  recycleBin,
  deletionReminders,
  bidDocuments,
  bidChapters,
  files,
  companies,
  companyFiles,
  projects,
  users,
} from '@/db/schema';
import { eq, and, desc, inArray, lte, gte, isNull, sql } from 'drizzle-orm';

// 回收站保留天数
const RECYCLE_BIN_RETENTION_DAYS = 30;

// 提醒时间点（天）
const REMINDER_DAYS = {
  seven_days: 7,
  one_day: 1,
};

// ============================================
// 类型定义
// ============================================

export type ResourceType = 'document' | 'chapter' | 'file' | 'company' | 'company_file' | 'project';

export interface RecycleBinListParams {
  resourceType?: ResourceType;
  keyword?: string;
  deletedBy?: number;
  projectId?: number;
  companyId?: number;
  page?: number;
  pageSize?: number;
}

export interface MoveToRecycleBinParams {
  resourceType: ResourceType;
  resourceId: number;
  deletedBy: number;
  deleteReason?: string;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  resourceId?: number;
}

// ============================================
// 核心服务函数
// ============================================

/**
 * 移动资源到回收站（软删除）
 */
export async function moveToRecycleBin(
  params: MoveToRecycleBinParams
): Promise<{ success: boolean; recycleBinId?: number; message: string }> {
  const { resourceType, resourceId, deletedBy, deleteReason } = params;

  try {
    // 获取资源数据
    const resourceData = await getResourceData(resourceType, resourceId);
    if (!resourceData) {
      return { success: false, message: '资源不存在' };
    }

    // 检查是否已在回收站
    const existingItem = await db
      .select()
      .from(recycleBin)
      .where(
        and(
          eq(recycleBin.resourceType, resourceType),
          eq(recycleBin.resourceId, resourceId),
          isNull(recycleBin.restoredAt)
        )
      )
      .limit(1);

    if (existingItem.length > 0) {
      return { success: false, message: '资源已在回收站中' };
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RECYCLE_BIN_RETENTION_DAYS);

    // 插入回收站记录
    const [recycleBinItem] = await db
      .insert(recycleBin)
      .values({
        resourceType,
        resourceId,
        resourceName: resourceData.name,
        resourceData: JSON.stringify(resourceData.data),
        projectId: resourceData.projectId,
        companyId: resourceData.companyId,
        deletedBy,
        deleteReason,
        expiresAt,
      })
      .returning();

    // 创建提醒记录
    await createDeletionReminders(recycleBinItem.id, deletedBy, expiresAt);

    // 标记原资源为已删除（软删除）
    await softDeleteResource(resourceType, resourceId);

    return {
      success: true,
      recycleBinId: recycleBinItem.id,
      message: '已移至回收站',
    };
  } catch (error) {
    console.error('Move to recycle bin error:', error);
    return { success: false, message: '移至回收站失败' };
  }
}

/**
 * 从回收站恢复资源
 */
export async function restoreFromRecycleBin(
  recycleBinId: number,
  restoredBy: number
): Promise<RestoreResult> {
  try {
    // 获取回收站记录
    const [recycleBinItem] = await db
      .select()
      .from(recycleBin)
      .where(eq(recycleBin.id, recycleBinId))
      .limit(1);

    if (!recycleBinItem) {
      return { success: false, message: '回收站记录不存在' };
    }

    if (recycleBinItem.restoredAt) {
      return { success: false, message: '资源已被恢复' };
    }

    // 恢复原始数据
    const restoreResult = await restoreResourceData(
      recycleBinItem.resourceType,
      recycleBinItem.resourceId,
      JSON.parse(recycleBinItem.resourceData)
    );

    if (!restoreResult.success) {
      return { success: false, message: restoreResult.message };
    }

    // 更新回收站记录
    await db
      .update(recycleBin)
      .set({
        restoredAt: new Date(),
        restoredBy,
        updatedAt: new Date(),
      })
      .where(eq(recycleBin.id, recycleBinId));

    // 删除相关的提醒记录
    await db
      .delete(deletionReminders)
      .where(eq(deletionReminders.recycleBinId, recycleBinId));

    return {
      success: true,
      message: '资源已恢复',
      resourceId: recycleBinItem.resourceId,
    };
  } catch (error) {
    console.error('Restore from recycle bin error:', error);
    return { success: false, message: '恢复失败' };
  }
}

/**
 * 物理删除资源（从回收站彻底删除）
 */
export async function permanentDelete(
  recycleBinId: number,
  deletedBy: number
): Promise<{ success: boolean; message: string }> {
  try {
    // 获取回收站记录
    const [recycleBinItem] = await db
      .select()
      .from(recycleBin)
      .where(eq(recycleBin.id, recycleBinId))
      .limit(1);

    if (!recycleBinItem) {
      return { success: false, message: '回收站记录不存在' };
    }

    // 物理删除原始资源
    await physicalDeleteResource(
      recycleBinItem.resourceType,
      recycleBinItem.resourceId
    );

    // 删除提醒记录
    await db
      .delete(deletionReminders)
      .where(eq(deletionReminders.recycleBinId, recycleBinId));

    // 删除回收站记录
    await db.delete(recycleBin).where(eq(recycleBin.id, recycleBinId));

    return { success: true, message: '资源已永久删除' };
  } catch (error) {
    console.error('Permanent delete error:', error);
    return { success: false, message: '永久删除失败' };
  }
}

/**
 * 获取回收站列表
 */
export async function getRecycleBinList(
  params: RecycleBinListParams
): Promise<{
  data: Array<{
    id: number;
    resourceType: ResourceType;
    resourceId: number;
    resourceName: string;
    deletedBy: { id: number; realName: string };
    deletedAt: Date;
    expiresAt: Date;
    deleteReason: string | null;
    projectId: number | null;
    companyId: number | null;
    daysUntilExpiry: number;
  }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const {
    resourceType,
    keyword,
    deletedBy,
    projectId,
    companyId,
    page = 1,
    pageSize = 20,
  } = params;

  // 构建查询条件
  const conditions = [isNull(recycleBin.restoredAt)]; // 只显示未恢复的

  if (resourceType) {
    conditions.push(eq(recycleBin.resourceType, resourceType));
  }

  if (deletedBy) {
    conditions.push(eq(recycleBin.deletedBy, deletedBy));
  }

  if (projectId) {
    conditions.push(eq(recycleBin.projectId, projectId));
  }

  if (companyId) {
    conditions.push(eq(recycleBin.companyId, companyId));
  }

  // 查询总数
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(recycleBin)
    .where(and(...conditions));

  const total = Number(count);

  // 查询列表
  const items = await db
    .select({
      id: recycleBin.id,
      resourceType: recycleBin.resourceType,
      resourceId: recycleBin.resourceId,
      resourceName: recycleBin.resourceName,
      deletedById: recycleBin.deletedBy,
      deletedAt: recycleBin.deletedAt,
      expiresAt: recycleBin.expiresAt,
      deleteReason: recycleBin.deleteReason,
      projectId: recycleBin.projectId,
      companyId: recycleBin.companyId,
      deleterRealName: users.realName,
    })
    .from(recycleBin)
    .leftJoin(users, eq(recycleBin.deletedBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(recycleBin.deletedAt))
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  // 关键词过滤
  let filteredItems = items;
  if (keyword) {
    filteredItems = items.filter((item) =>
      item.resourceName.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // 计算剩余天数
  const now = new Date();
  const data = filteredItems.map((item) => ({
    id: item.id,
    resourceType: item.resourceType as ResourceType,
    resourceId: item.resourceId,
    resourceName: item.resourceName,
    deletedBy: {
      id: item.deletedById,
      realName: item.deleterRealName || '未知',
    },
    deletedAt: item.deletedAt,
    expiresAt: item.expiresAt,
    deleteReason: item.deleteReason,
    projectId: item.projectId,
    companyId: item.companyId,
    daysUntilExpiry: Math.ceil(
      (item.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  return {
    data,
    total,
    page,
    pageSize,
  };
}

/**
 * 获取回收站详情
 */
export async function getRecycleBinDetail(
  recycleBinId: number
): Promise<{
  id: number;
  resourceType: ResourceType;
  resourceId: number;
  resourceName: string;
  resourceData: Record<string, unknown>;
  deletedBy: { id: number; realName: string };
  deletedAt: Date;
  expiresAt: Date;
  deleteReason: string | null;
  projectId: number | null;
  companyId: number | null;
  daysUntilExpiry: number;
} | null> {
  const [item] = await db
    .select({
      id: recycleBin.id,
      resourceType: recycleBin.resourceType,
      resourceId: recycleBin.resourceId,
      resourceName: recycleBin.resourceName,
      resourceData: recycleBin.resourceData,
      deletedById: recycleBin.deletedBy,
      deletedAt: recycleBin.deletedAt,
      expiresAt: recycleBin.expiresAt,
      deleteReason: recycleBin.deleteReason,
      projectId: recycleBin.projectId,
      companyId: recycleBin.companyId,
      deleterRealName: users.realName,
    })
    .from(recycleBin)
    .leftJoin(users, eq(recycleBin.deletedBy, users.id))
    .where(eq(recycleBin.id, recycleBinId))
    .limit(1);

  if (!item) {
    return null;
  }

  const now = new Date();
  return {
    id: item.id,
    resourceType: item.resourceType as ResourceType,
    resourceId: item.resourceId,
    resourceName: item.resourceName,
    resourceData: JSON.parse(item.resourceData),
    deletedBy: {
      id: item.deletedById,
      realName: item.deleterRealName || '未知',
    },
    deletedAt: item.deletedAt,
    expiresAt: item.expiresAt,
    deleteReason: item.deleteReason,
    projectId: item.projectId,
    companyId: item.companyId,
    daysUntilExpiry: Math.ceil(
      (item.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
  };
}

// ============================================
// 定时任务相关
// ============================================

/**
 * 处理过期的回收站项目（自动删除）
 */
export async function processExpiredItems(): Promise<{
  deletedCount: number;
  reminderSentCount: number;
}> {
  const now = new Date();
  let deletedCount = 0;
  let reminderSentCount = 0;

  try {
    // 1. 查找已过期的项目并删除
    const expiredItems = await db
      .select()
      .from(recycleBin)
      .where(
        and(
          lte(recycleBin.expiresAt, now),
          isNull(recycleBin.restoredAt)
        )
      );

    for (const item of expiredItems) {
      await permanentDelete(item.id, item.deletedBy);
      deletedCount++;
    }

    // 2. 发送7天到期提醒
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + REMINDER_DAYS.seven_days);
    const sevenDayItems = await db
      .select()
      .from(recycleBin)
      .where(
        and(
          gte(recycleBin.expiresAt, now),
          lte(recycleBin.expiresAt, sevenDaysLater),
          eq(recycleBin.sevenDayReminderSent, false),
          isNull(recycleBin.restoredAt)
        )
      );

    for (const item of sevenDayItems) {
      await sendDeletionReminder(item.id, 'seven_days');
      await db
        .update(recycleBin)
        .set({ sevenDayReminderSent: true, updatedAt: now })
        .where(eq(recycleBin.id, item.id));
      reminderSentCount++;
    }

    // 3. 发送1天到期提醒
    const oneDayLater = new Date();
    oneDayLater.setDate(oneDayLater.getDate() + REMINDER_DAYS.one_day);
    const oneDayItems = await db
      .select()
      .from(recycleBin)
      .where(
        and(
          gte(recycleBin.expiresAt, now),
          lte(recycleBin.expiresAt, oneDayLater),
          eq(recycleBin.oneDayReminderSent, false),
          isNull(recycleBin.restoredAt)
        )
      );

    for (const item of oneDayItems) {
      await sendDeletionReminder(item.id, 'one_day');
      await db
        .update(recycleBin)
        .set({ oneDayReminderSent: true, updatedAt: now })
        .where(eq(recycleBin.id, item.id));
      reminderSentCount++;
    }

    return { deletedCount, reminderSentCount };
  } catch (error) {
    console.error('Process expired items error:', error);
    return { deletedCount, reminderSentCount };
  }
}

// ============================================
// 私有辅助函数
// ============================================

/**
 * 获取资源数据
 */
async function getResourceData(
  resourceType: ResourceType,
  resourceId: number
): Promise<{
  name: string;
  data: Record<string, unknown>;
  projectId?: number;
  companyId?: number;
} | null> {
  switch (resourceType) {
    case 'document': {
      const [doc] = await db
        .select()
        .from(bidDocuments)
        .where(eq(bidDocuments.id, resourceId))
        .limit(1);
      if (!doc) return null;
      return {
        name: doc.name,
        data: doc,
        projectId: doc.projectId,
      };
    }
    case 'chapter': {
      const [chapter] = await db
        .select()
        .from(bidChapters)
        .where(eq(bidChapters.id, resourceId))
        .limit(1);
      if (!chapter) return null;
      return {
        name: chapter.title,
        data: chapter,
      };
    }
    case 'file': {
      const [file] = await db
        .select()
        .from(files)
        .where(eq(files.id, resourceId))
        .limit(1);
      if (!file) return null;
      return {
        name: file.originalName,
        data: file,
      };
    }
    case 'company': {
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, resourceId))
        .limit(1);
      if (!company) return null;
      return {
        name: company.name,
        data: company,
        companyId: company.id,
      };
    }
    case 'company_file': {
      const [companyFile] = await db
        .select()
        .from(companyFiles)
        .where(eq(companyFiles.id, resourceId))
        .limit(1);
      if (!companyFile) return null;
      return {
        name: companyFile.fileName,
        data: companyFile,
        companyId: companyFile.companyId,
      };
    }
    case 'project': {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, resourceId))
        .limit(1);
      if (!project) return null;
      return {
        name: project.name,
        data: project,
        projectId: project.id,
      };
    }
    default:
      return null;
  }
}

/**
 * 软删除资源
 * 注意：实际删除操作在 moveToRecycleBin 中完成
 * 这里只是标记资源状态或直接物理删除（如章节）
 */
async function softDeleteResource(
  resourceType: ResourceType,
  resourceId: number
): Promise<void> {
  const now = new Date();

  switch (resourceType) {
    case 'document':
      // 文档软删除：标记状态为 rejected（作为已删除标记）
      // 实际数据保留在回收站记录中
      await db
        .update(bidDocuments)
        .set({ status: 'rejected', updatedAt: now })
        .where(eq(bidDocuments.id, resourceId));
      break;
    case 'chapter':
      // 章节直接删除（通常跟随文档一起删除）
      await db.delete(bidChapters).where(eq(bidChapters.id, resourceId));
      break;
    case 'file':
      await db
        .update(files)
        .set({ status: 'deleted', updatedAt: now })
        .where(eq(files.id, resourceId));
      break;
    case 'company':
      await db
        .update(companies)
        .set({ isActive: false, updatedAt: now })
        .where(eq(companies.id, resourceId));
      break;
    case 'company_file':
      await db
        .update(companyFiles)
        .set({ isActive: false, updatedAt: now })
        .where(eq(companyFiles.id, resourceId));
      break;
    case 'project':
      // 项目支持 archived 状态
      await db
        .update(projects)
        .set({ status: 'archived', updatedAt: now })
        .where(eq(projects.id, resourceId));
      break;
  }
}

/**
 * 恢复资源数据
 */
async function restoreResourceData(
  resourceType: ResourceType,
  resourceId: number,
  originalData: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  try {
    const now = new Date();

    switch (resourceType) {
      case 'document':
        // 检查项目是否存在
        const [project] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, originalData.projectId as number))
          .limit(1);
        if (!project) {
          return { success: false, message: '关联的项目不存在' };
        }
        await db
          .update(bidDocuments)
          .set({ status: 'draft', updatedAt: now })
          .where(eq(bidDocuments.id, resourceId));
        break;

      case 'chapter':
        // 需要重新插入章节
        await db.insert(bidChapters).values({
          ...originalData,
          id: resourceId,
          updatedAt: now,
        } as typeof bidChapters.$inferInsert);
        break;

      case 'file':
        await db
          .update(files)
          .set({ status: 'active', updatedAt: now })
          .where(eq(files.id, resourceId));
        break;

      case 'company':
        await db
          .update(companies)
          .set({ isActive: true, updatedAt: now })
          .where(eq(companies.id, resourceId));
        break;

      case 'company_file':
        await db
          .update(companyFiles)
          .set({ isActive: true, updatedAt: now })
          .where(eq(companyFiles.id, resourceId));
        break;

      case 'project':
        // 项目恢复到 draft 状态
        await db
          .update(projects)
          .set({ status: 'draft', updatedAt: now })
          .where(eq(projects.id, resourceId));
        break;
    }

    return { success: true, message: '恢复成功' };
  } catch (error) {
    console.error('Restore resource data error:', error);
    return { success: false, message: '恢复失败' };
  }
}

/**
 * 物理删除资源
 */
async function physicalDeleteResource(
  resourceType: ResourceType,
  resourceId: number
): Promise<void> {
  switch (resourceType) {
    case 'document':
      // 先删除关联章节
      await db.delete(bidChapters).where(eq(bidChapters.documentId, resourceId));
      await db.delete(bidDocuments).where(eq(bidDocuments.id, resourceId));
      break;
    case 'chapter':
      await db.delete(bidChapters).where(eq(bidChapters.id, resourceId));
      break;
    case 'file':
      await db.delete(files).where(eq(files.id, resourceId));
      break;
    case 'company':
      // 先删除关联文件
      await db.delete(companyFiles).where(eq(companyFiles.companyId, resourceId));
      await db.delete(companies).where(eq(companies.id, resourceId));
      break;
    case 'company_file':
      await db.delete(companyFiles).where(eq(companyFiles.id, resourceId));
      break;
    case 'project':
      await db.delete(projects).where(eq(projects.id, resourceId));
      break;
  }
}

/**
 * 创建删除提醒记录
 */
async function createDeletionReminders(
  recycleBinId: number,
  userId: number,
  expiresAt: Date
): Promise<void> {
  const reminders = [];

  // 7天前提醒
  const sevenDayReminderTime = new Date(expiresAt);
  sevenDayReminderTime.setDate(sevenDayReminderTime.getDate() - REMINDER_DAYS.seven_days);
  reminders.push({
    recycleBinId,
    reminderType: 'seven_days' as const,
    scheduledAt: sevenDayReminderTime,
    notifyUserId: userId,
    status: 'pending',
  });

  // 1天前提醒
  const oneDayReminderTime = new Date(expiresAt);
  oneDayReminderTime.setDate(oneDayReminderTime.getDate() - REMINDER_DAYS.one_day);
  reminders.push({
    recycleBinId,
    reminderType: 'one_day' as const,
    scheduledAt: oneDayReminderTime,
    notifyUserId: userId,
    status: 'pending',
  });

  await db.insert(deletionReminders).values(reminders);
}

/**
 * 发送删除提醒通知
 */
async function sendDeletionReminder(
  recycleBinId: number,
  reminderType: 'seven_days' | 'one_day'
): Promise<void> {
  try {
    // 获取回收站记录和用户信息
    const [recycleBinItem] = await db
      .select({
        id: recycleBin.id,
        resourceName: recycleBin.resourceName,
        resourceType: recycleBin.resourceType,
        expiresAt: recycleBin.expiresAt,
        deletedBy: recycleBin.deletedBy,
      })
      .from(recycleBin)
      .where(eq(recycleBin.id, recycleBinId))
      .limit(1);

    if (!recycleBinItem) return;

    // 获取用户信息
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, recycleBinItem.deletedBy))
      .limit(1);

    if (!user) return;

    // 创建系统通知
    const resourceTypeLabel = getResourceTypeLabel(recycleBinItem.resourceType);
    const daysLeft = reminderType === 'seven_days' ? 7 : 1;
    const message = `您删除的${resourceTypeLabel}"${recycleBinItem.resourceName}"将在${daysLeft}天后被永久删除，如需保留请及时恢复。`;

    // 这里调用系统通知服务
    // TODO: 集成实际的消息通知服务
    console.log(`[Recycle Bin Reminder] User: ${user.id}, Message: ${message}`);

    // 更新提醒记录状态
    await db
      .update(deletionReminders)
      .set({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deletionReminders.recycleBinId, recycleBinId),
          eq(deletionReminders.reminderType, reminderType)
        )
      );
  } catch (error) {
    console.error('Send deletion reminder error:', error);
  }
}

/**
 * 获取资源类型标签
 */
function getResourceTypeLabel(resourceType: string): string {
  const labels: Record<string, string> = {
    document: '标书文档',
    chapter: '章节内容',
    file: '文件',
    company: '公司',
    company_file: '公司文件',
    project: '项目',
  };
  return labels[resourceType] || '资源';
}

/**
 * 获取用户未读的删除提醒数量
 */
export async function getUnreadDeletionReminders(userId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(deletionReminders)
    .innerJoin(recycleBin, eq(deletionReminders.recycleBinId, recycleBin.id))
    .where(
      and(
        eq(deletionReminders.notifyUserId, userId),
        eq(deletionReminders.status, 'sent'),
        isNull(recycleBin.restoredAt)
      )
    );

  return Number(result[0]?.count || 0);
}

/**
 * 获取用户回收站统计
 */
export async function getRecycleBinStats(userId: number): Promise<{
  total: number;
  byType: Record<ResourceType, number>;
  expiringSoon: number; // 即将过期（7天内）
}> {
  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  // 获取用户删除的所有未恢复项目
  const items = await db
    .select({
      resourceType: recycleBin.resourceType,
      expiresAt: recycleBin.expiresAt,
    })
    .from(recycleBin)
    .where(
      and(
        eq(recycleBin.deletedBy, userId),
        isNull(recycleBin.restoredAt)
      )
    );

  const byType: Record<ResourceType, number> = {
    document: 0,
    chapter: 0,
    file: 0,
    company: 0,
    company_file: 0,
    project: 0,
  };

  let expiringSoon = 0;

  for (const item of items) {
    byType[item.resourceType as ResourceType]++;
    if (item.expiresAt <= sevenDaysLater) {
      expiringSoon++;
    }
  }

  return {
    total: items.length,
    byType,
    expiringSoon,
  };
}

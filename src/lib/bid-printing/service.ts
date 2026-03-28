/**
 * 打印标书安排服务
 * 提供打印标书的创建、查询、更新、删除以及推送到任务中心等功能
 */

import { db } from '@/db';
import {
  bidPrintings,
  projectTasks,
  users,
  projects,
  companies,
  companyContacts,
  type BidPrinting,
  type NewBidPrinting,
} from '@/db/schema';
import { eq, and, desc, sql, or, like } from 'drizzle-orm';

// ============================================
// 创建打印安排
// ============================================

export async function createPrinting(data: NewBidPrinting): Promise<BidPrinting> {
  const [printing] = await db.insert(bidPrintings).values(data).returning();
  return printing;
}

// ============================================
// 查询打印安排列表
// ============================================

export async function getPrintings(filters?: {
  status?: string;
  printingMethod?: string;
  assigneeId?: number;
  partnerCompanyId?: number;
  keyword?: string;
}): Promise<BidPrinting[]> {
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(bidPrintings.status, filters.status as any));
  }
  if (filters?.printingMethod) {
    conditions.push(eq(bidPrintings.printingMethod, filters.printingMethod as any));
  }
  if (filters?.assigneeId) {
    conditions.push(eq(bidPrintings.assigneeId, filters.assigneeId));
  }
  if (filters?.partnerCompanyId) {
    conditions.push(eq(bidPrintings.partnerCompanyId, filters.partnerCompanyId));
  }
  if (filters?.keyword) {
    conditions.push(
      or(
        like(bidPrintings.projectName, `%${filters.keyword}%`),
        like(bidPrintings.projectCode, `%${filters.keyword}%`)
      )
    );
  }

  return db
    .select()
    .from(bidPrintings)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bidPrintings.createdAt));
}

// ============================================
// 查询单个打印安排
// ============================================

export async function getPrintingById(id: number): Promise<BidPrinting | null> {
  const [printing] = await db
    .select()
    .from(bidPrintings)
    .where(eq(bidPrintings.id, id))
    .limit(1);
  return printing || null;
}

// ============================================
// 更新打印安排
// ============================================

export async function updatePrinting(id: number, data: Partial<NewBidPrinting>): Promise<BidPrinting> {
  const [printing] = await db
    .update(bidPrintings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(bidPrintings.id, id))
    .returning();
  return printing;
}

// ============================================
// 删除打印安排
// ============================================

export async function deletePrinting(id: number): Promise<void> {
  // 先查询是否有关联任务
  const printing = await getPrintingById(id);
  if (printing?.taskId) {
    await db.delete(projectTasks).where(eq(projectTasks.id, printing.taskId));
  }
  await db.delete(bidPrintings).where(eq(bidPrintings.id, id));
}

// ============================================
// 推送到任务中心
// ============================================

export async function pushToTaskCenter(id: number, userId: number): Promise<{
  success: boolean;
  printing?: BidPrinting;
  task?: typeof projectTasks.$inferSelect;
  error?: string;
}> {
  const printing = await getPrintingById(id);
  if (!printing) {
    return { success: false, error: '打印安排不存在' };
  }

  if (printing.pushedToTask && printing.taskId) {
    return { success: false, error: '该打印安排已推送到任务中心' };
  }

  if (!printing.assigneeId) {
    return { success: false, error: '请先指派负责人后再推送到任务中心' };
  }

  // 检查是否有关联项目（任务中心需要关联项目）
  if (!printing.projectId) {
    return { success: false, error: '请先关联项目后再推送到任务中心' };
  }

  // 获取项目信息
  const [projectInfo] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, printing.projectId))
    .limit(1);

  // 构建任务标题
  const methodText = {
    our_company: '本公司打印',
    partner_company: '去友司打印',
    together: '一起打印',
  };
  const taskTitle = `打印标书：${printing.projectName}`;

  // 构建任务描述
  let taskDescription = `项目编号：${printing.projectCode || '无'}\n`;
  taskDescription += `打印方式：${methodText[printing.printingMethod as keyof typeof methodText] || printing.printingMethod}\n`;
  taskDescription += `打印份数：${printing.copiesCount || 1} 份\n`;
  if (printing.partnerCompanyName) {
    taskDescription += `友司公司：${printing.partnerCompanyName}\n`;
  }
  if (printing.printingDeadline) {
    taskDescription += `截止时间：${new Date(printing.printingDeadline).toLocaleString('zh-CN')}\n`;
  }
  if (printing.remarks) {
    taskDescription += `\n备注：${printing.remarks}`;
  }

  // 创建任务
  const [task] = await db
    .insert(projectTasks)
    .values({
      projectId: printing.projectId,
      phaseId: null,
      title: taskTitle,
      description: taskDescription,
      assigneeId: printing.assigneeId,
      priority: (printing.priority as 'high' | 'medium' | 'low') || 'medium',
      status: 'pending',
      dueDate: printing.plannedDate || printing.printingDeadline || null,
      completedAt: null,
      parentId: null,
      sortOrder: 0,
      createdBy: userId,
    })
    .returning();

  // 更新打印安排
  const updated = await updatePrinting(id, {
    taskId: task.id,
    pushedToTask: true,
    pushedAt: new Date(),
  });

  return { success: true, printing: updated, task };
}

// ============================================
// 取消推送到任务中心
// ============================================

export async function cancelPushToTaskCenter(id: number): Promise<{
  success: boolean;
  printing?: BidPrinting;
  error?: string;
}> {
  const printing = await getPrintingById(id);
  if (!printing) {
    return { success: false, error: '打印安排不存在' };
  }

  if (!printing.pushedToTask || !printing.taskId) {
    return { success: false, error: '该打印安排未推送到任务中心' };
  }

  // 删除任务
  await db.delete(projectTasks).where(eq(projectTasks.id, printing.taskId));

  // 更新打印安排
  const updated = await updatePrinting(id, {
    taskId: null,
    pushedToTask: false,
    pushedAt: null,
  });

  return { success: true, printing: updated };
}

// ============================================
// 获取统计信息
// ============================================

export async function getPrintingStatistics(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
}> {
  const stats = await db
    .select({
      status: bidPrintings.status,
      method: bidPrintings.printingMethod,
      count: sql<number>`count(*)::int`,
    })
    .from(bidPrintings)
    .groupBy(bidPrintings.status, bidPrintings.printingMethod);

  const result = {
    total: 0,
    byStatus: {} as Record<string, number>,
    byMethod: {} as Record<string, number>,
  };

  for (const item of stats) {
    result.total += item.count;
    result.byStatus[item.status] = (result.byStatus[item.status] || 0) + item.count;
    result.byMethod[item.method] = (result.byMethod[item.method] || 0) + item.count;
  }

  return result;
}

// ============================================
// 获取用户列表（用于下拉选择）
// ============================================

export async function getUsersForSelect(): Promise<{ id: number; name: string }[]> {
  const userList = await db
    .select({ id: users.id, name: users.realName })
    .from(users)
    .where(eq(users.status, 'active'));
  
  return userList.map(u => ({ id: u.id, name: u.name || '' }));
}

// ============================================
// 获取友司公司列表（用于下拉选择）
// ============================================

export async function getPartnerCompaniesForSelect(): Promise<{ id: number; name: string }[]> {
  const companyList = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies);
  
  return companyList.map(c => ({ id: c.id, name: c.name }));
}

// ============================================
// 获取友司公司联系人
// ============================================

export async function getCompanyContacts(companyId: number): Promise<{
  id: number;
  name: string;
  phone: string | null;
}[]> {
  const contacts = await db
    .select({
      id: companyContacts.id,
      name: companyContacts.name,
      phone: companyContacts.phone,
    })
    .from(companyContacts)
    .where(eq(companyContacts.companyId, companyId));
  
  return contacts;
}

/**
 * 领取中标通知书服务
 * 提供领取安排的创建、查询、更新、删除以及推送到任务中心等功能
 */

import { db } from '@/db';
import {
  bidNotificationCollections,
  projectTasks,
  users,
  projects as _projects,
  type BidNotificationCollection,
  type NewBidNotificationCollection,
} from '@/db/schema';
import { eq, and, desc, sql, or, like } from 'drizzle-orm';
import { getProjectsForSelect as getProjectsForSelectCommon } from '@/lib/common/project-select';

// ============================================
// 创建领取安排
// ============================================

export async function createNotificationCollection(data: NewBidNotificationCollection): Promise<BidNotificationCollection> {
  const [collection] = await db.insert(bidNotificationCollections).values(data).returning();
  return collection;
}

// ============================================
// 查询领取安排列表
// ============================================

export async function getNotificationCollections(filters?: {
  status?: string;
  projectId?: number;
  keyword?: string;
}): Promise<BidNotificationCollection[]> {
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(bidNotificationCollections.status, filters.status as any));
  }
  if (filters?.projectId) {
    conditions.push(eq(bidNotificationCollections.projectId, filters.projectId));
  }
  if (filters?.keyword) {
    conditions.push(
      or(
        like(bidNotificationCollections.projectName, `%${filters.keyword}%`),
        like(bidNotificationCollections.projectCode, `%${filters.keyword}%`)
      )
    );
  }

  return db
    .select()
    .from(bidNotificationCollections)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bidNotificationCollections.createdAt));
}

// ============================================
// 查询单个领取安排
// ============================================

export async function getNotificationCollectionById(id: number): Promise<BidNotificationCollection | null> {
  const [collection] = await db
    .select()
    .from(bidNotificationCollections)
    .where(eq(bidNotificationCollections.id, id))
    .limit(1);
  return collection || null;
}

// ============================================
// 更新领取安排
// ============================================

export async function updateNotificationCollection(id: number, data: Partial<NewBidNotificationCollection>): Promise<BidNotificationCollection> {
  const [collection] = await db
    .update(bidNotificationCollections)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(bidNotificationCollections.id, id))
    .returning();
  return collection;
}

// ============================================
// 删除领取安排
// ============================================

export async function deleteNotificationCollection(id: number): Promise<void> {
  await db.delete(bidNotificationCollections).where(eq(bidNotificationCollections.id, id));
}

// ============================================
// 获取统计数据
// ============================================

export async function getNotificationCollectionStats(): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}> {
  const stats = await db
    .select({
      status: bidNotificationCollections.status,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(bidNotificationCollections)
    .groupBy(bidNotificationCollections.status);

  const result = {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  };

  stats.forEach(stat => {
    result.total += stat.count;
    switch (stat.status) {
      case 'pending':
        result.pending = stat.count;
        break;
      case 'in_progress':
        result.inProgress = stat.count;
        break;
      case 'completed':
        result.completed = stat.count;
        break;
      case 'cancelled':
        result.cancelled = stat.count;
        break;
    }
  });

  return result;
}

// ============================================
// 推送到任务中心
// ============================================

export async function pushNotificationCollectionToTask(id: number, creatorId: number): Promise<number> {
  const collection = await getNotificationCollectionById(id);
  if (!collection) {
    throw new Error('领取安排不存在');
  }

  // 创建任务 - projectId 必填
  if (!collection.projectId) {
    throw new Error('请先关联项目');
  }

  const [task] = await db
    .insert(projectTasks)
    .values({
      projectId: collection.projectId,
      title: `领取中标通知书: ${collection.projectName}`,
      description: `领取地点: ${collection.collectionLocation || '待定'}\n领取人: ${collection.collectorName || '待定'}\n截止日期: ${collection.notificationDeadline ? new Date(collection.notificationDeadline).toLocaleDateString('zh-CN') : '待定'}`,
      status: 'pending',
      priority: 'high',
      dueDate: collection.notificationDeadline,
      assigneeId: collection.collectorId || creatorId,
      createdBy: creatorId,
    })
    .returning();

  // 更新领取记录
  await updateNotificationCollection(id, { taskId: task.id });

  return task.id;
}

// ============================================
// 获取用户列表（用于下拉选择）
// ============================================

export async function getUsersForSelect(): Promise<{ id: number; name: string }[]> {
  return db
    .select({
      id: users.id,
      name: users.realName,
    })
    .from(users)
    .where(eq(users.status, 'active'))
    .orderBy(users.realName);
}

// ============================================
// 获取项目列表（用于下拉选择）
// ============================================

export async function getProjectsForSelect(): Promise<{ id: number; name: string; code: string | null }[]> {
  return getProjectsForSelectCommon();
}

/**
 * 履约保证金服务
 * 提供履约保证金的创建、查询、更新、删除以及推送到任务中心等功能
 */

import { db } from '@/db';
import {
  performanceBonds,
  projectTasks,
  users,
  projects,
  type PerformanceBond,
  type NewPerformanceBond,
} from '@/db/schema';
import { eq, and, desc, sql, or, like } from 'drizzle-orm';
import { getProjectsForSelect as getProjectsForSelectCommon } from '@/lib/common/project-select';

// ============================================
// 创建履约保证金
// ============================================

export async function createPerformanceBond(data: NewPerformanceBond): Promise<PerformanceBond> {
  const [bond] = await db.insert(performanceBonds).values(data).returning();
  return bond;
}

// ============================================
// 查询履约保证金列表
// ============================================

export async function getPerformanceBonds(filters?: {
  status?: string;
  projectId?: number;
  keyword?: string;
}): Promise<PerformanceBond[]> {
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(performanceBonds.status, filters.status as any));
  }
  if (filters?.projectId) {
    conditions.push(eq(performanceBonds.projectId, filters.projectId));
  }
  if (filters?.keyword) {
    conditions.push(
      or(
        like(performanceBonds.projectName, `%${filters.keyword}%`),
        like(performanceBonds.projectCode, `%${filters.keyword}%`)
      )
    );
  }

  return db
    .select()
    .from(performanceBonds)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(performanceBonds.createdAt));
}

// ============================================
// 查询单个履约保证金
// ============================================

export async function getPerformanceBondById(id: number): Promise<PerformanceBond | null> {
  const [bond] = await db
    .select()
    .from(performanceBonds)
    .where(eq(performanceBonds.id, id))
    .limit(1);
  return bond || null;
}

// ============================================
// 更新履约保证金
// ============================================

export async function updatePerformanceBond(id: number, data: Partial<NewPerformanceBond>): Promise<PerformanceBond> {
  const [bond] = await db
    .update(performanceBonds)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(performanceBonds.id, id))
    .returning();
  return bond;
}

// ============================================
// 删除履约保证金
// ============================================

export async function deletePerformanceBond(id: number): Promise<void> {
  await db.delete(performanceBonds).where(eq(performanceBonds.id, id));
}

// ============================================
// 获取统计数据
// ============================================

export async function getPerformanceBondStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  paid: number;
  refunding: number;
  refunded: number;
  cancelled: number;
}> {
  const stats = await db
    .select({
      status: performanceBonds.status,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(performanceBonds)
    .groupBy(performanceBonds.status);

  const result = {
    total: 0,
    pending: 0,
    processing: 0,
    paid: 0,
    refunding: 0,
    refunded: 0,
    cancelled: 0,
  };

  stats.forEach(stat => {
    result.total += stat.count;
    switch (stat.status) {
      case 'pending':
        result.pending = stat.count;
        break;
      case 'processing':
        result.processing = stat.count;
        break;
      case 'paid':
        result.paid = stat.count;
        break;
      case 'refunding':
        result.refunding = stat.count;
        break;
      case 'refunded':
        result.refunded = stat.count;
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

export async function pushPerformanceBondToTask(id: number, creatorId: number): Promise<number> {
  const bond = await getPerformanceBondById(id);
  if (!bond) {
    throw new Error('履约保证金记录不存在');
  }

  // 创建任务 - projectId 必填
  if (!bond.projectId) {
    throw new Error('请先关联项目');
  }

  const [task] = await db
    .insert(projectTasks)
    .values({
      projectId: bond.projectId,
      title: `缴纳履约保证金: ${bond.projectName}`,
      description: `金额: ${bond.bondAmount}\n截止日期: ${bond.paymentDeadline ? new Date(bond.paymentDeadline).toLocaleDateString('zh-CN') : '待定'}\n业务经办人: ${bond.handlerName || '待定'}\n财务经办人: ${bond.financeHandlerName || '待定'}`,
      status: 'pending',
      priority: 'high',
      dueDate: bond.paymentDeadline,
      assigneeId: bond.handlerId || creatorId,
      createdBy: creatorId,
    })
    .returning();

  // 更新履约保证金记录
  await updatePerformanceBond(id, { taskId: task.id });

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

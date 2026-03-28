/**
 * 保证金管理服务
 * 提供保证金申请、缴纳、退还跟踪等功能
 */

import { db } from '@/db';
import {
  bidGuarantees,
  projects,
  users,
  projectTasks,
  type BidGuarantee,
  type NewBidGuarantee,
} from '@/db/schema';
import { eq, and, desc, sql, lte, gte, inArray, isNull } from 'drizzle-orm';

// ============================================
// 保证金管理
// ============================================

export async function createGuarantee(data: NewBidGuarantee): Promise<BidGuarantee> {
  const [guarantee] = await db.insert(bidGuarantees).values(data).returning();
  return guarantee;
}

export async function getGuarantees(filters?: {
  projectId?: number;
  status?: string;
  type?: string;
  returnStatus?: string;
  assigneeId?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ data: BidGuarantee[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters?.projectId) {
    conditions.push(eq(bidGuarantees.projectId, filters.projectId));
  }
  if (filters?.status) {
    conditions.push(eq(bidGuarantees.status, filters.status as any));
  }
  if (filters?.type) {
    conditions.push(eq(bidGuarantees.type, filters.type as any));
  }
  if (filters?.returnStatus) {
    conditions.push(eq(bidGuarantees.returnStatus, filters.returnStatus));
  }
  if (filters?.assigneeId) {
    conditions.push(eq(bidGuarantees.assigneeId, filters.assigneeId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bidGuarantees)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select()
    .from(bidGuarantees)
    .where(whereClause)
    .orderBy(desc(bidGuarantees.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total };
}

export async function getGuaranteeById(id: number): Promise<BidGuarantee | null> {
  const [guarantee] = await db
    .select()
    .from(bidGuarantees)
    .where(eq(bidGuarantees.id, id))
    .limit(1);
  return guarantee || null;
}

export async function updateGuarantee(id: number, data: Partial<NewBidGuarantee>): Promise<BidGuarantee> {
  const [guarantee] = await db
    .update(bidGuarantees)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(bidGuarantees.id, id))
    .returning();
  return guarantee;
}

export async function deleteGuarantee(id: number): Promise<void> {
  await db.delete(bidGuarantees).where(eq(bidGuarantees.id, id));
}

// ============================================
// 任务指派
// ============================================

export async function assignGuarantee(id: number, data: {
  assigneeId: number;
  assigneeName: string;
  priority?: 'high' | 'medium' | 'low';
  plannedDate?: Date;
}): Promise<BidGuarantee> {
  return updateGuarantee(id, {
    assigneeId: data.assigneeId,
    assigneeName: data.assigneeName,
    priority: data.priority || 'medium',
    plannedDate: data.plannedDate || null,
  });
}

// ============================================
// 推送到任务中心
// ============================================

export async function pushToTaskCenter(id: number, userId: number): Promise<{
  success: boolean;
  guarantee?: BidGuarantee;
  task?: typeof projectTasks.$inferSelect;
  error?: string;
}> {
  // 获取保证金记录
  const guarantee = await getGuaranteeById(id);
  if (!guarantee) {
    return { success: false, error: '保证金记录不存在' };
  }

  // 检查是否已推送
  if (guarantee.pushedToTask && guarantee.taskId) {
    return { success: false, error: '该保证金已推送到任务中心' };
  }

  // 检查是否有指派人
  if (!guarantee.assigneeId) {
    return { success: false, error: '请先指派负责人后再推送到任务中心' };
  }

  // 获取项目信息
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, guarantee.projectId))
    .limit(1);

  // 构建任务标题
  const taskTitle = `保证金管理：${project?.name || '未知项目'}`;

  // 构建任务描述
  let taskDescription = `保证金金额：${guarantee.amount} ${guarantee.currency}\n`;
  taskDescription += `保证金类型：${guarantee.type === 'cash' ? '现金' : guarantee.type === 'bank_guarantee' ? '银行保函' : '保险保函'}\n`;
  if (guarantee.guaranteeNumber) {
    taskDescription += `保函编号：${guarantee.guaranteeNumber}\n`;
  }
  if (guarantee.issuingBank) {
    taskDescription += `开证银行：${guarantee.issuingBank}\n`;
  }
  if (guarantee.plannedDate) {
    taskDescription += `计划日期：${new Date(guarantee.plannedDate).toLocaleDateString('zh-CN')}\n`;
  }
  if (guarantee.notes) {
    taskDescription += `\n备注：${guarantee.notes}`;
  }

  // 创建任务
  const [task] = await db
    .insert(projectTasks)
    .values({
      projectId: guarantee.projectId,
      phaseId: null,
      title: taskTitle,
      description: taskDescription,
      assigneeId: guarantee.assigneeId,
      priority: (guarantee.priority as 'high' | 'medium' | 'low') || 'medium',
      status: 'pending',
      dueDate: guarantee.plannedDate || null,
      completedAt: null,
      parentId: null,
      sortOrder: 0,
      createdBy: userId,
    })
    .returning();

  // 更新保证金记录
  const updated = await updateGuarantee(id, {
    taskId: task.id,
    pushedToTask: true,
    pushedAt: new Date(),
  });

  return { success: true, guarantee: updated, task };
}

export async function cancelPushToTaskCenter(id: number): Promise<{
  success: boolean;
  guarantee?: BidGuarantee;
  error?: string;
}> {
  const guarantee = await getGuaranteeById(id);
  if (!guarantee) {
    return { success: false, error: '保证金记录不存在' };
  }

  if (!guarantee.pushedToTask || !guarantee.taskId) {
    return { success: false, error: '该保证金未推送到任务中心' };
  }

  // 删除任务
  await db.delete(projectTasks).where(eq(projectTasks.id, guarantee.taskId));

  // 更新保证金记录
  const updated = await updateGuarantee(id, {
    taskId: null,
    pushedToTask: false,
    pushedAt: null,
  });

  return { success: true, guarantee: updated };
}

// ============================================
// 状态更新
// ============================================

export async function markAsPaid(id: number, paymentData: {
  paymentDate: Date;
  paymentVoucher?: string;
  paymentMethod?: string;
}): Promise<BidGuarantee> {
  return updateGuarantee(id, {
    status: 'paid',
    paymentDate: paymentData.paymentDate,
    paymentVoucher: paymentData.paymentVoucher,
    paymentMethod: paymentData.paymentMethod,
    actualDate: paymentData.paymentDate,
  });
}

// ============================================
// 退保证金流程
// ============================================

export async function applyForReturn(id: number, data: {
  returnAmount?: string;
  returnReason?: string;
}): Promise<BidGuarantee> {
  return updateGuarantee(id, {
    returnStatus: 'applied',
    returnApplicationDate: new Date(),
    returnAmount: data.returnAmount,
    returnReason: data.returnReason,
  });
}

export async function approveReturn(id: number, data: {
  handlerId: number;
  handlerName: string;
}): Promise<BidGuarantee> {
  return updateGuarantee(id, {
    returnStatus: 'processing',
    returnHandlerId: data.handlerId,
    returnHandlerName: data.handlerName,
    returnApprovedAt: new Date(),
  });
}

export async function completeReturn(id: number, data: {
  returnDate: Date;
  returnAmount?: string;
  returnVoucher?: string;
}): Promise<BidGuarantee> {
  return updateGuarantee(id, {
    status: 'returned',
    returnStatus: 'returned',
    returnDate: data.returnDate,
    returnAmount: data.returnAmount,
    returnVoucher: data.returnVoucher,
  });
}

export async function rejectReturn(id: number, reason: string): Promise<BidGuarantee> {
  return updateGuarantee(id, {
    returnStatus: 'rejected',
    returnReason: reason,
  });
}

export async function markAsReturned(id: number, returnData: {
  returnDate: Date;
  returnAmount?: string;
  returnVoucher?: string;
  returnReason?: string;
}): Promise<BidGuarantee> {
  return updateGuarantee(id, {
    status: 'returned',
    returnStatus: 'returned',
    returnDate: returnData.returnDate,
    returnAmount: returnData.returnAmount,
    returnVoucher: returnData.returnVoucher,
    returnReason: returnData.returnReason,
  });
}

export async function markAsForfeited(id: number, reason: string): Promise<BidGuarantee> {
  return updateGuarantee(id, {
    status: 'forfeited',
    returnStatus: 'rejected',
    returnReason: reason,
  });
}

// ============================================
// 到期提醒
// ============================================

export async function getPendingGuarantees(): Promise<BidGuarantee[]> {
  return db
    .select()
    .from(bidGuarantees)
    .where(eq(bidGuarantees.status, 'pending'))
    .orderBy(bidGuarantees.createdAt);
}

export async function getExpiringGuarantees(days: number = 30): Promise<BidGuarantee[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  return db
    .select()
    .from(bidGuarantees)
    .where(
      and(
        eq(bidGuarantees.status, 'paid'),
        eq(bidGuarantees.type, 'bank_guarantee'),
        gte(bidGuarantees.guaranteeValidTo!, today),
        lte(bidGuarantees.guaranteeValidTo!, futureDate)
      )
    )
    .orderBy(bidGuarantees.guaranteeValidTo);
}

// ============================================
// 统计分析
// ============================================

export async function getGuaranteeStatistics(projectId?: number): Promise<{
  total: number;
  totalAmount: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  pendingAmount: number;
  paidAmount: number;
  returnedAmount: number;
}> {
  const conditions = projectId ? [eq(bidGuarantees.projectId, projectId)] : [];

  const guarantees = await db
    .select()
    .from(bidGuarantees)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const stats = {
    total: guarantees.length,
    totalAmount: 0,
    byStatus: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    pendingAmount: 0,
    paidAmount: 0,
    returnedAmount: 0,
  };

  for (const g of guarantees) {
    const amount = parseFloat(g.amount) || 0;
    stats.totalAmount += amount;
    stats.byStatus[g.status] = (stats.byStatus[g.status] || 0) + 1;
    stats.byType[g.type] = (stats.byType[g.type] || 0) + 1;

    if (g.status === 'pending') stats.pendingAmount += amount;
    if (g.status === 'paid') stats.paidAmount += amount;
    if (g.status === 'returned') stats.returnedAmount += amount;
  }

  return stats;
}

// ============================================
// 保函管理
// ============================================

export async function getBankGuarantees(): Promise<BidGuarantee[]> {
  return db
    .select()
    .from(bidGuarantees)
    .where(eq(bidGuarantees.type, 'bank_guarantee'))
    .orderBy(desc(bidGuarantees.createdAt));
}

export async function getGuaranteesByBank(bankName: string): Promise<BidGuarantee[]> {
  return db
    .select()
    .from(bidGuarantees)
    .where(
      and(
        eq(bidGuarantees.type, 'bank_guarantee'),
        eq(bidGuarantees.issuingBank, bankName)
      )
    )
    .orderBy(desc(bidGuarantees.createdAt));
}

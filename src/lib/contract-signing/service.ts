/**
 * 签订书面合同服务
 * 提供合同签订的创建、查询、更新、删除以及推送到任务中心等功能
 */

import { db } from '@/db';
import {
  contractSignings,
  projectTasks,
  users,
  projects,
  type ContractSigning,
  type NewContractSigning,
} from '@/db/schema';
import { eq, and, desc, sql, or, like } from 'drizzle-orm';
import { getProjectsForSelect as getProjectsForSelectCommon } from '@/lib/common/project-select';

// ============================================
// 创建合同签订记录
// ============================================

export async function createContractSigning(data: NewContractSigning): Promise<ContractSigning> {
  const [contract] = await db.insert(contractSignings).values(data).returning();
  return contract;
}

// ============================================
// 查询合同签订列表
// ============================================

export async function getContractSignings(filters?: {
  status?: string;
  projectId?: number;
  keyword?: string;
}): Promise<ContractSigning[]> {
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(contractSignings.status, filters.status as any));
  }
  if (filters?.projectId) {
    conditions.push(eq(contractSignings.projectId, filters.projectId));
  }
  if (filters?.keyword) {
    conditions.push(
      or(
        like(contractSignings.projectName, `%${filters.keyword}%`),
        like(contractSignings.projectCode, `%${filters.keyword}%`),
        like(contractSignings.contractName, `%${filters.keyword}%`),
        like(contractSignings.contractNumber, `%${filters.keyword}%`)
      )
    );
  }

  return db
    .select()
    .from(contractSignings)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contractSignings.createdAt));
}

// ============================================
// 查询单个合同签订
// ============================================

export async function getContractSigningById(id: number): Promise<ContractSigning | null> {
  const [contract] = await db
    .select()
    .from(contractSignings)
    .where(eq(contractSignings.id, id))
    .limit(1);
  return contract || null;
}

// ============================================
// 更新合同签订
// ============================================

export async function updateContractSigning(id: number, data: Partial<NewContractSigning>): Promise<ContractSigning> {
  // 获取更新前的合同信息
  const oldContract = await getContractSigningById(id);
  
  const [contract] = await db
    .update(contractSignings)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(contractSignings.id, id))
    .returning();
  
  // 如果合同状态变为"已签订"，自动将项目状态更新为"已完结"
  if (data.status === 'signed' && oldContract?.status !== 'signed' && contract.projectId) {
    await completeProject(contract.projectId, contract.contractName);
  }
  
  return contract;
}

// ============================================
// 完结项目（签订合同后自动调用）
// ============================================

export async function completeProject(projectId: number, contractName: string): Promise<void> {
  await db
    .update(projects)
    .set({
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
  
  console.log(`项目 ${projectId} 已完结，合同：${contractName}`);
}

// ============================================
// 删除合同签订
// ============================================

export async function deleteContractSigning(id: number): Promise<void> {
  await db.delete(contractSignings).where(eq(contractSignings.id, id));
}

// ============================================
// 获取统计数据
// ============================================

export async function getContractSigningStats(): Promise<{
  total: number;
  pending: number;
  drafting: number;
  reviewing: number;
  negotiating: number;
  signed: number;
  overdue: number;
  cancelled: number;
}> {
  const stats = await db
    .select({
      status: contractSignings.status,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(contractSignings)
    .groupBy(contractSignings.status);

  const result = {
    total: 0,
    pending: 0,
    drafting: 0,
    reviewing: 0,
    negotiating: 0,
    signed: 0,
    overdue: 0,
    cancelled: 0,
  };

  stats.forEach(stat => {
    result.total += stat.count;
    switch (stat.status) {
      case 'pending':
        result.pending = stat.count;
        break;
      case 'drafting':
        result.drafting = stat.count;
        break;
      case 'reviewing':
        result.reviewing = stat.count;
        break;
      case 'negotiating':
        result.negotiating = stat.count;
        break;
      case 'signed':
        result.signed = stat.count;
        break;
      case 'overdue':
        result.overdue = stat.count;
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

export async function pushContractSigningToTask(id: number, creatorId: number): Promise<number> {
  const contract = await getContractSigningById(id);
  if (!contract) {
    throw new Error('合同签订记录不存在');
  }

  // 创建任务 - projectId 必填
  if (!contract.projectId) {
    throw new Error('请先关联项目');
  }

  const [task] = await db
    .insert(projectTasks)
    .values({
      projectId: contract.projectId,
      title: `签订书面合同: ${contract.contractName}`,
      description: `项目: ${contract.projectName}\n合同编号: ${contract.contractNumber || '待定'}\n签订截止日期: ${contract.signingDeadline ? new Date(contract.signingDeadline).toLocaleDateString('zh-CN') : '待定'}\n经办人: ${contract.handlerName || '待定'}`,
      status: 'pending',
      priority: 'high',
      dueDate: contract.signingDeadline,
      assigneeId: contract.handlerId || creatorId,
      createdBy: creatorId,
    })
    .returning();

  // 更新合同签订记录
  await updateContractSigning(id, { taskId: task.id });

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

// ============================================
// 检查是否逾期
// ============================================

export async function checkOverdueContracts(): Promise<void> {
  const now = new Date();
  
  // 查找所有待签订、起草中、审核中、协商中且已过截止日期的合同
  await db
    .update(contractSignings)
    .set({ status: 'overdue', updatedAt: now })
    .where(
      and(
        or(
          eq(contractSignings.status, 'pending'),
          eq(contractSignings.status, 'drafting'),
          eq(contractSignings.status, 'reviewing'),
          eq(contractSignings.status, 'negotiating')
        ),
        sql`${contractSignings.signingDeadline} < ${now}`
      )
    );
}

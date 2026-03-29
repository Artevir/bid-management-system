/**
 * 盖章申请服务
 * 提供盖章申请的创建、查询、更新、删除以及推送到任务中心等功能
 */

import { db } from '@/db';
import {
  bidSealApplications,
  projectTasks,
  users,
  projects as _projects,
  companies,
  companyContacts,
  type BidSealApplication,
  type NewBidSealApplication,
} from '@/db/schema';
import { eq, and, desc, sql, or, like } from 'drizzle-orm';

// ============================================
// 创建盖章申请
// ============================================

export async function createSealApplication(data: NewBidSealApplication): Promise<BidSealApplication> {
  const [application] = await db.insert(bidSealApplications).values(data).returning();
  return application;
}

// ============================================
// 查询盖章申请列表
// ============================================

export async function getSealApplications(filters?: {
  status?: string;
  sealMethod?: string;
  assigneeId?: number;
  partnerCompanyId?: number;
  keyword?: string;
}): Promise<BidSealApplication[]> {
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(bidSealApplications.status, filters.status as any));
  }
  if (filters?.sealMethod) {
    conditions.push(eq(bidSealApplications.sealMethod, filters.sealMethod as any));
  }
  if (filters?.assigneeId) {
    conditions.push(eq(bidSealApplications.assigneeId, filters.assigneeId));
  }
  if (filters?.partnerCompanyId) {
    conditions.push(eq(bidSealApplications.partnerCompanyId, filters.partnerCompanyId));
  }
  if (filters?.keyword) {
    conditions.push(
      or(
        like(bidSealApplications.projectName, `%${filters.keyword}%`),
        like(bidSealApplications.projectCode, `%${filters.keyword}%`)
      )
    );
  }

  return db
    .select()
    .from(bidSealApplications)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bidSealApplications.createdAt));
}

// ============================================
// 查询单个盖章申请
// ============================================

export async function getSealApplicationById(id: number): Promise<BidSealApplication | null> {
  const [application] = await db
    .select()
    .from(bidSealApplications)
    .where(eq(bidSealApplications.id, id))
    .limit(1);
  return application || null;
}

// ============================================
// 更新盖章申请
// ============================================

export async function updateSealApplication(id: number, data: Partial<NewBidSealApplication>): Promise<BidSealApplication> {
  const [application] = await db
    .update(bidSealApplications)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(bidSealApplications.id, id))
    .returning();
  return application;
}

// ============================================
// 删除盖章申请
// ============================================

export async function deleteSealApplication(id: number): Promise<void> {
  await db.delete(bidSealApplications).where(eq(bidSealApplications.id, id));
}

// ============================================
// 获取盖章申请统计数据
// ============================================

export async function getSealApplicationStatistics(): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}> {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${bidSealApplications.status} = 'pending')::int`,
      inProgress: sql<number>`count(*) filter (where ${bidSealApplications.status} = 'in_progress')::int`,
      completed: sql<number>`count(*) filter (where ${bidSealApplications.status} = 'completed')::int`,
      cancelled: sql<number>`count(*) filter (where ${bidSealApplications.status} = 'cancelled')::int`,
    })
    .from(bidSealApplications);

  return stats;
}

// ============================================
// 推送到任务中心
// ============================================

export async function pushToTaskCenter(
  applicationId: number,
  creatorId: number
): Promise<{ success: boolean; taskId?: number; error?: string }> {
  // 获取盖章申请详情
  const application = await getSealApplicationById(applicationId);
  if (!application) {
    return { success: false, error: '盖章申请不存在' };
  }

  // 检查是否已推送
  if (application.taskId) {
    return { success: false, error: '该盖章申请已推送到任务中心' };
  }

  // 检查是否关联项目
  if (!application.projectId) {
    return { success: false, error: '请先关联项目' };
  }

  // 检查是否指派负责人
  if (!application.assigneeId) {
    return { success: false, error: '请先指派负责人' };
  }

  // 创建任务
  const sealMethodText = application.sealMethod === 'our_company' ? '本公司盖章' : '对方来盖章';
  const taskTitle = `盖章安排 - ${application.projectName}`;
  const taskDescription = `
项目：${application.projectName}
盖章方式：${sealMethodText}
${application.partnerCompanyName ? `友司：${application.partnerCompanyName}` : ''}
${application.partnerCompanyAddress ? `地址：${application.partnerCompanyAddress}` : ''}
${application.sealCount ? `份数：${application.sealCount} 份` : ''}
${application.sealPurpose ? `用途：${application.sealPurpose}` : ''}
${application.remarks ? `备注：${application.remarks}` : ''}
  `.trim();

  const [task] = await db
    .insert(projectTasks)
    .values({
      projectId: application.projectId!,
      title: taskTitle,
      description: taskDescription,
      assigneeId: application.assigneeId,
      priority: application.priority as any,
      status: 'pending',
      dueDate: application.sealDeadline,
      createdBy: creatorId,
    })
    .returning();

  // 更新盖章申请的 taskId
  await updateSealApplication(applicationId, { taskId: task.id });

  return { success: true, taskId: task.id };
}

// ============================================
// 获取用户列表（用于下拉选择）
// ============================================

export async function getUsersForSelect(): Promise<{ id: number; name: string }[]> {
  const result = await db
    .select({
      id: users.id,
      name: users.realName,
    })
    .from(users)
    .where(eq(users.status, 'active'))
    .orderBy(users.realName);

  return result.map((u) => ({ id: u.id, name: u.name }));
}

// ============================================
// 获取友司公司列表（用于下拉选择）
// ============================================

export async function getPartnerCompaniesForSelect(): Promise<{ 
  id: number; 
  name: string; 
  officeAddress: string | null;
  registerAddress: string | null;
}[]> {
  const result = await db
    .select({
      id: companies.id,
      name: companies.name,
      officeAddress: companies.officeAddress,
      registerAddress: companies.registerAddress,
    })
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(companies.name);

  return result;
}

// ============================================
// 获取公司联系人
// ============================================

export async function getCompanyContacts(companyId: number): Promise<{ 
  id: number; 
  name: string; 
  phone: string | null;
}[]> {
  const result = await db
    .select({
      id: companyContacts.id,
      name: companyContacts.name,
      phone: companyContacts.phone,
    })
    .from(companyContacts)
    .where(eq(companyContacts.companyId, companyId))
    .orderBy(companyContacts.name);

  return result;
}

// ============================================
// 获取公司地址（用于盖章地址）
// ============================================

export async function getCompanyAddress(companyId: number): Promise<{
  officeAddress: string | null;
  registerAddress: string | null;
} | null> {
  const [company] = await db
    .select({
      officeAddress: companies.officeAddress,
      registerAddress: companies.registerAddress,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  return company || null;
}

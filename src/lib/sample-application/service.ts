/**
 * 样机申请服务层
 */

import { db } from '@/db';
import {
  sampleApplications,
  sampleConfigurations,
  sampleDisplays,
  sampleReviews,
  sampleTodos,
  authorizationApplications,
  authorizationManufacturers,
  users,
} from '@/db/schema';
import { eq, and, desc, asc, like, or, inArray, count, sql } from 'drizzle-orm';

// 生成随机ID
function generateRandomId(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================
// 类型定义
// ============================================

export interface CreateSampleApplicationInput {
  authorizationApplicationId?: number;
  projectId?: number;
  applicationDate?: Date;
  handlerId: number;
  handlerName: string;
  handlerPhone?: string;
  sampleDeadline?: Date;
  projectName?: string;
  projectCode?: string;
  receiveMethod?: 'self_pickup' | 'logistics' | 'manufacturer';
  receiverName?: string;
  receiverPhone?: string;
  storageLocationType?: string;
  storageAddress?: string;
  storageRequirements?: string;
  returnMethod?: 'self_send' | 'manufacturer_pickup' | 'other';
  returnContactName?: string;
  returnContactPhone?: string;
  supplementaryNotes?: string;
  createdBy: number;
}

export interface UpdateSampleApplicationInput {
  applicationDate?: Date;
  handlerId?: number;
  handlerName?: string;
  handlerPhone?: string;
  sampleDeadline?: Date;
  sampleReceivedAt?: Date;
  sampleReturnedAt?: Date;
  projectName?: string;
  projectCode?: string;
  receiveMethod?: 'self_pickup' | 'logistics' | 'manufacturer';
  receiverName?: string;
  receiverPhone?: string;
  storageLocationType?: string;
  storageAddress?: string;
  storageRequirements?: string;
  returnMethod?: 'self_send' | 'manufacturer_pickup' | 'other';
  returnContactName?: string;
  returnContactPhone?: string;
  supplementaryNotes?: string;
  trackingStatus?: 'not_tracked' | 'tracking' | 'completed';
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'sample_pending' | 'sample_received' | 'sample_returned' | 'terminated';
}

export interface CreateSampleConfigurationInput {
  applicationId: number;
  manufacturerId?: number;
  manufacturerName: string;
  sampleName: string;
  sampleSpec?: string;
  sampleConfig?: string;
  quantity?: number;
  deviationType?: 'none' | 'positive' | 'negative';
  deviationNotes?: string;
  sortOrder?: number;
}

export interface CreateSampleDisplayInput {
  applicationId: number;
  displayRequirements?: string;
  displayTime?: Date;
  displayLocation?: string;
  displayManagerName?: string;
  displayManagerPhone?: string;
  displayAccompanyingPersons?: string[];
  sampleArrivalTime?: Date;
  sampleConfirmTime?: Date;
  sampleReceiveTime?: Date;
  displayCompletedTime?: Date;
  displayResultNotes?: string;
}

// ============================================
// 样机申请服务
// ============================================

export async function createSampleApplication(input: CreateSampleApplicationInput) {
  // 生成申请单编号
  const applicationNo = `SA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${generateRandomId()}`;

  // 如果关联了授权申请，自动同步项目信息
  let projectData = {};
  if (input.authorizationApplicationId) {
    const authApp = await db.query.authorizationApplications.findFirst({
      where: eq(authorizationApplications.id, input.authorizationApplicationId),
    });
    if (authApp) {
      projectData = {
        projectId: authApp.projectId,
        projectName: input.projectName || authApp.projectName,
        projectCode: input.projectCode || authApp.projectCode,
      };
    }
  }

  const [application] = await db.insert(sampleApplications).values({
    applicationNo,
    ...input,
    ...projectData,
  }).returning();

  // 创建默认审核环节
  const reviewStages = ['material_completeness', 'specification', 'display', 'final'] as const;
  await db.insert(sampleReviews).values(
    reviewStages.map(stage => ({
      applicationId: application.id,
      stage,
      reviewerId: input.handlerId,
      reviewerName: input.handlerName,
      result: 'pending' as const,
    }))
  );

  // 创建默认待办事项
  await db.insert(sampleTodos).values([
    {
      applicationId: application.id,
      title: '样机材料提交',
      assigneeId: input.handlerId,
      assigneeName: input.handlerName,
      deadline: input.sampleDeadline,
      type: 'sample_submit',
    },
    {
      applicationId: application.id,
      title: '样机接收确认',
      assigneeId: input.handlerId,
      assigneeName: input.handlerName,
      type: 'sample_receive',
    },
    {
      applicationId: application.id,
      title: '样机归还',
      assigneeId: input.handlerId,
      assigneeName: input.handlerName,
      type: 'return',
    },
  ]);

  // 创建现场展示记录
  await db.insert(sampleDisplays).values({
    applicationId: application.id,
  });

  return application;
}

export async function getSampleApplicationById(id: number) {
  const application = await db.query.sampleApplications.findFirst({
    where: eq(sampleApplications.id, id),
    with: {
      configurations: {
        with: {
          manufacturer: true,
        },
        orderBy: [asc(sampleConfigurations.sortOrder)],
      },
      display: true,
      reviews: {
        orderBy: [asc(sampleReviews.stage)],
      },
      todos: {
        orderBy: [asc(sampleTodos.createdAt)],
      },
      handler: true,
      authorizationApplication: true,
    },
  });

  return application;
}

export async function updateSampleApplication(id: number, input: UpdateSampleApplicationInput) {
  const [application] = await db.update(sampleApplications)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(sampleApplications.id, id))
    .returning();

  return application;
}

export async function deleteSampleApplication(id: number) {
  await db.delete(sampleApplications).where(eq(sampleApplications.id, id));
}

export async function submitSampleApplication(id: number) {
  // 检查样机配置
  const configs = await db.query.sampleConfigurations.findMany({
    where: eq(sampleConfigurations.applicationId, id),
  });

  if (configs.length < 1) {
    throw new Error('请至少添加1个样机配置');
  }

  const [application] = await db.update(sampleApplications)
    .set({
      status: 'pending_review',
      updatedAt: new Date(),
    })
    .where(eq(sampleApplications.id, id))
    .returning();

  return application;
}

// ============================================
// 样机配置服务
// ============================================

export async function createSampleConfiguration(input: CreateSampleConfigurationInput) {
  const [config] = await db.insert(sampleConfigurations).values(input).returning();
  return config;
}

export async function updateSampleConfiguration(id: number, input: Partial<CreateSampleConfigurationInput>) {
  const [config] = await db.update(sampleConfigurations)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(sampleConfigurations.id, id))
    .returning();
  return config;
}

export async function deleteSampleConfiguration(id: number) {
  await db.delete(sampleConfigurations).where(eq(sampleConfigurations.id, id));
}

export async function getSampleConfigurations(applicationId: number) {
  return db.query.sampleConfigurations.findMany({
    where: eq(sampleConfigurations.applicationId, applicationId),
    with: { manufacturer: true },
    orderBy: [asc(sampleConfigurations.sortOrder)],
  });
}

// ============================================
// 现场展示服务
// ============================================

export async function updateSampleDisplay(applicationId: number, input: Partial<CreateSampleDisplayInput>) {
  // 转换 displayAccompanyingPersons 为 JSON 字符串
  const dataToInsert = {
    ...input,
    displayAccompanyingPersons: input.displayAccompanyingPersons 
      ? JSON.stringify(input.displayAccompanyingPersons) 
      : undefined,
  };
  
  const [display] = await db.insert(sampleDisplays)
    .values({ applicationId, ...dataToInsert })
    .onConflictDoUpdate({
      target: sampleDisplays.applicationId,
      set: { ...dataToInsert, updatedAt: new Date() },
    })
    .returning();
  return display;
}

export async function getSampleDisplay(applicationId: number) {
  return db.query.sampleDisplays.findFirst({
    where: eq(sampleDisplays.applicationId, applicationId),
  });
}

// ============================================
// 审核服务
// ============================================

export async function reviewSampleApplication(
  applicationId: number,
  stage: 'material_completeness' | 'specification' | 'display' | 'final',
  reviewerId: number,
  reviewerName: string,
  result: 'approved' | 'rejected',
  comment?: string
) {
  // 更新审核记录
  await db.update(sampleReviews)
    .set({
      reviewerId,
      reviewerName,
      result,
      comment,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(sampleReviews.applicationId, applicationId), eq(sampleReviews.stage, stage)));

  // 如果驳回，更新申请状态
  if (result === 'rejected') {
    await db.update(sampleApplications)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(sampleApplications.id, applicationId));
    return;
  }

  // 检查是否所有环节都已通过
  const reviews = await db.query.sampleReviews.findMany({
    where: eq(sampleReviews.applicationId, applicationId),
  });

  const allApproved = reviews.every(r => r.result === 'approved');

  if (allApproved) {
    await db.update(sampleApplications)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(sampleApplications.id, applicationId));
  }
}

export async function getSampleReviews(applicationId: number) {
  return db.query.sampleReviews.findMany({
    where: eq(sampleReviews.applicationId, applicationId),
    orderBy: [asc(sampleReviews.stage)],
  });
}

// ============================================
// 待办事项服务
// ============================================

export async function createSampleTodo(input: {
  applicationId: number;
  title: string;
  assigneeId: number;
  assigneeName: string;
  deadline?: Date;
  type: string;
  notes?: string;
}) {
  const [todo] = await db.insert(sampleTodos).values(input).returning();
  return todo;
}

export async function updateSampleTodo(id: number, input: {
  status?: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  notes?: string;
}) {
  const [todo] = await db.update(sampleTodos)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(sampleTodos.id, id))
    .returning();
  return todo;
}

export async function deleteSampleTodo(id: number) {
  await db.delete(sampleTodos).where(eq(sampleTodos.id, id));
}

export async function getSampleTodos(applicationId: number) {
  return db.query.sampleTodos.findMany({
    where: eq(sampleTodos.applicationId, applicationId),
    orderBy: [asc(sampleTodos.createdAt)],
  });
}

// ============================================
// 列表查询服务
// ============================================

export interface GetSampleApplicationsOptions {
  projectId?: number;
  authorizationApplicationId?: number;
  status?: string;
  keyword?: string;
  handlerId?: number;
  page?: number;
  pageSize?: number;
}

export async function getSampleApplications(options: GetSampleApplicationsOptions = {}) {
  const { page = 1, pageSize = 20, projectId, authorizationApplicationId, status, keyword, handlerId } = options;

  const conditions = [];
  if (projectId) conditions.push(eq(sampleApplications.projectId, projectId));
  if (authorizationApplicationId) conditions.push(eq(sampleApplications.authorizationApplicationId, authorizationApplicationId));
  if (status) conditions.push(eq(sampleApplications.status, status as any));
  if (handlerId) conditions.push(eq(sampleApplications.handlerId, handlerId));
  if (keyword) {
    conditions.push(
      or(
        like(sampleApplications.applicationNo, `%${keyword}%`),
        like(sampleApplications.projectName, `%${keyword}%`),
        like(sampleApplications.handlerName, `%${keyword}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db.query.sampleApplications.findMany({
    where: whereClause,
    with: {
      handler: true,
      configurations: true,
    },
    orderBy: [desc(sampleApplications.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(sampleApplications)
    .where(whereClause);

  return { items, total };
}

export async function getSampleApplicationStatistics(projectId?: number) {
  const conditions = projectId ? [eq(sampleApplications.projectId, projectId)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const stats = await db
    .select({
      status: sampleApplications.status,
      count: count(),
    })
    .from(sampleApplications)
    .where(whereClause)
    .groupBy(sampleApplications.status);

  const result = {
    total: 0,
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    sample_pending: 0,
    sample_received: 0,
    sample_returned: 0,
    terminated: 0,
  };

  stats.forEach(s => {
    result.total += s.count;
    if (s.status in result) {
      (result as any)[s.status] = s.count;
    }
  });

  return result;
}

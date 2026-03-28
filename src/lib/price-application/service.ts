/**
 * 价格申请服务层
 */

import { db } from '@/db';
import {
  priceApplications,
  priceApplicationItems,
  priceReviews,
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

export interface CreatePriceApplicationInput {
  authorizationApplicationId?: number;
  projectId?: number;
  applicationDate?: Date;
  handlerId: number;
  handlerName: string;
  handlerPhone?: string;
  projectName?: string;
  projectCode?: string;
  tenderOrganization?: string;
  submissionDeadline?: Date;
  priceValidFrom?: Date;
  priceValidTo?: Date;
  notes?: string;
  createdBy: number;
}

export interface UpdatePriceApplicationInput {
  applicationDate?: Date;
  handlerId?: number;
  handlerName?: string;
  handlerPhone?: string;
  projectName?: string;
  projectCode?: string;
  tenderOrganization?: string;
  submissionDeadline?: Date;
  priceValidFrom?: Date;
  priceValidTo?: Date;
  notes?: string;
  trackingStatus?: 'not_tracked' | 'tracking' | 'completed';
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'terminated';
}

export interface CreatePriceApplicationItemInput {
  applicationId: number;
  manufacturerId?: number;
  manufacturerName: string;
  productName: string;
  productSpec?: string;
  unitPrice?: string;
  totalPrice?: string;
  currency?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  sortOrder?: number;
}

// ============================================
// 价格申请服务
// ============================================

export async function createPriceApplication(input: CreatePriceApplicationInput) {
  // 生成申请单编号
  const applicationNo = `PA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${generateRandomId()}`;

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
        tenderOrganization: input.tenderOrganization || authApp.tenderOrganization,
        submissionDeadline: input.submissionDeadline || authApp.submissionDeadline,
      };
    }
  }

  const [application] = await db.insert(priceApplications).values({
    applicationNo,
    ...input,
    ...projectData,
  }).returning();

  // 创建默认审核环节
  const reviewStages = ['price_completeness', 'price_rationality', 'final'] as const;
  await db.insert(priceReviews).values(
    reviewStages.map(stage => ({
      applicationId: application.id,
      stage,
      reviewerId: input.handlerId,
      reviewerName: input.handlerName,
      result: 'pending' as const,
    }))
  );

  return application;
}

export async function getPriceApplicationById(id: number) {
  const application = await db.query.priceApplications.findFirst({
    where: eq(priceApplications.id, id),
    with: {
      items: {
        with: {
          manufacturer: true,
        },
        orderBy: [asc(priceApplicationItems.sortOrder)],
      },
      reviews: {
        orderBy: [asc(priceReviews.stage)],
      },
      handler: true,
      authorizationApplication: true,
    },
  });

  return application;
}

export async function updatePriceApplication(id: number, input: UpdatePriceApplicationInput) {
  const [application] = await db.update(priceApplications)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(priceApplications.id, id))
    .returning();

  return application;
}

export async function deletePriceApplication(id: number) {
  await db.delete(priceApplications).where(eq(priceApplications.id, id));
}

export async function submitPriceApplication(id: number) {
  // 检查价格明细
  const items = await db.query.priceApplicationItems.findMany({
    where: eq(priceApplicationItems.applicationId, id),
  });

  if (items.length < 1) {
    throw new Error('请至少添加1个价格明细');
  }

  const [application] = await db.update(priceApplications)
    .set({
      status: 'pending_review',
      updatedAt: new Date(),
    })
    .where(eq(priceApplications.id, id))
    .returning();

  return application;
}

// ============================================
// 价格明细服务
// ============================================

export async function createPriceApplicationItem(input: CreatePriceApplicationItemInput) {
  const [item] = await db.insert(priceApplicationItems).values(input).returning();
  return item;
}

export async function updatePriceApplicationItem(id: number, input: Partial<CreatePriceApplicationItemInput>) {
  const [item] = await db.update(priceApplicationItems)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(priceApplicationItems.id, id))
    .returning();
  return item;
}

export async function deletePriceApplicationItem(id: number) {
  await db.delete(priceApplicationItems).where(eq(priceApplicationItems.id, id));
}

export async function getPriceApplicationItems(applicationId: number) {
  return db.query.priceApplicationItems.findMany({
    where: eq(priceApplicationItems.applicationId, applicationId),
    with: { manufacturer: true },
    orderBy: [asc(priceApplicationItems.sortOrder)],
  });
}

// ============================================
// 审核服务
// ============================================

export async function reviewPriceApplication(
  applicationId: number,
  stage: 'price_completeness' | 'price_rationality' | 'final',
  reviewerId: number,
  reviewerName: string,
  result: 'approved' | 'rejected',
  comment?: string
) {
  // 更新审核记录
  await db.update(priceReviews)
    .set({
      reviewerId,
      reviewerName,
      result,
      comment,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(priceReviews.applicationId, applicationId), eq(priceReviews.stage, stage)));

  // 如果驳回，更新申请状态
  if (result === 'rejected') {
    await db.update(priceApplications)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(priceApplications.id, applicationId));
    return;
  }

  // 检查是否所有环节都已通过
  const reviews = await db.query.priceReviews.findMany({
    where: eq(priceReviews.applicationId, applicationId),
  });

  const allApproved = reviews.every(r => r.result === 'approved');

  if (allApproved) {
    await db.update(priceApplications)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(priceApplications.id, applicationId));
  }
}

export async function getPriceReviews(applicationId: number) {
  return db.query.priceReviews.findMany({
    where: eq(priceReviews.applicationId, applicationId),
    orderBy: [asc(priceReviews.stage)],
  });
}

// ============================================
// 列表查询服务
// ============================================

export interface GetPriceApplicationsOptions {
  projectId?: number;
  authorizationApplicationId?: number;
  status?: string;
  keyword?: string;
  handlerId?: number;
  page?: number;
  pageSize?: number;
}

export async function getPriceApplications(options: GetPriceApplicationsOptions = {}) {
  const { page = 1, pageSize = 20, projectId, authorizationApplicationId, status, keyword, handlerId } = options;

  const conditions = [];
  if (projectId) conditions.push(eq(priceApplications.projectId, projectId));
  if (authorizationApplicationId) conditions.push(eq(priceApplications.authorizationApplicationId, authorizationApplicationId));
  if (status) conditions.push(eq(priceApplications.status, status as any));
  if (handlerId) conditions.push(eq(priceApplications.handlerId, handlerId));
  if (keyword) {
    conditions.push(
      or(
        like(priceApplications.applicationNo, `%${keyword}%`),
        like(priceApplications.projectName, `%${keyword}%`),
        like(priceApplications.handlerName, `%${keyword}%`),
        like(priceApplications.tenderOrganization, `%${keyword}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db.query.priceApplications.findMany({
    where: whereClause,
    with: {
      handler: true,
      items: true,
    },
    orderBy: [desc(priceApplications.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(priceApplications)
    .where(whereClause);

  return { items, total };
}

export async function getPriceApplicationStatistics(projectId?: number) {
  const conditions = projectId ? [eq(priceApplications.projectId, projectId)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const stats = await db
    .select({
      status: priceApplications.status,
      count: count(),
    })
    .from(priceApplications)
    .where(whereClause)
    .groupBy(priceApplications.status);

  const result = {
    total: 0,
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
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

/**
 * 友司支持申请服务层
 */

import { db } from '@/db';
import {
  partnerApplications,
  partnerMaterials,
  partnerFees,
  partnerReviews,
  partnerTodos,
  users as _users,
  companies as _companies,
} from '@/db/schema';
import { eq, and, desc, asc, like, or, count, sql as _sql } from 'drizzle-orm';

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

export interface CreatePartnerApplicationInput {
  projectId?: number;
  applicationDate?: Date;
  handlerId: number;
  handlerName: string;
  handlerPhone?: string;
  materialDeadline?: Date;
  smsReminderEnabled?: boolean;
  projectName?: string;
  projectCode?: string;
  tenderOrganization?: string;
  submissionDeadline?: Date;
  interpretationFileId?: number;
  biddingRequirements?: string;
  partnerCompanyId?: number;
  partnerCompanyName: string;
  partnerContactPerson?: string;
  partnerContactPhone?: string;
  legalRepName?: string;
  legalRepIdCardProvided?: boolean;
  legalRepIdCardType?: string;
  bidAgentName?: string;
  bidAgentIdCardProvided?: boolean;
  bidAgentIdCardType?: string;
  bidAgentPhone?: string;
  bidAgentWechat?: string;
  partnerLiaisonName?: string;
  partnerLiaisonPhone?: string;
  partnerLiaisonWechat?: string;
  materialReceiverName?: string;
  materialReceiverPhone?: string;
  electronicReceiveAddress?: string;
  paperReceiveAddress?: string;
  notes?: string;
  createdBy: number;
}

export interface UpdatePartnerApplicationInput {
  applicationDate?: Date;
  handlerId?: number;
  handlerName?: string;
  handlerPhone?: string;
  materialDeadline?: Date;
  electronicMaterialReceivedAt?: Date;
  paperMaterialReceivedAt?: Date;
  allMaterialReceivedAt?: Date;
  smsReminderEnabled?: boolean;
  trackingStatus?: 'not_tracked' | 'tracking' | 'completed';
  projectName?: string;
  projectCode?: string;
  tenderOrganization?: string;
  submissionDeadline?: Date;
  biddingRequirements?: string;
  partnerCompanyId?: number;
  partnerCompanyName?: string;
  partnerContactPerson?: string;
  partnerContactPhone?: string;
  legalRepName?: string;
  legalRepIdCardProvided?: boolean;
  legalRepIdCardType?: string;
  bidAgentName?: string;
  bidAgentIdCardProvided?: boolean;
  bidAgentIdCardType?: string;
  bidAgentPhone?: string;
  bidAgentWechat?: string;
  partnerLiaisonName?: string;
  partnerLiaisonPhone?: string;
  partnerLiaisonWechat?: string;
  partnerConfirmStatus?: 'confirmed' | 'pending' | 'rejected';
  partnerConfirmedAt?: Date;
  materialReceiverName?: string;
  materialReceiverPhone?: string;
  electronicReceiveAddress?: string;
  paperReceiveAddress?: string;
  materialAcceptanceStatus?: string;
  materialAcceptanceNotes?: string;
  applicationSummary?: string;
  notes?: string;
  status?: 'draft' | 'pending_confirm' | 'confirmed' | 'material_pending' | 'material_received' | 'completed' | 'terminated';
}

export interface CreatePartnerMaterialInput {
  applicationId: number;
  category: string;
  materialName: string;
  isProvided?: boolean;
  submitType?: string;
  notes?: string;
  fileId?: number;
  fileUrl?: string;
  isConfirmed?: boolean;
  sortOrder?: number;
}

export interface CreatePartnerFeeInput {
  applicationId: number;
  feeType: string;
  feeName: string;
  defaultAmount?: string;
  actualAmount: string;
  notes?: string;
  paymentStatus?: string;
  sortOrder?: number;
}

// ============================================
// 友司支持申请服务
// ============================================

export async function createPartnerApplication(input: CreatePartnerApplicationInput & {
  materials?: { category: string; materialName: string; isProvided?: boolean; submitType?: string }[];
  fees?: { feeType: string; feeName: string; defaultAmount?: string; actualAmount: string }[];
  todos?: { title: string; assigneeName: string; deadline?: string; type: string }[];
}) {
  // 生成申请单编号
  const applicationNo = `PA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${generateRandomId()}`;

  const { materials: inputMaterials, fees: inputFees, todos: inputTodos, ...applicationInput } = input;

  const [application] = await db.insert(partnerApplications).values({
    applicationNo,
    ...applicationInput,
  }).returning();

  // 创建默认审核环节
  const reviewStages = ['material_completeness', 'material_validity', 'final'] as const;
  await db.insert(partnerReviews).values(
    reviewStages.map(stage => ({
      applicationId: application.id,
      stage,
      reviewerId: input.handlerId,
      reviewerName: input.handlerName,
      result: 'pending' as const,
    }))
  );

  // 创建材料：优先使用用户提交的材料，否则创建默认材料
  if (inputMaterials && inputMaterials.length > 0) {
    await db.insert(partnerMaterials).values(
      inputMaterials.map((m, index) => ({
        applicationId: application.id,
        category: m.category,
        materialName: m.materialName,
        isProvided: m.isProvided || false,
        submitType: m.submitType || 'electronic',
        sortOrder: index + 1,
      }))
    );
  } else {
    // 创建默认材料项目
    await db.insert(partnerMaterials).values([
      { applicationId: application.id, category: 'basic', materialName: '营业执照（副本复印件加盖公章）', sortOrder: 1 },
      { applicationId: application.id, category: 'basic', materialName: 'ISO系列认证证书', sortOrder: 2 },
      { applicationId: application.id, category: 'basic', materialName: '涉密相关证书（如有）', sortOrder: 3 },
      { applicationId: application.id, category: 'basic', materialName: '集成等级证书（如有）', sortOrder: 4 },
      { applicationId: application.id, category: 'qualification', materialName: '投标相关模板文件（如有）', sortOrder: 5 },
      { applicationId: application.id, category: 'performance', materialName: '同类项目合同复印件（加盖公章）', sortOrder: 6 },
      { applicationId: application.id, category: 'performance', materialName: '同类项目中标通知书/验收报告', sortOrder: 7 },
      { applicationId: application.id, category: 'personnel', materialName: '投标相关人员名单', sortOrder: 8 },
      { applicationId: application.id, category: 'personnel', materialName: '相关人员资质证书（职称/技能证等）', sortOrder: 9 },
    ]);
  }

  // 创建费用：优先使用用户提交的费用，否则创建默认费用
  if (inputFees && inputFees.length > 0) {
    await db.insert(partnerFees).values(
      inputFees.map((f, index) => ({
        applicationId: application.id,
        feeType: f.feeType,
        feeName: f.feeName,
        defaultAmount: f.defaultAmount,
        actualAmount: f.actualAmount,
        sortOrder: index + 1,
      }))
    );
  } else {
    // 创建默认费用项目
    await db.insert(partnerFees).values([
      {
        applicationId: application.id,
        feeType: 'base',
        feeName: '友司围标支持基础费用',
        defaultAmount: '3000',
        actualAmount: '3000',
        notes: '固定支持费用，无特殊说明按默认标准',
        sortOrder: 1,
      },
      {
        applicationId: application.id,
        feeType: 'agent',
        feeName: '投标代理人出席投标费用',
        defaultAmount: '本地同城：300元/次，外地：面议',
        actualAmount: '0',
        notes: '本地同城或外地面议',
        sortOrder: 2,
      },
    ]);
  }

  // 创建待办：优先使用用户提交的待办，否则创建默认待办
  if (inputTodos && inputTodos.length > 0) {
    await db.insert(partnerTodos).values(
      inputTodos.map((t) => ({
        applicationId: application.id,
        title: t.title,
        assigneeId: input.handlerId,
        assigneeName: t.assigneeName || input.handlerName,
        deadline: t.deadline ? new Date(t.deadline) : input.materialDeadline,
        type: t.type,
      }))
    );
  } else {
    // 创建默认待办事项
    await db.insert(partnerTodos).values([
      {
        applicationId: application.id,
        title: '友司确认支持围标',
        assigneeId: input.handlerId,
        assigneeName: input.handlerName,
        deadline: input.materialDeadline,
        type: 'confirm',
      },
      {
        applicationId: application.id,
        title: '友司提交投标材料',
        assigneeId: input.handlerId,
        assigneeName: input.handlerName,
        deadline: input.materialDeadline,
        type: 'material',
      },
      {
        applicationId: application.id,
        title: '材料接收及审核',
        assigneeId: input.handlerId,
        assigneeName: input.handlerName,
        type: 'review',
      },
      {
        applicationId: application.id,
        title: '支持费用支付',
        assigneeId: input.handlerId,
        assigneeName: input.handlerName,
        type: 'payment',
      },
    ]);
  }

  return application;
}

export async function getPartnerApplicationById(id: number) {
  const application = await db.query.partnerApplications.findFirst({
    where: eq(partnerApplications.id, id),
    with: {
      handler: true,
      partnerCompany: true,
      materials: {
        orderBy: [asc(partnerMaterials.sortOrder)],
      },
      fees: {
        orderBy: [asc(partnerFees.sortOrder)],
      },
      reviews: {
        orderBy: [asc(partnerReviews.stage)],
      },
      todos: {
        orderBy: [asc(partnerTodos.createdAt)],
      },
    },
  });

  return application;
}

export async function updatePartnerApplication(id: number, input: UpdatePartnerApplicationInput) {
  const [application] = await db.update(partnerApplications)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(partnerApplications.id, id))
    .returning();

  return application;
}

export async function deletePartnerApplication(id: number) {
  await db.delete(partnerApplications).where(eq(partnerApplications.id, id));
}

export async function submitPartnerApplication(id: number) {
  const [application] = await db.update(partnerApplications)
    .set({
      status: 'pending_confirm',
      updatedAt: new Date(),
    })
    .where(eq(partnerApplications.id, id))
    .returning();

  return application;
}

// ============================================
// 友司材料服务
// ============================================

export async function createPartnerMaterial(input: CreatePartnerMaterialInput) {
  const [material] = await db.insert(partnerMaterials).values(input).returning();
  return material;
}

export async function updatePartnerMaterial(id: number, input: Partial<CreatePartnerMaterialInput>) {
  const updateData: any = { ...input, updatedAt: new Date() };
  
  // 如果确认材料，设置确认时间
  if (input.isConfirmed) {
    updateData.confirmedAt = new Date();
  }
  
  const [material] = await db.update(partnerMaterials)
    .set(updateData)
    .where(eq(partnerMaterials.id, id))
    .returning();
  return material;
}

export async function deletePartnerMaterial(id: number) {
  await db.delete(partnerMaterials).where(eq(partnerMaterials.id, id));
}

export async function getPartnerMaterials(applicationId: number) {
  return db.query.partnerMaterials.findMany({
    where: eq(partnerMaterials.applicationId, applicationId),
    orderBy: [asc(partnerMaterials.sortOrder)],
  });
}

// ============================================
// 友司费用服务
// ============================================

export async function createPartnerFee(input: CreatePartnerFeeInput) {
  const [fee] = await db.insert(partnerFees).values(input).returning();
  return fee;
}

export async function updatePartnerFee(id: number, input: Partial<CreatePartnerFeeInput>) {
  const [fee] = await db.update(partnerFees)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(partnerFees.id, id))
    .returning();
  return fee;
}

export async function deletePartnerFee(id: number) {
  await db.delete(partnerFees).where(eq(partnerFees.id, id));
}

export async function getPartnerFees(applicationId: number) {
  return db.query.partnerFees.findMany({
    where: eq(partnerFees.applicationId, applicationId),
    orderBy: [asc(partnerFees.sortOrder)],
  });
}

// ============================================
// 审核服务
// ============================================

export async function reviewPartnerApplication(
  applicationId: number,
  stage: 'material_completeness' | 'material_validity' | 'final',
  reviewerId: number,
  reviewerName: string,
  result: 'approved' | 'rejected',
  comment?: string
) {
  // 更新审核记录
  await db.update(partnerReviews)
    .set({
      reviewerId,
      reviewerName,
      result,
      comment,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(partnerReviews.applicationId, applicationId), eq(partnerReviews.stage, stage)));

  // 如果驳回，更新申请状态
  if (result === 'rejected') {
    await db.update(partnerApplications)
      .set({ status: 'terminated', updatedAt: new Date() })
      .where(eq(partnerApplications.id, applicationId));
    return;
  }

  // 检查是否所有环节都已通过
  const reviews = await db.query.partnerReviews.findMany({
    where: eq(partnerReviews.applicationId, applicationId),
  });

  const allApproved = reviews.every(r => r.result === 'approved');

  if (allApproved) {
    await db.update(partnerApplications)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(partnerApplications.id, applicationId));
  }
}

export async function getPartnerReviews(applicationId: number) {
  return db.query.partnerReviews.findMany({
    where: eq(partnerReviews.applicationId, applicationId),
    orderBy: [asc(partnerReviews.stage)],
  });
}

// ============================================
// 待办事项服务
// ============================================

export async function createPartnerTodo(input: {
  applicationId: number;
  title: string;
  assigneeId: number;
  assigneeName: string;
  deadline?: Date;
  type: string;
  notes?: string;
}) {
  const [todo] = await db.insert(partnerTodos).values(input).returning();
  return todo;
}

export async function updatePartnerTodo(id: number, input: {
  status?: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  notes?: string;
}) {
  const [todo] = await db.update(partnerTodos)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(partnerTodos.id, id))
    .returning();
  return todo;
}

export async function deletePartnerTodo(id: number) {
  await db.delete(partnerTodos).where(eq(partnerTodos.id, id));
}

export async function getPartnerTodos(applicationId: number) {
  return db.query.partnerTodos.findMany({
    where: eq(partnerTodos.applicationId, applicationId),
    orderBy: [asc(partnerTodos.createdAt)],
  });
}

// ============================================
// 列表查询服务
// ============================================

export interface GetPartnerApplicationsOptions {
  projectId?: number;
  status?: string;
  keyword?: string;
  handlerId?: number;
  page?: number;
  pageSize?: number;
}

export async function getPartnerApplications(options: GetPartnerApplicationsOptions = {}) {
  const { page = 1, pageSize = 20, projectId, status, keyword, handlerId } = options;

  const conditions = [];
  if (projectId) conditions.push(eq(partnerApplications.projectId, projectId));
  if (status) conditions.push(eq(partnerApplications.status, status as any));
  if (handlerId) conditions.push(eq(partnerApplications.handlerId, handlerId));
  if (keyword) {
    conditions.push(
      or(
        like(partnerApplications.applicationNo, `%${keyword}%`),
        like(partnerApplications.projectName, `%${keyword}%`),
        like(partnerApplications.handlerName, `%${keyword}%`),
        like(partnerApplications.partnerCompanyName, `%${keyword}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db.query.partnerApplications.findMany({
    where: whereClause,
    with: {
      handler: true,
      partnerCompany: true,
    },
    orderBy: [desc(partnerApplications.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const [{ count: total }] = await db
    .select({ count: count() })
    .from(partnerApplications)
    .where(whereClause);

  return { items, total };
}

export async function getPartnerApplicationStatistics(projectId?: number) {
  const conditions = projectId ? [eq(partnerApplications.projectId, projectId)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const stats = await db
    .select({
      status: partnerApplications.status,
      count: count(),
    })
    .from(partnerApplications)
    .where(whereClause)
    .groupBy(partnerApplications.status);

  const result = {
    total: 0,
    draft: 0,
    pending_confirm: 0,
    confirmed: 0,
    material_pending: 0,
    material_received: 0,
    completed: 0,
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

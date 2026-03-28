/**
 * 授权申请服务层
 */

import { db } from '@/db';
import {
  authorizationApplications,
  authorizationManufacturers,
  authorizationQualifications,
  authorizationSupportingDocs,
  authorizationDeliveries,
  authorizationReviews,
  authorizationTodos,
  companies,
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

export interface CreateApplicationInput {
  projectId: number;
  applicationDate?: Date;
  handlerId: number;
  handlerName: string;
  handlerPhone?: string;
  materialDeadline?: Date;
  supplementaryNotes?: string;
  projectName?: string;
  projectCode?: string;
  tenderOrganization?: string;
  submissionDeadline?: Date;
  interpretationFileId?: number;
}

export interface UpdateApplicationInput {
  applicationDate?: Date;
  handlerId?: number;
  handlerName?: string;
  handlerPhone?: string;
  materialDeadline?: Date;
  electronicMaterialReceivedAt?: Date;
  paperMaterialReceivedAt?: Date;
  allMaterialReceivedAt?: Date;
  supplementaryNotes?: string;
  trackingStatus?: 'not_tracked' | 'tracking' | 'completed';
  projectName?: string;
  projectCode?: string;
  tenderOrganization?: string;
  submissionDeadline?: Date;
  projectInfoChangeReason?: string;
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'material_pending' | 'material_received' | 'completed' | 'terminated';
}

export interface CreateManufacturerInput {
  applicationId: number;
  type: 'main' | 'partner';
  companyId?: number;
  manufacturerName: string;
  manufacturerAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  productName?: string;
  productConfig?: string;
  deviationType?: 'none' | 'positive' | 'negative';
  deviationNotes?: string;
  sortOrder?: number;
}

export interface CreateQualificationInput {
  manufacturerId: number;
  category: string;
  customCategoryName?: string;
  isProvided?: boolean;
  notes?: string;
  fileId?: number;
  fileUrl?: string;
  submitType?: 'upload' | 'offline';
  hasPerformance?: boolean;
  performanceType?: string[];
  performanceNotes?: string;
  performanceYear?: Date;
  validFrom?: Date;
  validTo?: Date;
  supplyCycle?: string;
  supplyCapacityNotes?: string;
  sortOrder?: number;
}

export interface CreateSupportingDocInput {
  manufacturerId: number;
  authorizationLetter?: string;
  authorizationLetterFileId?: number;
  supplyProof?: string;
  supplyProofFileId?: number;
  serviceCommitment?: string;
  serviceCommitmentNotes?: string;
  serviceCommitmentFileId?: number;
  validFrom?: Date;
  validTo?: Date;
  submitType?: 'upload' | 'offline';
}

export interface CreateDeliveryInput {
  applicationId: number;
  materialTypes: string[];
  deliveryMethod: 'upload' | 'offline' | 'mixed';
  shippingMethod?: string;
  trackingNumber?: string;
  customShippingMethod?: string;
  deliveredAt?: Date;
  receiverName?: string;
  receiverSignature?: string;
  receivedAt?: Date;
  logisticsVoucherFileId?: number;
  receiptVoucherFileId?: number;
}

export interface CreateReviewInput {
  applicationId: number;
  stage: 'completeness' | 'authenticity' | 'compliance' | 'final';
  reviewerId: number;
  reviewerName: string;
  result?: 'pending' | 'approved' | 'rejected';
  comment?: string;
  exceptionHandling?: string;
}

export interface CreateTodoInput {
  applicationId: number;
  title: string;
  assigneeId: number;
  assigneeName: string;
  deadline?: Date;
  status?: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  notes?: string;
  type: string;
}

// ============================================
// 授权申请服务
// ============================================

// 生成申请单编号
function generateApplicationNo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = generateRandomId(6);
  return `SQ${year}${month}${day}${random}`;
}

// 获取授权申请列表
export async function getApplications(params: {
  projectId?: number;
  status?: string;
  keyword?: string;
  handlerId?: number;
  page?: number;
  pageSize?: number;
}) {
  const { projectId, status, keyword, handlerId, page = 1, pageSize = 20 } = params;
  
  const conditions = [];
  if (projectId) {
    conditions.push(eq(authorizationApplications.projectId, projectId));
  }
  if (status) {
    conditions.push(eq(authorizationApplications.status, status as any));
  }
  if (handlerId) {
    conditions.push(eq(authorizationApplications.handlerId, handlerId));
  }
  if (keyword) {
    conditions.push(
      or(
        like(authorizationApplications.applicationNo, `%${keyword}%`),
        like(authorizationApplications.projectName, `%${keyword}%`),
        like(authorizationApplications.handlerName, `%${keyword}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 获取总数
  const [{ total }] = await db
    .select({ total: count() })
    .from(authorizationApplications)
    .where(whereClause);

  // 获取列表
  const offset = (page - 1) * pageSize;
  const list = await db
    .select({
      id: authorizationApplications.id,
      applicationNo: authorizationApplications.applicationNo,
      projectId: authorizationApplications.projectId,
      applicationDate: authorizationApplications.applicationDate,
      handlerId: authorizationApplications.handlerId,
      handlerName: authorizationApplications.handlerName,
      handlerPhone: authorizationApplications.handlerPhone,
      status: authorizationApplications.status,
      materialDeadline: authorizationApplications.materialDeadline,
      trackingStatus: authorizationApplications.trackingStatus,
      projectName: authorizationApplications.projectName,
      projectCode: authorizationApplications.projectCode,
      tenderOrganization: authorizationApplications.tenderOrganization,
      submissionDeadline: authorizationApplications.submissionDeadline,
      createdAt: authorizationApplications.createdAt,
      updatedAt: authorizationApplications.updatedAt,
    })
    .from(authorizationApplications)
    .where(whereClause)
    .orderBy(desc(authorizationApplications.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items: list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// 获取授权申请详情
export async function getApplicationById(id: number) {
  const [application] = await db
    .select()
    .from(authorizationApplications)
    .where(eq(authorizationApplications.id, id));

  if (!application) {
    return null;
  }

  // 获取厂家列表
  const manufacturers = await db
    .select()
    .from(authorizationManufacturers)
    .where(eq(authorizationManufacturers.applicationId, id))
    .orderBy(asc(authorizationManufacturers.sortOrder));

  // 获取每个厂家的资质材料和配套材料
  const manufacturersWithDetails = await Promise.all(
    manufacturers.map(async (mfr) => {
      const qualifications = await db
        .select()
        .from(authorizationQualifications)
        .where(eq(authorizationQualifications.manufacturerId, mfr.id))
        .orderBy(asc(authorizationQualifications.sortOrder));

      const [supportingDoc] = await db
        .select()
        .from(authorizationSupportingDocs)
        .where(eq(authorizationSupportingDocs.manufacturerId, mfr.id));

      return {
        ...mfr,
        qualifications,
        supportingDoc: supportingDoc || null,
      };
    })
  );

  // 获取交付记录
  const deliveries = await db
    .select()
    .from(authorizationDeliveries)
    .where(eq(authorizationDeliveries.applicationId, id))
    .orderBy(desc(authorizationDeliveries.createdAt));

  // 获取审核记录
  const reviews = await db
    .select()
    .from(authorizationReviews)
    .where(eq(authorizationReviews.applicationId, id))
    .orderBy(asc(authorizationReviews.stage));

  // 获取待办事项
  const todos = await db
    .select()
    .from(authorizationTodos)
    .where(eq(authorizationTodos.applicationId, id))
    .orderBy(asc(authorizationTodos.deadline));

  return {
    ...application,
    manufacturers: manufacturersWithDetails,
    deliveries,
    reviews,
    todos,
  };
}

// 创建授权申请
export async function createApplication(input: CreateApplicationInput & { createdBy: number }) {
  const applicationNo = generateApplicationNo();

  const [application] = await db
    .insert(authorizationApplications)
    .values({
      applicationNo,
      projectId: input.projectId,
      applicationDate: input.applicationDate || new Date(),
      handlerId: input.handlerId,
      handlerName: input.handlerName,
      handlerPhone: input.handlerPhone || null,
      status: 'draft',
      materialDeadline: input.materialDeadline || null,
      supplementaryNotes: input.supplementaryNotes || null,
      trackingStatus: 'not_tracked',
      projectName: input.projectName || null,
      projectCode: input.projectCode || null,
      tenderOrganization: input.tenderOrganization || null,
      submissionDeadline: input.submissionDeadline || null,
      interpretationFileId: input.interpretationFileId || null,
      createdBy: input.createdBy,
    })
    .returning();

  return application;
}

// 更新授权申请
export async function updateApplication(id: number, input: UpdateApplicationInput) {
  const updateData: any = {};
  
  if (input.applicationDate !== undefined) updateData.applicationDate = input.applicationDate;
  if (input.handlerId !== undefined) updateData.handlerId = input.handlerId;
  if (input.handlerName !== undefined) updateData.handlerName = input.handlerName;
  if (input.handlerPhone !== undefined) updateData.handlerPhone = input.handlerPhone;
  if (input.materialDeadline !== undefined) updateData.materialDeadline = input.materialDeadline;
  if (input.electronicMaterialReceivedAt !== undefined) updateData.electronicMaterialReceivedAt = input.electronicMaterialReceivedAt;
  if (input.paperMaterialReceivedAt !== undefined) updateData.paperMaterialReceivedAt = input.paperMaterialReceivedAt;
  if (input.allMaterialReceivedAt !== undefined) updateData.allMaterialReceivedAt = input.allMaterialReceivedAt;
  if (input.supplementaryNotes !== undefined) updateData.supplementaryNotes = input.supplementaryNotes;
  if (input.trackingStatus !== undefined) updateData.trackingStatus = input.trackingStatus;
  if (input.projectName !== undefined) updateData.projectName = input.projectName;
  if (input.projectCode !== undefined) updateData.projectCode = input.projectCode;
  if (input.tenderOrganization !== undefined) updateData.tenderOrganization = input.tenderOrganization;
  if (input.submissionDeadline !== undefined) updateData.submissionDeadline = input.submissionDeadline;
  if (input.projectInfoChangeReason !== undefined) updateData.projectInfoChangeReason = input.projectInfoChangeReason;
  if (input.status !== undefined) updateData.status = input.status;
  
  updateData.updatedAt = new Date();

  const [application] = await db
    .update(authorizationApplications)
    .set(updateData)
    .where(eq(authorizationApplications.id, id))
    .returning();

  return application;
}

// 删除授权申请
export async function deleteApplication(id: number) {
  await db.delete(authorizationApplications).where(eq(authorizationApplications.id, id));
  return { success: true };
}

// 获取申请统计
export async function getApplicationStatistics(projectId?: number) {
  const conditions = projectId ? [eq(authorizationApplications.projectId, projectId)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const stats = await db
    .select({
      status: authorizationApplications.status,
      count: count(),
    })
    .from(authorizationApplications)
    .where(whereClause)
    .groupBy(authorizationApplications.status);

  const result: Record<string, number> = {
    total: 0,
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    material_pending: 0,
    material_received: 0,
    completed: 0,
    terminated: 0,
  };

  stats.forEach((stat: { status: string; count: number }) => {
    result[stat.status] = stat.count;
    result.total += stat.count;
  });

  return result;
}

// ============================================
// 厂家管理服务
// ============================================

export async function getManufacturers(applicationId: number) {
  return db
    .select()
    .from(authorizationManufacturers)
    .where(eq(authorizationManufacturers.applicationId, applicationId))
    .orderBy(asc(authorizationManufacturers.sortOrder));
}

export async function createManufacturer(input: CreateManufacturerInput) {
  const [manufacturer] = await db
    .insert(authorizationManufacturers)
    .values({
      applicationId: input.applicationId,
      type: input.type,
      companyId: input.companyId || null,
      manufacturerName: input.manufacturerName,
      manufacturerAddress: input.manufacturerAddress || null,
      contactPerson: input.contactPerson || null,
      contactPhone: input.contactPhone || null,
      productName: input.productName || null,
      productConfig: input.productConfig || null,
      deviationType: input.deviationType || 'none',
      deviationNotes: input.deviationNotes || null,
      sortOrder: input.sortOrder || 0,
    })
    .returning();

  // 创建配套材料记录
  await db.insert(authorizationSupportingDocs).values({
    manufacturerId: manufacturer.id,
  });

  return manufacturer;
}

export async function updateManufacturer(id: number, input: Partial<CreateManufacturerInput>) {
  const [manufacturer] = await db
    .update(authorizationManufacturers)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(authorizationManufacturers.id, id))
    .returning();

  return manufacturer;
}

export async function deleteManufacturer(id: number) {
  await db.delete(authorizationManufacturers).where(eq(authorizationManufacturers.id, id));
  return { success: true };
}

// ============================================
// 资质材料服务
// ============================================

export async function getQualifications(manufacturerId: number) {
  return db
    .select()
    .from(authorizationQualifications)
    .where(eq(authorizationQualifications.manufacturerId, manufacturerId))
    .orderBy(asc(authorizationQualifications.sortOrder));
}

export async function createQualification(input: CreateQualificationInput) {
  const [qualification] = await db
    .insert(authorizationQualifications)
    .values({
      manufacturerId: input.manufacturerId,
      category: input.category,
      customCategoryName: input.customCategoryName || null,
      isProvided: input.isProvided ?? false,
      notes: input.notes || null,
      fileId: input.fileId || null,
      fileUrl: input.fileUrl || null,
      submitType: input.submitType || 'upload',
      hasPerformance: input.hasPerformance ?? false,
      performanceType: input.performanceType ? JSON.stringify(input.performanceType) : null,
      performanceNotes: input.performanceNotes || null,
      performanceYear: input.performanceYear || null,
      validFrom: input.validFrom || null,
      validTo: input.validTo || null,
      supplyCycle: input.supplyCycle || null,
      supplyCapacityNotes: input.supplyCapacityNotes || null,
      sortOrder: input.sortOrder || 0,
    })
    .returning();

  return qualification;
}

export async function updateQualification(id: number, input: Partial<CreateQualificationInput>) {
  const updateData: any = { ...input, updatedAt: new Date() };
  if (input.performanceType) {
    updateData.performanceType = JSON.stringify(input.performanceType);
  }

  const [qualification] = await db
    .update(authorizationQualifications)
    .set(updateData)
    .where(eq(authorizationQualifications.id, id))
    .returning();

  return qualification;
}

export async function deleteQualification(id: number) {
  await db.delete(authorizationQualifications).where(eq(authorizationQualifications.id, id));
  return { success: true };
}

// ============================================
// 配套材料服务
// ============================================

export async function getSupportingDoc(manufacturerId: number) {
  const [doc] = await db
    .select()
    .from(authorizationSupportingDocs)
    .where(eq(authorizationSupportingDocs.manufacturerId, manufacturerId));
  return doc || null;
}

export async function updateSupportingDoc(manufacturerId: number, input: Partial<CreateSupportingDocInput>) {
  const [doc] = await db
    .update(authorizationSupportingDocs)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(authorizationSupportingDocs.manufacturerId, manufacturerId))
    .returning();

  return doc;
}

export async function confirmSupportingDoc(manufacturerId: number) {
  const [doc] = await db
    .update(authorizationSupportingDocs)
    .set({
      isConfirmed: true,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(authorizationSupportingDocs.manufacturerId, manufacturerId))
    .returning();

  return doc;
}

// ============================================
// 交付记录服务
// ============================================

export async function getDeliveries(applicationId: number) {
  return db
    .select()
    .from(authorizationDeliveries)
    .where(eq(authorizationDeliveries.applicationId, applicationId))
    .orderBy(desc(authorizationDeliveries.createdAt));
}

export async function createDelivery(input: CreateDeliveryInput & { createdBy: number }) {
  const [delivery] = await db
    .insert(authorizationDeliveries)
    .values({
      applicationId: input.applicationId,
      materialTypes: JSON.stringify(input.materialTypes),
      deliveryMethod: input.deliveryMethod,
      shippingMethod: input.shippingMethod || null,
      trackingNumber: input.trackingNumber || null,
      customShippingMethod: input.customShippingMethod || null,
      deliveredAt: input.deliveredAt || null,
      receiverName: input.receiverName || null,
      receiverSignature: input.receiverSignature || null,
      receivedAt: input.receivedAt || null,
      logisticsVoucherFileId: input.logisticsVoucherFileId || null,
      receiptVoucherFileId: input.receiptVoucherFileId || null,
      createdBy: input.createdBy,
    })
    .returning();

  return delivery;
}

export async function updateDelivery(id: number, input: Partial<CreateDeliveryInput>) {
  const updateData: any = { ...input, updatedAt: new Date() };
  if (input.materialTypes) {
    updateData.materialTypes = JSON.stringify(input.materialTypes);
  }

  const [delivery] = await db
    .update(authorizationDeliveries)
    .set(updateData)
    .where(eq(authorizationDeliveries.id, id))
    .returning();

  return delivery;
}

// ============================================
// 审核服务
// ============================================

export async function getReviews(applicationId: number) {
  return db
    .select()
    .from(authorizationReviews)
    .where(eq(authorizationReviews.applicationId, applicationId))
    .orderBy(asc(authorizationReviews.stage));
}

export async function createReview(input: CreateReviewInput) {
  const [review] = await db
    .insert(authorizationReviews)
    .values({
      applicationId: input.applicationId,
      stage: input.stage,
      reviewerId: input.reviewerId,
      reviewerName: input.reviewerName,
      result: input.result || 'pending',
      comment: input.comment || null,
      exceptionHandling: input.exceptionHandling || null,
    })
    .returning();

  return review;
}

export async function submitReview(id: number, result: 'approved' | 'rejected', comment?: string, exceptionHandling?: string) {
  const [review] = await db
    .update(authorizationReviews)
    .set({
      result,
      comment: comment || null,
      exceptionHandling: exceptionHandling || null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(authorizationReviews.id, id))
    .returning();

  // 更新申请状态
  const [reviewData] = await db
    .select()
    .from(authorizationReviews)
    .where(eq(authorizationReviews.id, id));

  if (reviewData) {
    if (result === 'approved') {
      // 如果是最终审核通过，更新为授权完成
      if (reviewData.stage === 'final') {
        await updateApplication(reviewData.applicationId, { status: 'completed' });
      } else {
        // 否则检查是否所有审核都通过
        const allReviews = await getReviews(reviewData.applicationId);
        const allApproved = allReviews.every((r: { result: string }) => r.result === 'approved');
        if (allApproved) {
          await updateApplication(reviewData.applicationId, { status: 'material_pending' });
        }
      }
    } else if (result === 'rejected') {
      await updateApplication(reviewData.applicationId, { status: 'rejected' });
    }
  }

  return review;
}

// ============================================
// 待办事项服务
// ============================================

export async function getTodos(applicationId: number) {
  return db
    .select()
    .from(authorizationTodos)
    .where(eq(authorizationTodos.applicationId, applicationId))
    .orderBy(asc(authorizationTodos.deadline));
}

export async function createTodo(input: CreateTodoInput) {
  const [todo] = await db
    .insert(authorizationTodos)
    .values({
      applicationId: input.applicationId,
      title: input.title,
      assigneeId: input.assigneeId,
      assigneeName: input.assigneeName,
      deadline: input.deadline || null,
      status: input.status || 'not_started',
      notes: input.notes || null,
      type: input.type,
    })
    .returning();

  return todo;
}

export async function updateTodoStatus(id: number, status: 'not_started' | 'in_progress' | 'completed' | 'overdue', notes?: string) {
  const [todo] = await db
    .update(authorizationTodos)
    .set({
      status,
      notes: notes || null,
      updatedAt: new Date(),
    })
    .where(eq(authorizationTodos.id, id))
    .returning();

  return todo;
}

export async function deleteTodo(id: number) {
  await db.delete(authorizationTodos).where(eq(authorizationTodos.id, id));
  return { success: true };
}

// 提交申请
export async function submitApplication(id: number) {
  // 创建审核记录
  const application = await getApplicationById(id);
  if (!application) {
    throw new Error('申请不存在');
  }

  // 删除已有的审核记录
  await db.delete(authorizationReviews).where(eq(authorizationReviews.applicationId, id));

  // 创建四个审核环节
  const stages: Array<'completeness' | 'authenticity' | 'compliance' | 'final'> = [
    'completeness',
    'authenticity',
    'compliance',
    'final',
  ];

  for (const stage of stages) {
    await createReview({
      applicationId: id,
      stage,
      reviewerId: application.handlerId, // 默认经办人，可后续修改
      reviewerName: application.handlerName,
      result: 'pending',
    });
  }

  // 创建待办事项
  await createTodo({
    applicationId: id,
    title: '材料提交及完善',
    assigneeId: application.handlerId,
    assigneeName: application.handlerName,
    deadline: application.materialDeadline || undefined,
    type: 'material_submit',
  });

  // 更新状态
  return updateApplication(id, { status: 'pending_review' });
}

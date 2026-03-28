/**
 * 知识入库审批服务
 * 提供知识条目的提交审批、审批处理、审批历史等功能
 */

import { db } from '@/db';
import {
  knowledgeItems,
  knowledgeApprovalRequests,
  knowledgeApprovalSteps,
  knowledgeApprovalConfigs,
  users,
  notifications,
} from '@/db/schema';
import { eq, and, desc, inArray, isNull } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface ApprovalRequestParams {
  itemId: number;
  requesterId: number;
  reason?: string;
}

export interface ApprovalStepParams {
  requestId: number;
  reviewerId: number;
  action: 'approve' | 'reject' | 'return';
  comment?: string;
}

export interface ApprovalConfigParams {
  categoryId: number;
  reviewers: number[]; // 审批人ID列表
  requireAllApprove: boolean; // 是否需要所有人审批
  minApprovals: number; // 最少审批人数
}

export interface ApprovalRequestInfo {
  id: number;
  itemId: number;
  itemTitle: string;
  requesterId: number;
  requesterName: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  reason: string | null;
  createdAt: Date;
  steps: ApprovalStepInfo[];
}

export interface ApprovalStepInfo {
  id: number;
  stepOrder: number;
  reviewerId: number;
  reviewerName: string;
  action: string | null;
  comment: string | null;
  createdAt: Date;
  actedAt: Date | null;
}

// ============================================
// 审批配置服务
// ============================================

/**
 * 获取分类的审批配置
 */
export async function getApprovalConfig(categoryId: number) {
  const config = await db
    .select()
    .from(knowledgeApprovalConfigs)
    .where(eq(knowledgeApprovalConfigs.categoryId, categoryId))
    .limit(1);

  return config.length > 0 ? config[0] : null;
}

/**
 * 设置分类审批配置
 */
export async function setApprovalConfig(
  categoryId: number,
  params: ApprovalConfigParams
): Promise<void> {
  const existing = await getApprovalConfig(categoryId);

  if (existing) {
    await db
      .update(knowledgeApprovalConfigs)
      .set({
        reviewers: JSON.stringify(params.reviewers),
        requireAllApprove: params.requireAllApprove,
        minApprovals: params.minApprovals,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeApprovalConfigs.id, existing.id));
  } else {
    await db.insert(knowledgeApprovalConfigs).values({
      categoryId,
      reviewers: JSON.stringify(params.reviewers),
      requireAllApprove: params.requireAllApprove,
      minApprovals: params.minApprovals,
    });
  }
}

// ============================================
// 审批流程服务
// ============================================

/**
 * 提交审批申请
 */
export async function submitApprovalRequest(
  params: ApprovalRequestParams
): Promise<number> {
  const { itemId, requesterId, reason } = params;

  // 1. 检查知识条目状态
  const item = await db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.id, itemId))
    .limit(1);

  if (item.length === 0) {
    throw new Error('知识条目不存在');
  }

  if (item[0].status !== 'draft' && item[0].status !== 'rejected') {
    throw new Error('当前状态不允许提交审批');
  }

  // 2. 检查是否已有待处理的审批
  const existingRequest = await db
    .select()
    .from(knowledgeApprovalRequests)
    .where(
      and(
        eq(knowledgeApprovalRequests.itemId, itemId),
        eq(knowledgeApprovalRequests.status, 'pending')
      )
    )
    .limit(1);

  if (existingRequest.length > 0) {
    throw new Error('该条目已有待处理的审批申请');
  }

  // 3. 获取审批配置
  const config = await getApprovalConfig(item[0].categoryId);

  if (!config) {
    // 如果没有配置，直接通过
    await db
      .update(knowledgeItems)
      .set({
        status: 'approved',
        reviewerId: requesterId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeItems.id, itemId));

    return 0;
  }

  // 4. 创建审批申请
  const reviewers = JSON.parse(config.reviewers as string) as number[];
  const totalSteps = reviewers.length;

  const [request] = await db
    .insert(knowledgeApprovalRequests)
    .values({
      itemId,
      requesterId,
      reason,
      status: 'pending',
      currentStep: 1,
      totalSteps,
    })
    .returning();

  // 5. 创建审批步骤
  for (let i = 0; i < reviewers.length; i++) {
    await db.insert(knowledgeApprovalSteps).values({
      requestId: request.id,
      stepOrder: i + 1,
      reviewerId: reviewers[i],
      status: i === 0 ? 'pending' : 'waiting',
    });
  }

  // 6. 更新知识条目状态
  await db
    .update(knowledgeItems)
    .set({
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(knowledgeItems.id, itemId));

  // 7. 发送通知给第一个审批人
  const firstReviewer = await db
    .select({ name: users.realName })
    .from(users)
    .where(eq(users.id, reviewers[0]))
    .limit(1);

  await db.insert(notifications).values({
    userId: reviewers[0],
    type: 'approval_request',
    title: '知识入库审批请求',
    content: `您有一个新的知识入库审批请求：${item[0].title}`,
    relatedType: 'knowledge_approval',
    relatedId: request.id,
    isRead: false,
  });

  return request.id;
}

/**
 * 处理审批步骤
 */
export async function processApprovalStep(
  params: ApprovalStepParams
): Promise<{ status: string; message: string }> {
  const { requestId, reviewerId, action, comment } = params;

  // 1. 获取审批申请
  const request = await db
    .select()
    .from(knowledgeApprovalRequests)
    .where(eq(knowledgeApprovalRequests.id, requestId))
    .limit(1);

  if (request.length === 0) {
    throw new Error('审批申请不存在');
  }

  if (request[0].status !== 'pending') {
    throw new Error('该审批申请已处理完成');
  }

  // 2. 获取当前步骤
  const currentStep = await db
    .select()
    .from(knowledgeApprovalSteps)
    .where(
      and(
        eq(knowledgeApprovalSteps.requestId, requestId),
        eq(knowledgeApprovalSteps.stepOrder, request[0].currentStep)
      )
    )
    .limit(1);

  if (currentStep.length === 0) {
    throw new Error('当前审批步骤不存在');
  }

  if (currentStep[0].reviewerId !== reviewerId) {
    throw new Error('您不是当前步骤的审批人');
  }

  if (currentStep[0].status !== 'pending') {
    throw new Error('该步骤已处理');
  }

  // 3. 更新步骤状态
  await db
    .update(knowledgeApprovalSteps)
    .set({
      status: action,
      action,
      comment,
      actedAt: new Date(),
    })
    .where(eq(knowledgeApprovalSteps.id, currentStep[0].id));

  // 4. 根据动作处理审批流程
  if (action === 'reject') {
    // 拒绝：直接结束审批
    await db
      .update(knowledgeApprovalRequests)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(knowledgeApprovalRequests.id, requestId));

    await db
      .update(knowledgeItems)
      .set({
        status: 'rejected',
        reviewerId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeItems.id, request[0].itemId));

    // 通知申请人
    await db.insert(notifications).values({
      userId: request[0].requesterId,
      type: 'approval_result',
      title: '知识入库审批被拒绝',
      content: `您的知识入库申请已被拒绝：${comment || '无说明'}`,
      relatedType: 'knowledge_item',
      relatedId: request[0].itemId,
      isRead: false,
    });

    return { status: 'rejected', message: '审批已拒绝' };
  }

  if (action === 'return') {
    // 退回：退回给申请人修改
    await db
      .update(knowledgeApprovalRequests)
      .set({
        status: 'returned',
        updatedAt: new Date(),
      })
      .where(eq(knowledgeApprovalRequests.id, requestId));

    await db
      .update(knowledgeItems)
      .set({
        status: 'draft',
        updatedAt: new Date(),
      })
      .where(eq(knowledgeItems.id, request[0].itemId));

    // 通知申请人
    await db.insert(notifications).values({
      userId: request[0].requesterId,
      type: 'approval_result',
      title: '知识入库申请被退回',
      content: `您的知识入库申请已被退回修改：${comment || '无说明'}`,
      relatedType: 'knowledge_item',
      relatedId: request[0].itemId,
      isRead: false,
    });

    return { status: 'returned', message: '审批已退回' };
  }

  // 通过：检查是否还有后续步骤
  const nextStep = request[0].currentStep + 1;

  if (nextStep <= request[0].totalSteps) {
    // 还有后续步骤
    await db
      .update(knowledgeApprovalRequests)
      .set({
        currentStep: nextStep,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeApprovalRequests.id, requestId));

    // 更新下一步状态
    await db
      .update(knowledgeApprovalSteps)
      .set({ status: 'pending' })
      .where(
        and(
          eq(knowledgeApprovalSteps.requestId, requestId),
          eq(knowledgeApprovalSteps.stepOrder, nextStep)
        )
      );

    // 获取下一步审批人并发送通知
    const nextStepRecord = await db
      .select()
      .from(knowledgeApprovalSteps)
      .where(
        and(
          eq(knowledgeApprovalSteps.requestId, requestId),
          eq(knowledgeApprovalSteps.stepOrder, nextStep)
        )
      )
      .limit(1);

    if (nextStepRecord.length > 0) {
      await db.insert(notifications).values({
        userId: nextStepRecord[0].reviewerId,
        type: 'approval_request',
        title: '知识入库审批请求',
        content: `您有一个新的知识入库审批请求需要处理`,
        relatedType: 'knowledge_approval',
        relatedId: requestId,
        isRead: false,
      });
    }

    return { status: 'pending', message: '已通过，等待下一级审批' };
  } else {
    // 所有步骤完成，最终通过
    await db
      .update(knowledgeApprovalRequests)
      .set({
        status: 'approved',
        updatedAt: new Date(),
      })
      .where(eq(knowledgeApprovalRequests.id, requestId));

    await db
      .update(knowledgeItems)
      .set({
        status: 'approved',
        reviewerId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeItems.id, request[0].itemId));

    // 通知申请人
    await db.insert(notifications).values({
      userId: request[0].requesterId,
      type: 'approval_result',
      title: '知识入库审批通过',
      content: `您的知识入库申请已通过审批`,
      relatedType: 'knowledge_item',
      relatedId: request[0].itemId,
      isRead: false,
    });

    return { status: 'approved', message: '审批已通过' };
  }
}

/**
 * 获取审批申请详情
 */
export async function getApprovalRequest(
  requestId: number
): Promise<ApprovalRequestInfo | null> {
  const request = await db
    .select()
    .from(knowledgeApprovalRequests)
    .where(eq(knowledgeApprovalRequests.id, requestId))
    .limit(1);

  if (request.length === 0) {
    return null;
  }

  const item = await db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.id, request[0].itemId))
    .limit(1);

  const requester = await db
    .select()
    .from(users)
    .where(eq(users.id, request[0].requesterId))
    .limit(1);

  const steps = await db
    .select()
    .from(knowledgeApprovalSteps)
    .where(eq(knowledgeApprovalSteps.requestId, requestId))
    .orderBy(knowledgeApprovalSteps.stepOrder);

  const stepsWithReviewer = await Promise.all(
    steps.map(async (step) => {
      const reviewer = await db
        .select()
        .from(users)
        .where(eq(users.id, step.reviewerId))
        .limit(1);

      return {
        id: step.id,
        stepOrder: step.stepOrder,
        reviewerId: step.reviewerId,
        reviewerName: reviewer[0]?.realName || '未知',
        action: step.action,
        comment: step.comment,
        createdAt: step.createdAt,
        actedAt: step.actedAt,
      } as ApprovalStepInfo;
    })
  );

  return {
    id: request[0].id,
    itemId: request[0].itemId,
    itemTitle: item[0]?.title || '',
    requesterId: request[0].requesterId,
    requesterName: requester[0]?.realName || '未知',
    status: request[0].status,
    currentStep: request[0].currentStep,
    totalSteps: request[0].totalSteps,
    reason: request[0].reason,
    createdAt: request[0].createdAt,
    steps: stepsWithReviewer,
  };
}

/**
 * 获取待审批列表
 */
export async function getPendingApprovals(reviewerId: number) {
  const pendingSteps = await db
    .select({
      step: knowledgeApprovalSteps,
      request: knowledgeApprovalRequests,
    })
    .from(knowledgeApprovalSteps)
    .innerJoin(
      knowledgeApprovalRequests,
      eq(knowledgeApprovalSteps.requestId, knowledgeApprovalRequests.id)
    )
    .where(
      and(
        eq(knowledgeApprovalSteps.reviewerId, reviewerId),
        eq(knowledgeApprovalSteps.status, 'pending'),
        eq(knowledgeApprovalRequests.status, 'pending')
      )
    )
    .orderBy(desc(knowledgeApprovalSteps.createdAt));

  const items = await Promise.all(
    pendingSteps.map(async ({ step, request }) => {
      const item = await db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.id, request.itemId))
        .limit(1);

      const requester = await db
        .select()
        .from(users)
        .where(eq(users.id, request.requesterId))
        .limit(1);

      return {
        stepId: step.id,
        requestId: request.id,
        itemId: request.itemId,
        itemTitle: item[0]?.title || '',
        requesterName: requester[0]?.realName || '未知',
        stepOrder: step.stepOrder,
        currentStep: request.currentStep,
        totalSteps: request.totalSteps,
        createdAt: request.createdAt,
      };
    })
  );

  return items;
}

/**
 * 获取我提交的审批列表
 */
export async function getMyApprovalRequests(requesterId: number) {
  const requests = await db
    .select()
    .from(knowledgeApprovalRequests)
    .where(eq(knowledgeApprovalRequests.requesterId, requesterId))
    .orderBy(desc(knowledgeApprovalRequests.createdAt));

  return requests;
}

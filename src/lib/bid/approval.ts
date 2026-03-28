/**
 * 审核流程服务
 * 提供四级审核流程管理功能
 */

import { db } from '@/db';
import {
  approvalFlows,
  approvalRecords,
  bidDocuments,
  projectMembers,
  users,
  auditLogs,
} from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { AppError } from '@/lib/api/error-handler';
import { ApprovalLevel, ApprovalStatus } from '@/types/bid';
import { createAuditLog } from '@/lib/audit/service';
import {
  getDocumentById,
  updateDocumentStatus,
  APPROVAL_LEVEL_ORDER,
} from './documents-service';

// ============================================
// 类型定义
// ============================================

export type ApprovalAction = 'submit' | 'approve' | 'reject' | 'withdraw';

export interface ApprovalFlowConfig {
  documentId: number;
  levels: {
    level: ApprovalLevel;
    assigneeId: number;
    dueDate?: Date;
  }[];
  createdBy: number;
}

// ============================================
// 审核流程服务
// ============================================

/**
 * 创建审核流程
 */
export async function createApprovalFlow(
  config: ApprovalFlowConfig
): Promise<number> {
  // 检查是否已存在待审核流程
  const existing = await db
    .select()
    .from(approvalFlows)
    .where(
      and(
        eq(approvalFlows.documentId, config.documentId),
        eq(approvalFlows.status, 'pending')
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw AppError.conflict('该文档已存在待审核流程');
  }

  return await db.transaction(async (tx) => {
    // 创建各级审核
    for (const levelConfig of config.levels) {
      await tx.insert(approvalFlows).values({
        documentId: config.documentId,
        level: levelConfig.level as any,
        status: 'pending',
        assigneeId: levelConfig.assigneeId,
        dueDate: levelConfig.dueDate || null,
        createdBy: config.createdBy,
      });
    }

    // 记录审计日志
    await tx.insert(auditLogs).values({
      userId: config.createdBy,
      action: 'create',
      resource: 'document',
      resourceId: config.documentId,
      description: `发起了文档审核流程`,
    });

    return config.documentId;
  });
}

/**
 * 提交审核
 */
export async function submitForApproval(
  documentId: number,
  submitterId: number
): Promise<void> {
  // 获取文档信息
  const doc = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  if (doc.length === 0) {
    throw AppError.notFound('文档');
  }

  // 验证提交人权限 (需有编辑权限)
  const submitterMember = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, doc[0].projectId),
        eq(projectMembers.userId, submitterId)
      )
    )
    .limit(1);

  if (submitterMember.length === 0 || !submitterMember[0].canEdit) {
    throw AppError.forbidden('您没有提交该文档审核的权限');
  }

  // 获取项目成员（审核人）
  const members = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, doc[0].projectId),
        eq(projectMembers.canAudit, true)
      )
    );

  if (members.length === 0) {
    throw new Error('项目缺少审核人');
  }

  // 映射审核级别
  const levelMap: Record<number, ApprovalLevel> = {
    0: 'first',
    1: 'second',
    2: 'third',
    3: 'final',
  };

  // 分配审核人（最多4级）
  const levels = members.slice(0, 4).map((m, index) => ({
    level: levelMap[index] || 'first',
    assigneeId: m.userId,
  }));

  await db.transaction(async (tx) => {
    await createApprovalFlow({
      documentId,
      levels,
      createdBy: submitterId,
    });

    // 更新文档状态为审核中
    await tx
      .update(bidDocuments)
      .set({
        status: 'reviewing',
        currentApprovalLevel: 'first',
      })
      .where(eq(bidDocuments.id, documentId));

    // 记录审计日志
    await tx.insert(auditLogs).values({
      userId: submitterId,
      action: 'update',
      resource: 'document',
      resourceId: documentId,
      description: `提交了文档审核申请`,
    });
  });
}

/**
 * 执行审批操作
 */
export async function executeApproval(
  documentId: number,
  userId: number,
  level: ApprovalLevel,
  action: 'approve' | 'reject',
  comment?: string
): Promise<void> {
  // 获取当前级别的审核流程
  const flow = await db
    .select()
    .from(approvalFlows)
    .where(
      and(
        eq(approvalFlows.documentId, documentId),
        eq(approvalFlows.level, level),
        eq(approvalFlows.status, 'pending')
      )
    )
    .limit(1);

  if (flow.length === 0) {
    throw new Error('未找到待审核记录');
  }

  // 验证权限
  if (flow[0].assigneeId !== userId) {
    throw new Error('您不是当前级别的审批人');
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    if (action === 'approve') {
      // 更新审核流程状态
      await tx
        .update(approvalFlows)
        .set({
          status: 'approved',
          completedAt: now,
          comment: comment || null,
        })
        .where(eq(approvalFlows.id, flow[0].id));

      // 创建审核记录
      await tx.insert(approvalRecords).values({
        flowId: flow[0].id,
        status: 'approved',
        comment: comment || null,
        reviewerId: userId,
      });

      // 检查是否有下一级
      const nextLevel = getNextLevel(level);
      const nextFlow = await tx
        .select()
        .from(approvalFlows)
        .where(
          and(
            eq(approvalFlows.documentId, documentId),
            eq(approvalFlows.level, nextLevel)
          )
        )
        .limit(1);

      if (nextFlow.length > 0) {
        // 进入下一级
        await tx
          .update(bidDocuments)
          .set({
            currentApprovalLevel: nextLevel,
          })
          .where(eq(bidDocuments.id, documentId));
      } else {
        // 全部通过
        await tx
          .update(bidDocuments)
          .set({
            status: 'approved',
            currentApprovalLevel: null,
          })
          .where(eq(bidDocuments.id, documentId));
      }
    } else if (action === 'reject') {
      // 更新审核流程状态
      await tx
        .update(approvalFlows)
        .set({
          status: 'rejected',
          completedAt: now,
          comment: comment || '审核不通过',
        })
        .where(eq(approvalFlows.id, flow[0].id));

      // 创建审核记录
      await tx.insert(approvalRecords).values({
        flowId: flow[0].id,
        status: 'rejected',
        comment: comment || '审核不通过',
        reviewerId: userId,
      });

      // 更新文档状态
      await tx
        .update(bidDocuments)
        .set({
          status: 'rejected',
          currentApprovalLevel: null,
        })
        .where(eq(bidDocuments.id, documentId));
    }

    // 记录审计日志
    await tx.insert(auditLogs).values({
      userId,
      action: action === 'approve' ? 'approve' : 'reject',
      resource: 'document',
      resourceId: documentId,
      description: `审批了文档节点: ${level}, 结果: ${action}`,
    });
  });
}

/**
 * 获取下一级审核
 */
function getNextLevel(currentLevel: ApprovalLevel): ApprovalLevel {
  const currentIndex = APPROVAL_LEVEL_ORDER.indexOf(currentLevel);
  return currentIndex < APPROVAL_LEVEL_ORDER.length - 1 ? APPROVAL_LEVEL_ORDER[currentIndex + 1] : currentLevel;
}

/**
 * 获取待审批列表
 */
export async function getPendingApprovals(userId: number): Promise<
  (typeof approvalFlows.$inferSelect & {
    document: typeof bidDocuments.$inferSelect | null;
  })[]
> {
  // 获取待审批流程
  const flows = await db
    .select()
    .from(approvalFlows)
    .where(
      and(
        eq(approvalFlows.assigneeId, userId),
        eq(approvalFlows.status, 'pending')
      )
    )
    .orderBy(desc(approvalFlows.createdAt));

  if (flows.length === 0) {
    return [];
  }

  // 获取文档信息
  const documentIds = [...new Set(flows.map((f) => f.documentId))];
  const docs = await db
    .select()
    .from(bidDocuments)
    .where(inArray(bidDocuments.id, documentIds));

  const docMap = new Map(docs.map((d) => [d.id, d]));

  return flows.map((flow) => ({
    ...flow,
    document: docMap.get(flow.documentId) || null,
  }));
}

/**
 * 获取审核流程详情
 */
export async function getApprovalFlowDetail(documentId: number): Promise<{
  flows: (typeof approvalFlows.$inferSelect)[];
  records: (typeof approvalRecords.$inferSelect)[];
}> {
  const flows = await db
    .select()
    .from(approvalFlows)
    .where(eq(approvalFlows.documentId, documentId));

  if (flows.length === 0) {
    return { flows: [], records: [] };
  }

  const flowIds = flows.map((f) => f.id);
  const records = await db
    .select()
    .from(approvalRecords)
    .where(inArray(approvalRecords.flowId, flowIds));

  return { flows, records };
}

/**
 * 获取文档的当前审核流程
 */
export async function getDocumentApprovalFlow(
  documentId: number
): Promise<typeof approvalFlows.$inferSelect | null> {
  const flow = await db
    .select()
    .from(approvalFlows)
    .where(eq(approvalFlows.documentId, documentId))
    .orderBy(desc(approvalFlows.createdAt))
    .limit(1);

  return flow.length > 0 ? flow[0] : null;
}

/**
 * 撤回审核
 */
export async function withdrawApproval(
  documentId: number,
  userId: number
): Promise<void> {
  // 验证是否是创建者
  const doc = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  if (doc.length === 0 || doc[0].createdBy !== userId) {
    throw new Error('无权撤回');
  }

  // 更新所有待审核流程为退回
  await db
    .update(approvalFlows)
    .set({ status: 'returned' })
    .where(
      and(
        eq(approvalFlows.documentId, documentId),
        eq(approvalFlows.status, 'pending')
      )
    );

  // 更新文档状态
  await db
    .update(bidDocuments)
    .set({
      status: 'draft',
      currentApprovalLevel: null,
    })
    .where(eq(bidDocuments.id, documentId));
}

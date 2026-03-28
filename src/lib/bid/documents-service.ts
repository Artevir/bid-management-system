/**
 * 投标文档统一服务层
 * 整合投标文档相关的所有功能
 */

import { db } from '@/db';
import {
  bidDocuments,
  bidChapters,
  docFrameworks,
  approvalFlows,
  documentGenerationHistories,
  documentReviews,
  complianceChecks,
  users,
} from '@/db/schema';
import { eq, and, desc, count, sum, sql } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export type BidDocStatus = 'draft' | 'editing' | 'reviewing' | 'approved' | 'rejected' | 'published';
export type ChapterType = 'cover' | 'toc' | 'business' | 'technical' | 'qualification' | 'price' | 'appendix';
export type ApprovalLevel = 'first' | 'second' | 'third' | 'final';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'returned';

export interface DocumentOverview {
  id: number;
  name: string;
  status: BidDocStatus;
  version: number;
  progress: number;
  totalChapters: number;
  completedChapters: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentDetail extends DocumentOverview {
  projectId: number;
  currentApprovalLevel: ApprovalLevel | null;
  deadline: Date | null;
  publishedAt: Date | null;
  publishedBy: number | null;
  createdBy: number;
  chapters: ChapterSummary[];
  approvalFlows: ApprovalFlowSummary[];
  generationHistories: GenerationHistorySummary[];
  reviews: ReviewSummary[];
}

export interface ChapterSummary {
  id: number;
  title: string;
  type: ChapterType | null;
  wordCount: number;
  isCompleted: boolean;
  isRequired: boolean;
}

export interface ApprovalFlowSummary {
  id: number;
  level: ApprovalLevel;
  status: ApprovalStatus;
  assigneeId: number;
  assigneeName: string;
  assignedAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
}

export interface GenerationHistorySummary {
  id: number;
  generationConfig: string | null;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ReviewSummary {
  id: number;
  type: string;
  score: number | null;
  status: string;
  reviewedAt: Date | null;
  createdAt: Date;
}

// ============================================
// 文档概览服务
// ============================================

/**
 * 获取项目的文档概览列表
 */
export async function getProjectDocumentOverview(
  projectId: number
): Promise<DocumentOverview[]> {
  const docs = await db
    .select({
      id: bidDocuments.id,
      name: bidDocuments.name,
      status: bidDocuments.status,
      version: bidDocuments.version,
      progress: bidDocuments.progress,
      totalChapters: bidDocuments.totalChapters,
      completedChapters: bidDocuments.completedChapters,
      wordCount: bidDocuments.wordCount,
      createdAt: bidDocuments.createdAt,
      updatedAt: bidDocuments.updatedAt,
    })
    .from(bidDocuments)
    .where(eq(bidDocuments.projectId, projectId))
    .orderBy(desc(bidDocuments.createdAt));

  return docs;
}

/**
 * 获取文档详细信息
 */
export async function getDocumentFullDetail(
  documentId: number
): Promise<DocumentDetail | null> {
  // 获取文档基本信息
  const docs = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  if (docs.length === 0) {
    return null;
  }

  const doc = docs[0];

  // 获取章节摘要
  const chapters = await db
    .select({
      id: bidChapters.id,
      title: bidChapters.title,
      type: bidChapters.type,
      wordCount: bidChapters.wordCount,
      isCompleted: bidChapters.isCompleted,
      isRequired: bidChapters.isRequired,
    })
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId))
    .orderBy(bidChapters.sortOrder);

  // 获取审批流程摘要
  const flowsData = await db
    .select({
      id: approvalFlows.id,
      level: approvalFlows.level,
      status: approvalFlows.status,
      assigneeId: approvalFlows.assigneeId,
      assignedAt: approvalFlows.assignedAt,
      dueDate: approvalFlows.dueDate,
      completedAt: approvalFlows.completedAt,
    })
    .from(approvalFlows)
    .where(eq(approvalFlows.documentId, documentId))
    .orderBy(approvalFlows.level);

  // 获取审批人姓名
  const flowIds = flowsData.map((f) => f.assigneeId);
  const assigneeData = flowIds.length > 0
    ? await db
        .select({
          id: users.id,
          realName: users.realName,
        })
        .from(users)
        .where(sql`${users.id} = ANY(${flowIds})`)
    : [];

  // 组合审批流程数据
  const approvalFlowsData: ApprovalFlowSummary[] = flowsData.map((flow) => {
    const assignee = assigneeData.find((a) => a.id === flow.assigneeId);
    return {
      id: flow.id,
      level: flow.level,
      status: flow.status,
      assigneeId: flow.assigneeId,
      assigneeName: assignee?.realName || '',
      assignedAt: flow.assignedAt,
      dueDate: flow.dueDate,
      completedAt: flow.completedAt,
    };
  });

  // 获取生成历史摘要
  const generationHistories: GenerationHistorySummary[] = await db
    .select({
      id: documentGenerationHistories.id,
      generationConfig: documentGenerationHistories.generationConfig,
      status: documentGenerationHistories.status,
      startedAt: documentGenerationHistories.startedAt,
      completedAt: documentGenerationHistories.completedAt,
      createdAt: documentGenerationHistories.createdAt,
    })
    .from(documentGenerationHistories)
    .where(eq(documentGenerationHistories.documentId, documentId))
    .orderBy(desc(documentGenerationHistories.createdAt));

  // 获取审查摘要
  const reviews: ReviewSummary[] = await db
    .select({
      id: documentReviews.id,
      type: documentReviews.type,
      score: documentReviews.score,
      status: documentReviews.status,
      reviewedAt: documentReviews.reviewedAt,
      createdAt: documentReviews.createdAt,
    })
    .from(documentReviews)
    .where(eq(documentReviews.documentId, documentId))
    .orderBy(desc(documentReviews.createdAt));

  return {
    id: doc.id,
    name: doc.name,
    status: doc.status as BidDocStatus,
    version: doc.version,
    progress: doc.progress,
    totalChapters: doc.totalChapters,
    completedChapters: doc.completedChapters,
    wordCount: doc.wordCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    projectId: doc.projectId,
    currentApprovalLevel: doc.currentApprovalLevel,
    deadline: doc.deadline,
    publishedAt: doc.publishedAt,
    publishedBy: doc.publishedBy,
    createdBy: doc.createdBy,
    chapters,
    approvalFlows: approvalFlowsData,
    generationHistories,
    reviews,
  };
}

// ============================================
// 文档模板服务
// ============================================

/**
 * 获取文档模板列表
 */
export async function getDocumentTemplates(
  filters?: {
    companyId?: number;
    category?: string;
    isDefault?: boolean;
  }
) {
  const conditions = [];

  if (filters?.companyId) {
    conditions.push(eq(docFrameworks.companyId, filters.companyId));
  }

  if (filters?.category) {
    conditions.push(eq(docFrameworks.category, filters.category));
  }

  if (filters?.isDefault !== undefined) {
    conditions.push(eq(docFrameworks.isDefault, filters.isDefault));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return await db
    .select()
    .from(docFrameworks)
    .where(whereClause)
    .orderBy(desc(docFrameworks.isDefault), docFrameworks.createdAt);
}

/**
 * 获取默认模板
 */
export async function getDefaultTemplate(
  companyId: number,
  category: string
) {
  const templates = await db
    .select()
    .from(docFrameworks)
    .where(
      and(
        eq(docFrameworks.companyId, companyId),
        eq(docFrameworks.category, category),
        eq(docFrameworks.isDefault, true)
      )
    )
    .limit(1);

  return templates[0] || null;
}

// ============================================
// 文档审批服务
// ============================================

/**
 * 启动审批流程
 */
export async function startApprovalProcess(
  documentId: number,
  levels: Array<{
    level: ApprovalLevel;
    assigneeId: number;
    dueDate?: Date;
  }>,
  userId: number
): Promise<number[]> {
  const flowIds: number[] = [];

  for (const levelConfig of levels) {
    const [flow] = await db
      .insert(approvalFlows)
      .values({
        documentId,
        level: levelConfig.level,
        status: 'pending',
        assigneeId: levelConfig.assigneeId,
        assignedAt: new Date(),
        dueDate: levelConfig.dueDate || null,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: approvalFlows.id });

    flowIds.push(flow.id);
  }

  // 更新文档状态为审批中
  await db
    .update(bidDocuments)
    .set({
      status: 'reviewing',
      currentApprovalLevel: levels[0].level,
      updatedAt: new Date(),
    })
    .where(eq(bidDocuments.id, documentId));

  return flowIds;
}

/**
 * 完成审批节点
 */
export async function completeApprovalNode(
  flowId: number,
  result: 'approved' | 'rejected',
  comment?: string
): Promise<void> {
  // 更新当前审批节点
  await db
    .update(approvalFlows)
    .set({
      status: result,
      comment,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(approvalFlows.id, flowId));

  // 获取审批流程信息
  const flow = await db
    .select()
    .from(approvalFlows)
    .where(eq(approvalFlows.id, flowId))
    .limit(1);

  if (flow.length === 0) {
    return;
  }

  // 如果拒绝，更新文档状态
  if (result === 'rejected') {
    await db
      .update(bidDocuments)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, flow[0].documentId));
    return;
  }

  // 如果通过，查找下一级审批
  const levelOrder: ApprovalLevel[] = ['first', 'second', 'third', 'final'];
  const currentIndex = levelOrder.indexOf(flow[0].level);
  const nextLevel = levelOrder[currentIndex + 1];

  if (nextLevel) {
    // 更新当前审批级别
    await db
      .update(bidDocuments)
      .set({
        currentApprovalLevel: nextLevel,
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, flow[0].documentId));
  } else {
    // 所有审批通过，更新文档状态
    await db
      .update(bidDocuments)
      .set({
        status: 'approved',
        currentApprovalLevel: null,
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, flow[0].documentId));
  }
}

// ============================================
// 文档审查服务
// ============================================

/**
 * 创建文档审查
 */
export async function createDocumentReview(
  documentId: number,
  type: 'content' | 'compliance' | 'format' | 'completeness',
  userId: number
): Promise<number> {
  const [review] = await db
    .insert(documentReviews)
    .values({
      documentId,
      type,
      status: 'pending',
      reviewedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: documentReviews.id });

  return review.id;
}

/**
 * 更新审查结果
 */
export async function updateReviewResult(
  reviewId: number,
  result: {
    score?: number;
    result?: string;
    issues?: string;
    suggestion?: string;
    status?: 'completed' | 'pending';
  }
): Promise<void> {
  await db
    .update(documentReviews)
    .set({
      ...result,
      reviewedAt: result.status === 'completed' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(documentReviews.id, reviewId));
}

// ============================================
// 文档统计服务
// ============================================

/**
 * 获取文档统计信息
 */
export async function getDocumentStatistics(documentId: number) {
  // 章节统计
  const chapterStats = await db
    .select({
      total: count(),
      completed: count(sql`CASE WHEN ${bidChapters.isCompleted} = true THEN 1 END`),
      totalWords: sum(bidChapters.wordCount),
    })
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId));

  // 生成历史统计
  const generationStats = await db
    .select({
      total: count(),
      completed: count(sql`CASE WHEN ${documentGenerationHistories.status} = 'completed' THEN 1 END`),
    })
    .from(documentGenerationHistories)
    .where(eq(documentGenerationHistories.documentId, documentId));

  // 审查统计
  const reviewStats = await db
    .select({
      total: count(documentReviews.id),
      completed: count(sql`CASE WHEN ${documentReviews.status} = 'completed' THEN 1 END`),
    })
    .from(documentReviews)
    .where(eq(documentReviews.documentId, documentId));

  // 合规检查统计
  const complianceStats = await db
    .select({
      total: count(complianceChecks.id),
      passed: count(sql`CASE WHEN ${complianceChecks.result} = 'pass' THEN 1 END`),
      failed: count(sql`CASE WHEN ${complianceChecks.result} = 'fail' THEN 1 END`),
    })
    .from(complianceChecks)
    .where(eq(complianceChecks.documentId, documentId));

  return {
    chapters: {
      total: chapterStats[0]?.total || 0,
      completed: chapterStats[0]?.completed || 0,
      totalWords: chapterStats[0]?.totalWords || 0,
    },
    generations: {
      total: generationStats[0]?.total || 0,
      completed: generationStats[0]?.completed || 0,
    },
    reviews: {
      total: reviewStats[0]?.total || 0,
      completed: reviewStats[0]?.completed || 0,
    },
    compliance: {
      total: complianceStats[0]?.total || 0,
      passed: complianceStats[0]?.passed || 0,
      failed: complianceStats[0]?.failed || 0,
    },
  };
}

/**
 * 获取项目文档统计
 */
export async function getProjectDocumentStatistics(projectId: number) {
  const docs = await getProjectDocumentOverview(projectId);

  return {
    totalDocuments: docs.length,
    statusDistribution: {
      draft: docs.filter((d) => d.status === 'draft').length,
      editing: docs.filter((d) => d.status === 'editing').length,
      reviewing: docs.filter((d) => d.status === 'reviewing').length,
      approved: docs.filter((d) => d.status === 'approved').length,
      published: docs.filter((d) => d.status === 'published').length,
    },
    totalChapters: docs.reduce((sum, d) => sum + d.totalChapters, 0),
    completedChapters: docs.reduce((sum, d) => sum + d.completedChapters, 0),
    totalWords: docs.reduce((sum, d) => sum + d.wordCount, 0),
  };
}

/**
 * 投标文档统一服务层
 * 整合投标文档相关的所有功能，包括CRUD、审批、审查及统计
 */

import { db } from '@/db';
import {
  bidDocuments,
  bidChapters,
  responseItems,
  docFrameworks,
  approvalFlows,
  documentGenerationHistories,
  documentReviews,
  complianceChecks,
  users,
} from '@/db/schema';
import { eq, and, desc, count, sum, sql, isNull } from 'drizzle-orm';
import {
  BidDocStatus,
  ChapterType,
  ApprovalLevel,
  ApprovalStatus,
  DocumentOverview,
  DocumentDetail,
  ChapterSummary,
  ApprovalFlowSummary,
  GenerationHistorySummary,
  ReviewSummary,
  ChapterTree,
  CreateDocumentParams,
  CreateChapterParams,
  UpdateChapterParams,
  DocumentStatistics,
} from '@/types/bid';

// ============================================
// 标书文档核心服务 (CRUD)
// ============================================

/**
 * 创建标书文档
 */
export async function createDocument(params: CreateDocumentParams): Promise<number> {
  const { projectId, name, userId } = params;

  const [doc] = await db
    .insert(bidDocuments)
    .values({
      projectId,
      name,
      status: 'draft',
      createdBy: userId,
    })
    .returning({ id: bidDocuments.id });

  return doc.id;
}

/**
 * 获取项目的标书文档列表
 */
export async function getProjectDocuments(projectId: number): Promise<DocumentOverview[]> {
  const docs = await db
    .select({
      id: bidDocuments.id,
      name: bidDocuments.name,
      status: bidDocuments.status as any,
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

  return docs as DocumentOverview[];
}

/**
 * 获取文档基本详情
 */
export async function getDocumentById(documentId: number) {
  const doc = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  return doc[0] || null;
}

/**
 * 获取文档完整详情 (聚合数据)
 */
export async function getDocumentFullDetail(
  documentId: number
): Promise<DocumentDetail | null> {
  const doc = await getDocumentById(documentId);
  if (!doc) return null;

  // 获取章节摘要
  const chapters = await db
    .select({
      id: bidChapters.id,
      title: bidChapters.title,
      type: bidChapters.type as any,
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
      level: approvalFlows.level as any,
      status: approvalFlows.status as any,
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

  const approvalFlowsSummary: ApprovalFlowSummary[] = flowsData.map((flow) => {
    const assignee = assigneeData.find((a) => a.id === flow.assigneeId);
    return {
      ...flow,
      assigneeName: assignee?.realName || '',
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
    currentApprovalLevel: doc.currentApprovalLevel as ApprovalLevel,
    deadline: doc.deadline,
    publishedAt: doc.publishedAt,
    publishedBy: doc.publishedBy,
    createdBy: doc.createdBy,
    chapters: chapters as ChapterSummary[],
    approvalFlows: approvalFlowsSummary,
    generationHistories,
    reviews,
  };
}

/**
 * 更新文档状态
 */
export async function updateDocumentStatus(
  documentId: number,
  status: BidDocStatus
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'published') {
    updateData.publishedAt = new Date();
  }

  await db
    .update(bidDocuments)
    .set(updateData)
    .where(eq(bidDocuments.id, documentId));
}

/**
 * 更新文档进度及统计信息
 */
export async function updateDocumentProgress(documentId: number): Promise<void> {
  const chapters = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId));

  const totalChapters = chapters.length;
  const completedChapters = chapters.filter((c) => c.isCompleted).length;
  const wordCount = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const progress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  await db
    .update(bidDocuments)
    .set({
      totalChapters,
      completedChapters,
      wordCount,
      progress,
      updatedAt: new Date(),
    })
    .where(eq(bidDocuments.id, documentId));
}

// ============================================
// 章节服务
// ============================================

/**
 * 创建章节
 */
export async function createChapter(params: CreateChapterParams): Promise<number> {
  const { documentId, parentId, type, serialNumber, title, content, isRequired, assignedTo, deadline, responseItemId } = params;

  const existingChapters = await db
    .select()
    .from(bidChapters)
    .where(
      parentId
        ? and(eq(bidChapters.documentId, documentId), eq(bidChapters.parentId, parentId))
        : and(eq(bidChapters.documentId, documentId), isNull(bidChapters.parentId))
    );

  const sortOrder = existingChapters.length;
  let level = 1;
  if (parentId) {
    const parent = await db.select().from(bidChapters).where(eq(bidChapters.id, parentId)).limit(1);
    if (parent.length > 0) level = parent[0].level + 1;
  }

  const [chapter] = await db
    .insert(bidChapters)
    .values({
      documentId,
      parentId: parentId || null,
      type: type || null,
      serialNumber: serialNumber || null,
      title,
      content: content || null,
      sortOrder,
      level,
      isRequired: isRequired ?? true,
      assignedTo: assignedTo || null,
      deadline: deadline || null,
      responseItemId: responseItemId || null,
    })
    .returning({ id: bidChapters.id });

  await updateDocumentProgress(documentId);
  return chapter.id;
}

/**
 * 获取文档的章节树
 */
export async function getChapterTree(documentId: number): Promise<ChapterTree[]> {
  const chapters = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId))
    .orderBy(bidChapters.sortOrder);

  const buildTree = (parentId: number | null = null): ChapterTree[] => {
    return chapters
      .filter((c) => c.parentId === parentId)
      .map((chapter) => ({
        id: chapter.id,
        serialNumber: chapter.serialNumber,
        title: chapter.title,
        type: chapter.type as any,
        wordCount: chapter.wordCount,
        level: chapter.level,
        isRequired: chapter.isRequired,
        isCompleted: chapter.isCompleted,
        assignedTo: chapter.assignedTo,
        deadline: chapter.deadline,
        children: buildTree(chapter.id),
      }));
  };

  return buildTree();
}

/**
 * 更新章节
 */
export async function updateChapter(
  chapterId: number,
  params: UpdateChapterParams
): Promise<void> {
  const updateData: any = {
    ...params,
    updatedAt: new Date(),
  };

  if (params.content) updateData.wordCount = params.content.length;
  if (params.isCompleted) updateData.completedAt = new Date();

  await db
    .update(bidChapters)
    .set(updateData)
    .where(eq(bidChapters.id, chapterId));

  const chapter = await db.select().from(bidChapters).where(eq(bidChapters.id, chapterId)).limit(1);
  if (chapter[0]) await updateDocumentProgress(chapter[0].documentId);
}

/**
 * 从响应矩阵生成章节结构
 */
export async function generateChaptersFromMatrix(
  documentId: number,
  matrixId: number,
  userId: number
): Promise<number[]> {
  const items = await db
    .select()
    .from(responseItems)
    .where(eq(responseItems.matrixId, matrixId))
    .orderBy(responseItems.serialNumber);

  const chapterIds: number[] = [];
  const typeGroups = {
    qualification: '资格部分',
    scoring_item: '技术响应',
    requirement: '其他要求',
  };

  for (const [type, sectionTitle] of Object.entries(typeGroups)) {
    const typeItems = items.filter((i) => i.type === type);
    if (typeItems.length === 0) continue;

    const parentId = await createChapter({
      documentId,
      type: type as ChapterType,
      title: sectionTitle,
      isRequired: true,
      userId,
    } as any);

    chapterIds.push(parentId);

    for (const item of typeItems) {
      const childId = await createChapter({
        documentId,
        parentId,
        serialNumber: item.serialNumber || undefined,
        title: item.title,
        content: item.response || undefined,
        isRequired: item.requirementType === 'mandatory',
        responseItemId: item.id,
      });
      chapterIds.push(childId);
    }
  }

  return chapterIds;
}

// ============================================
// 模板服务
// ============================================

export async function getDocumentTemplates(filters?: { companyId?: number; category?: string; isDefault?: boolean }) {
  const conditions = [];
  if (filters?.companyId) conditions.push(eq(docFrameworks.companyId, filters.companyId));
  if (filters?.category) conditions.push(eq(docFrameworks.category, filters.category));
  if (filters?.isDefault !== undefined) conditions.push(eq(docFrameworks.isDefault, filters.isDefault));

  return await db
    .select()
    .from(docFrameworks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(docFrameworks.isDefault), docFrameworks.createdAt);
}

// ============================================
// 统计服务 (下沉业务逻辑)
// ============================================

/**
 * 获取文档章节统计信息
 */
export async function getDocumentChapterStatistics(documentId: number): Promise<DocumentStatistics> {
  const chapters = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId));

  const statistics: DocumentStatistics = {
    totalChapters: chapters.length,
    completedChapters: chapters.filter((c) => c.isCompleted).length,
    byType: {},
    byStatus: {
      completed: chapters.filter((c) => c.isCompleted).length,
      pending: chapters.filter((c) => !c.isCompleted).length,
    },
  };

  chapters.forEach((chapter) => {
    if (chapter.type) {
      statistics.byType[chapter.type] = (statistics.byType[chapter.type] || 0) + 1;
    }
  });

  return statistics;
}

/**
 * 获取完整的文档统计信息 (包括审批、历史等)
 */
export async function getFullDocumentStatistics(documentId: number) {
  const chapterStats = await getDocumentChapterStatistics(documentId);
  
  const generationStats = await db
    .select({
      total: count(),
      completed: count(sql`CASE WHEN ${documentGenerationHistories.status} = 'completed' THEN 1 END`),
    })
    .from(documentGenerationHistories)
    .where(eq(documentGenerationHistories.documentId, documentId));

  const reviewStats = await db
    .select({
      total: count(documentReviews.id),
      completed: count(sql`CASE WHEN ${documentReviews.status} = 'completed' THEN 1 END`),
    })
    .from(documentReviews)
    .where(eq(documentReviews.documentId, documentId));

  const complianceStats = await db
    .select({
      total: count(complianceChecks.id),
      passed: count(sql`CASE WHEN ${complianceChecks.result} = 'pass' THEN 1 END`),
      failed: count(sql`CASE WHEN ${complianceChecks.result} = 'fail' THEN 1 END`),
    })
    .from(complianceChecks)
    .where(eq(complianceChecks.documentId, documentId));

  return {
    chapters: chapterStats,
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

// ============================================
// 审批服务
// ============================================

export async function startApprovalProcess(
  documentId: number,
  levels: Array<{ level: ApprovalLevel; assigneeId: number; dueDate?: Date }>,
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

export async function completeApprovalNode(
  flowId: number,
  result: 'approved' | 'rejected',
  comment?: string
): Promise<void> {
  await db
    .update(approvalFlows)
    .set({ status: result, comment, completedAt: new Date(), updatedAt: new Date() })
    .where(eq(approvalFlows.id, flowId));

  const flow = await db.select().from(approvalFlows).where(eq(approvalFlows.id, flowId)).limit(1);
  if (flow.length === 0) return;

  if (result === 'rejected') {
    await db.update(bidDocuments).set({ status: 'rejected', updatedAt: new Date() }).where(eq(bidDocuments.id, flow[0].documentId));
    return;
  }

  const levelOrder: ApprovalLevel[] = ['first', 'second', 'third', 'final'];
  const currentIndex = levelOrder.indexOf(flow[0].level as ApprovalLevel);
  const nextLevel = levelOrder[currentIndex + 1];

  if (nextLevel) {
    await db.update(bidDocuments).set({ currentApprovalLevel: nextLevel, updatedAt: new Date() }).where(eq(bidDocuments.id, flow[0].documentId));
  } else {
    await db.update(bidDocuments).set({ status: 'approved', currentApprovalLevel: null, updatedAt: new Date() }).where(eq(bidDocuments.id, flow[0].documentId));
  }
}

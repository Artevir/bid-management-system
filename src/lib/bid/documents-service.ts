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
  auditLogs,
} from '@/db/schema';
import { eq, and, desc, count, sum as _sum, sql, isNull } from 'drizzle-orm';
import {
  BidDocStatus,
  ChapterType,
  ApprovalLevel,
  ApprovalStatus as _ApprovalStatus,
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
import { createAuditLog as _createAuditLog } from '@/lib/audit/service';
import { AppError } from '@/lib/api/error-handler';

// ============================================
// 常量定义
// ============================================

/** 审批级别顺序 */
export const APPROVAL_LEVEL_ORDER: ApprovalLevel[] = ['first', 'second', 'third', 'final'];

// ============================================
// 标书文档核心服务 (CRUD)
// ============================================

/**
 * 创建标书文档
 */
export async function createDocument(params: CreateDocumentParams): Promise<number> {
  const { projectId, name, userId } = params;

  const documentId = await db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(bidDocuments)
      .values({
        projectId,
        name,
        status: 'draft',
        createdBy: userId,
      })
      .returning({ id: bidDocuments.id });

    // 记录审计日志
    await tx.insert(auditLogs).values({
      userId,
      action: 'create',
      resource: 'document',
      resourceId: doc.id,
      projectId, // P2 优化：记录 projectId
      description: `创建了标书文档: ${name}`,
    });

    return doc.id;
  });

  return documentId;
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
      creatorName: users.realName,
    })
    .from(bidDocuments)
    .leftJoin(users, eq(bidDocuments.createdBy, users.id))
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
  status: BidDocStatus,
  userId?: number
): Promise<void> {
  await db.transaction(async (tx) => {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'published') {
      updateData.publishedAt = new Date();
      if (userId) updateData.publishedBy = userId;
    }

    await tx
      .update(bidDocuments)
      .set(updateData)
      .where(eq(bidDocuments.id, documentId));

    if (userId) {
      // 获取文档所属项目ID
      const doc = await tx.select({ projectId: bidDocuments.projectId }).from(bidDocuments).where(eq(bidDocuments.id, documentId)).limit(1);
      
      await tx.insert(auditLogs).values({
        userId,
        action: 'update',
        resource: 'document',
        resourceId: documentId,
        projectId: doc[0]?.projectId, // P2 优化：记录 projectId
        description: `更新了文档状态为: ${status}`,
      });
    }
  });
}

/**
 * 更新文档进度及统计信息 (内部调用，通常在事务中)
 */
export async function updateDocumentProgress(tx: any, documentId: number): Promise<void> {
  // 对主文档记录加行级排他锁 (SELECT ... FOR UPDATE)，防止并发计算进度时的脏读
  const doc = await tx
    .select({ id: bidDocuments.id })
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .for('update');

  if (doc.length === 0) return;

  const chapters = await tx
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId));

  const totalChapters = chapters.length;
  const completedChapters = chapters.filter((c: any) => c.isCompleted).length;
  const wordCount = chapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0);
  const progress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  // 获取其他统计信息 (P1 性能治理：将实时统计转为缓存更新)
  const [gen, rev, comp] = await Promise.all([
    tx.select({ total: count(), completed: count(sql`CASE WHEN status = 'completed' THEN 1 END`) }).from(documentGenerationHistories).where(eq(documentGenerationHistories.documentId, documentId)),
    tx.select({ total: count(), completed: count(sql`CASE WHEN status = 'completed' THEN 1 END`) }).from(documentReviews).where(eq(documentReviews.documentId, documentId)),
    tx.select({ total: count(), passed: count(sql`CASE WHEN result = 'pass' THEN 1 END`), failed: count(sql`CASE WHEN result = 'fail' THEN 1 END`) }).from(complianceChecks).where(eq(complianceChecks.documentId, documentId)),
  ]);

  await tx
    .update(bidDocuments)
    .set({
      totalChapters,
      completedChapters,
      wordCount,
      progress,
      totalGenerations: gen[0]?.total || 0,
      completedGenerations: gen[0]?.completed || 0,
      totalReviews: rev[0]?.total || 0,
      completedReviews: rev[0]?.completed || 0,
      totalComplianceChecks: comp[0]?.total || 0,
      passedComplianceChecks: comp[0]?.passed || 0,
      failedComplianceChecks: comp[0]?.failed || 0,
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

  return await db.transaction(async (tx) => {
    // 显式排他锁 (P0 致命风险修复)：锁定文档记录以防止并发创建章节时的排序竞态
    await tx
      .select({ id: bidDocuments.id })
      .from(bidDocuments)
      .where(eq(bidDocuments.id, documentId))
      .for('update');

    // 使用 SQL 聚合计算最大的 sortOrder，保证在事务内计算的准确性并减少数据传输
    const [{ maxOrder }] = await tx
      .select({ maxOrder: sql<number>`COALESCE(MAX(${bidChapters.sortOrder}), -1)` })
      .from(bidChapters)
      .where(
        parentId
          ? and(eq(bidChapters.documentId, documentId), eq(bidChapters.parentId, parentId))
          : and(eq(bidChapters.documentId, documentId), isNull(bidChapters.parentId))
      );

    const sortOrder = maxOrder + 1;
    let level = 1;
    if (parentId) {
      const parent = await tx.select().from(bidChapters).where(eq(bidChapters.id, parentId)).limit(1);
      if (parent.length > 0) level = parent[0].level + 1;
    }

    const [chapter] = await tx
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

    await updateDocumentProgress(tx, documentId);
    return chapter.id;
  });
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
        version: chapter.version,
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
 * 获取章节详情
 */
export async function getChapterDetail(chapterId: number) {
  const chapter = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.id, chapterId))
    .limit(1);

  if (chapter.length === 0) return null;

  const c = chapter[0];
  return {
    id: c.id,
    documentId: c.documentId,
    parentId: c.parentId,
    type: c.type as ChapterType,
    serialNumber: c.serialNumber,
    title: c.title,
    content: c.content,
    version: c.version,
    wordCount: c.wordCount,
    level: c.level,
    isRequired: c.isRequired,
    isCompleted: c.isCompleted,
    assignedTo: c.assignedTo,
    deadline: c.deadline,
    completedAt: c.completedAt,
    responseItemId: c.responseItemId,
    promptTemplateId: (c as any).promptTemplateId,
    promptParameters: (c as any).promptParameters,
    companyId: (c as any).companyId,
    tags: (c as any).tags,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/**
 * 更新章节
 * P1 乐观锁修复：通过 version 字段防止并发覆盖
 */
export async function updateChapter(
  chapterId: number,
  params: UpdateChapterParams
): Promise<void> {
  const { version, ...otherParams } = params;

  await db.transaction(async (tx) => {
    // 如果提供了版本号，则执行乐观锁检查
    if (version !== undefined) {
      const [current] = await tx
        .select({ version: bidChapters.version })
        .from(bidChapters)
        .where(eq(bidChapters.id, chapterId))
        .for('update'); // 加锁读取最新版本

      if (current && current.version !== version) {
        throw AppError.conflict('数据已被他人修改，请刷新后重试');
      }
    }

    const updateData: any = {
      ...otherParams,
      updatedAt: new Date(),
    };

    if (params.content) updateData.wordCount = params.content.length;
    if (params.isCompleted) updateData.completedAt = new Date();

    // 增加版本号
    updateData.version = sql`${bidChapters.version} + 1`;

    await tx
      .update(bidChapters)
      .set(updateData)
      .where(eq(bidChapters.id, chapterId));

    const chapter = await tx
      .select({ documentId: bidChapters.documentId })
      .from(bidChapters)
      .where(eq(bidChapters.id, chapterId))
      .limit(1);
    if (chapter[0]) await updateDocumentProgress(tx, chapter[0].documentId);
  });
}

/**
 * 删除章节 (及其子章节)
 */
export async function deleteChapter(chapterId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const chapter = await tx.select().from(bidChapters).where(eq(bidChapters.id, chapterId)).limit(1);
    if (!chapter[0]) return;

    const documentId = chapter[0].documentId;

    // 递归获取所有子章节ID
    const getAllSubChapterIds = async (id: number): Promise<number[]> => {
      const children = await tx.select({ id: bidChapters.id }).from(bidChapters).where(eq(bidChapters.parentId, id));
      let ids = children.map((c: any) => c.id);
      for (const childId of ids) {
        const subIds = await getAllSubChapterIds(childId);
        ids = [...ids, ...subIds];
      }
      return ids;
    };

    const subIds = await getAllSubChapterIds(chapterId);
    const allIdsToDelete = [chapterId, ...subIds];

    // 批量删除
    await tx.delete(bidChapters).where(sql`${bidChapters.id} = ANY(${allIdsToDelete})`);

    // 更新文档进度
    await updateDocumentProgress(tx, documentId);
  });
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

  return await db.transaction(async (_tx) => {
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
  });
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
// 统计服务 (优化后的聚合查询)
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
 * 获取完整的文档统计信息 (高性能聚合查询版本)
 * P1 性能治理：直接从 bid_documents 表读取缓存的统计字段
 */
export async function getFullDocumentStatistics(documentId: number) {
  const [doc] = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  if (!doc) {
    throw new Error('文档不存在');
  }

  // 虽然基本字段已经在 doc 中，但为了保持 getDocumentChapterStatistics 的逻辑一致性（可能包含按类型分布等），
  // 我们仍然调用它，但由于它只查 bid_chapters 且用了索引，性能尚可。
  const chapterStatsResult = await getDocumentChapterStatistics(documentId);

  return {
    chapters: chapterStatsResult,
    generations: {
      total: doc.totalGenerations || 0,
      completed: doc.completedGenerations || 0,
    },
    reviews: {
      total: doc.totalReviews || 0,
      completed: doc.completedReviews || 0,
    },
    compliance: {
      total: doc.totalComplianceChecks || 0,
      passed: doc.passedComplianceChecks || 0,
      failed: doc.failedComplianceChecks || 0,
    },
  };
}

/**
 * 获取项目文档统计
 */
export async function getProjectDocumentStatistics(projectId: number) {
  const docs = await getProjectDocuments(projectId);

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

// ============================================
// 审批服务
// ============================================

export async function startApprovalProcess(
  documentId: number,
  levels: Array<{ level: ApprovalLevel; assigneeId: number; dueDate?: Date }>,
  userId: number
): Promise<number[]> {
  const flowIds: number[] = [];

  return await db.transaction(async (tx) => {
    for (const levelConfig of levels) {
      const [flow] = await tx
        .insert(approvalFlows)
        .values({
          documentId,
          level: levelConfig.level as any,
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

    await tx
      .update(bidDocuments)
      .set({
        status: 'reviewing',
        currentApprovalLevel: levels[0].level,
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, documentId));

    // 获取文档所属项目ID
    const docInfo = await tx.select({ projectId: bidDocuments.projectId }).from(bidDocuments).where(eq(bidDocuments.id, documentId)).limit(1);

    await tx.insert(auditLogs).values({
      userId,
      action: 'update',
      resource: 'document',
      resourceId: documentId,
      projectId: docInfo[0]?.projectId, // P2 优化：记录 projectId
      description: '发起了文档审批流程',
    });

    return flowIds;
  });
}

export async function completeApprovalNode(
  flowId: number,
  result: 'approved' | 'rejected',
  userId: number,
  comment?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(approvalFlows)
      .set({ status: result, comment, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(approvalFlows.id, flowId));

    const flow = await tx.select().from(approvalFlows).where(eq(approvalFlows.id, flowId)).limit(1);
    if (flow.length === 0) return;

    const documentId = flow[0].documentId;

    if (result === 'rejected') {
      await tx.update(bidDocuments).set({ status: 'rejected', updatedAt: new Date() }).where(eq(bidDocuments.id, documentId));
    } else {
        // P1 逻辑修复：寻找下一个真实存在的审批级别
        const currentIndex = APPROVAL_LEVEL_ORDER.indexOf(flow[0].level as ApprovalLevel);
        const remainingLevels = APPROVAL_LEVEL_ORDER.slice(currentIndex + 1);
        
        let nextLevelToSet: ApprovalLevel | null = null;
        
        if (remainingLevels.length > 0) {
          // 获取该文档所有已定义的审批节点
          const existingFlows = await tx
            .select({ level: approvalFlows.level })
            .from(approvalFlows)
            .where(eq(approvalFlows.documentId, documentId));
          
          const existingLevels = new Set(existingFlows.map((f: any) => f.level));
          
          // 按顺序寻找下一个存在的级别
          for (const level of remainingLevels) {
            if (existingLevels.has(level)) {
              nextLevelToSet = level;
              break;
            }
          }
        }

        if (nextLevelToSet) {
        await tx.update(bidDocuments).set({ currentApprovalLevel: nextLevelToSet, updatedAt: new Date() }).where(eq(bidDocuments.id, documentId));
      } else {
        await tx.update(bidDocuments).set({ status: 'approved', currentApprovalLevel: null, updatedAt: new Date() }).where(eq(bidDocuments.id, documentId));
      }
    }

    // 获取文档所属项目ID
    const docInfo = await tx.select({ projectId: bidDocuments.projectId }).from(bidDocuments).where(eq(bidDocuments.id, documentId)).limit(1);

    await tx.insert(auditLogs).values({
      userId,
      action: result === 'approved' ? 'approve' : 'reject',
      resource: 'document',
      resourceId: documentId,
      projectId: docInfo[0]?.projectId, // P2 优化：记录 projectId
      description: `审批了文档节点: ${flow[0].level}, 结果: ${result}`,
    });
  });
}

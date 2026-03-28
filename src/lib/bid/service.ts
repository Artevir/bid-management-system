/**
 * 标书文档管理服务
 * 处理标书文档和章节的CRUD操作
 */

import { db } from '@/db';
import {
  bidDocuments,
  bidChapters,
  responseItems,
  projects,
} from '@/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export type BidDocStatus = 'draft' | 'editing' | 'reviewing' | 'approved' | 'rejected' | 'published';
export type ChapterType = 'cover' | 'toc' | 'business' | 'technical' | 'qualification' | 'price' | 'appendix';

export interface CreateDocumentParams {
  projectId: number;
  name: string;
  templateId?: number;
  userId: number;
}

export interface CreateChapterParams {
  documentId: number;
  parentId?: number;
  type?: ChapterType;
  serialNumber?: string;
  title: string;
  content?: string;
  isRequired?: boolean;
  assignedTo?: number;
  deadline?: Date;
  responseItemId?: number;
}

export interface UpdateChapterParams {
  title?: string;
  content?: string;
  isCompleted?: boolean;
  assignedTo?: number;
  deadline?: Date;
  promptTemplateId?: number | null;
  promptParameters?: string | null;
  companyId?: number | null;
  tags?: string | null;
}

export interface ChapterTree {
  id: number;
  serialNumber: string | null;
  title: string;
  type: ChapterType | null;
  wordCount: number;
  level: number;
  isRequired: boolean;
  isCompleted: boolean;
  assignedTo: number | null;
  deadline: Date | null;
  children: ChapterTree[];
}

// ============================================
// 标书文档服务
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
export async function getProjectDocuments(projectId: number) {
  const docs = await db
    .select({
      id: bidDocuments.id,
      projectId: bidDocuments.projectId,
      name: bidDocuments.name,
      version: bidDocuments.version,
      status: bidDocuments.status,
      totalChapters: bidDocuments.totalChapters,
      completedChapters: bidDocuments.completedChapters,
      wordCount: bidDocuments.wordCount,
      progress: bidDocuments.progress,
      currentApprovalLevel: bidDocuments.currentApprovalLevel,
      deadline: bidDocuments.deadline,
      publishedAt: bidDocuments.publishedAt,
      createdAt: bidDocuments.createdAt,
      updatedAt: bidDocuments.updatedAt,
    })
    .from(bidDocuments)
    .where(eq(bidDocuments.projectId, projectId))
    .orderBy(desc(bidDocuments.createdAt));

  return docs;
}

/**
 * 获取文档详情
 */
export async function getDocumentDetail(documentId: number) {
  const doc = await db
    .select({
      id: bidDocuments.id,
      projectId: bidDocuments.projectId,
      name: bidDocuments.name,
      version: bidDocuments.version,
      status: bidDocuments.status,
      totalChapters: bidDocuments.totalChapters,
      completedChapters: bidDocuments.completedChapters,
      wordCount: bidDocuments.wordCount,
      progress: bidDocuments.progress,
      currentApprovalLevel: bidDocuments.currentApprovalLevel,
      deadline: bidDocuments.deadline,
      publishedAt: bidDocuments.publishedAt,
      publishedBy: bidDocuments.publishedBy,
      createdBy: bidDocuments.createdBy,
      createdAt: bidDocuments.createdAt,
      updatedAt: bidDocuments.updatedAt,
    })
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  return doc[0] || null;
}

/**
 * 更新文档状态
 */
export async function updateDocumentStatus(
  documentId: number,
  status: BidDocStatus
): Promise<void> {
  const updateData: Record<string, unknown> = {
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
 * 更新文档进度
 */
export async function updateDocumentProgress(documentId: number): Promise<void> {
  // 获取章节统计
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
  const {
    documentId,
    parentId,
    type,
    serialNumber,
    title,
    content,
    isRequired,
    assignedTo,
    deadline,
    responseItemId,
  } = params;

  // 获取排序号
  const existingChapters = await db
    .select()
    .from(bidChapters)
    .where(
      parentId
        ? and(
            eq(bidChapters.documentId, documentId),
            eq(bidChapters.parentId, parentId)
          )
        : and(
            eq(bidChapters.documentId, documentId),
            isNull(bidChapters.parentId)
          )
    );

  const sortOrder = existingChapters.length;

  // 获取层级
  let level = 1;
  if (parentId) {
    const parent = await db
      .select()
      .from(bidChapters)
      .where(eq(bidChapters.id, parentId))
      .limit(1);
    if (parent.length > 0) {
      level = parent[0].level + 1;
    }
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

  // 更新文档进度
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
        type: chapter.type,
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
 * 获取章节详情
 */
export async function getChapterDetail(chapterId: number) {
  const chapter = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.id, chapterId))
    .limit(1);

  return chapter[0] || null;
}

/**
 * 更新章节内容
 */
export async function updateChapter(
  chapterId: number,
  params: UpdateChapterParams
): Promise<void> {
  const updateData: Record<string, unknown> = {
    ...params,
    updatedAt: new Date(),
  };

  if (params.content) {
    // 计算字数
    updateData.wordCount = params.content.length;
  }

  if (params.isCompleted !== undefined && params.isCompleted) {
    updateData.completedAt = new Date();
  }

  await db
    .update(bidChapters)
    .set(updateData)
    .where(eq(bidChapters.id, chapterId));

  // 更新文档进度
  const chapter = await getChapterDetail(chapterId);
  if (chapter) {
    await updateDocumentProgress(chapter.documentId);
  }
}

/**
 * 删除章节
 */
export async function deleteChapter(chapterId: number): Promise<void> {
  const chapter = await getChapterDetail(chapterId);
  if (!chapter) return;

  // 递归删除子章节
  const children = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.parentId, chapterId));

  for (const child of children) {
    await deleteChapter(child.id);
  }

  // 删除当前章节
  await db.delete(bidChapters).where(eq(bidChapters.id, chapterId));

  // 更新文档进度
  await updateDocumentProgress(chapter.documentId);
}

/**
 * 移动章节顺序
 */
export async function moveChapter(
  chapterId: number,
  newParentId: number | null,
  newSortOrder: number
): Promise<void> {
  const chapter = await getChapterDetail(chapterId);
  if (!chapter) return;

  // 更新父级和排序
  await db
    .update(bidChapters)
    .set({
      parentId: newParentId,
      sortOrder: newSortOrder,
      level: newParentId ? (await getChapterDetail(newParentId))?.level || 1 + 1 : 1,
      updatedAt: new Date(),
    })
    .where(eq(bidChapters.id, chapterId));
}

/**
 * 从响应矩阵生成章节结构
 */
export async function generateChaptersFromMatrix(
  documentId: number,
  matrixId: number,
  userId: number
): Promise<number[]> {
  // 获取矩阵项
  const items = await db
    .select()
    .from(responseItems)
    .where(eq(responseItems.matrixId, matrixId))
    .orderBy(responseItems.serialNumber);

  const chapterIds: number[] = [];

  // 按类型分组创建章节
  const typeGroups = {
    qualification: '资格部分',
    scoring_item: '技术响应',
    requirement: '其他要求',
  };

  for (const [type, sectionTitle] of Object.entries(typeGroups)) {
    const typeItems = items.filter((i) => i.type === type);
    if (typeItems.length === 0) continue;

    // 创建父章节
    const parentId = await createChapter({
      documentId,
      type: type as ChapterType,
      title: sectionTitle,
      isRequired: true,
    });

    chapterIds.push(parentId);

    // 创建子章节
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

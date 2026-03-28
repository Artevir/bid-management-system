/**
 * 从合并框架创建投标文档API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { companyFrameworkService } from '@/lib/services/company-framework-service';
import frameworkMergeService, { type MergedChapter, type FrameworkMergeOptions, type SimpleFramework, type BaseChapter } from '@/lib/services/framework-merge-service';
import { db } from '@/db';
import { 
  bidDocuments, 
  bidChapters,
  projects,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDocumentFramework } from '@/lib/interpretation/service';

// ============================================
// 类型定义
// ============================================

interface CreateDocumentFromMergeParams {
  projectId: number;
  documentName: string;
  tenderInterpretationId?: number;
  companyFrameworkIds: number[];
  mergeStrategy?: 'tender_first' | 'company_first' | 'smart_merge';
}

// ============================================
// 从合并框架创建文档
// ============================================

async function createDocumentFromMerge(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      projectId,
      documentName,
      tenderInterpretationId,
      companyFrameworkIds,
      mergeStrategy = 'smart_merge',
    }: CreateDocumentFromMergeParams = body;

    // 验证参数
    if (!projectId || !documentName) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    if (!companyFrameworkIds || companyFrameworkIds.length === 0) {
      return NextResponse.json({ error: '请选择至少一个公司文档框架' }, { status: 400 });
    }

    // 验证项目存在
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // 获取招标文件框架（如果有）
    let tenderFramework: SimpleFramework | null = null;

    if (tenderInterpretationId) {
      // 使用 getDocumentFramework 获取框架数据
      const frameworkData = await getDocumentFramework(tenderInterpretationId);
      if (frameworkData && frameworkData.length > 0) {
        tenderFramework = {
          id: -1,
          name: '招标文件框架',
          chapters: convertToFrameworkChapters(frameworkData),
        };
      }
    }

    // 获取公司框架
    const companyFrameworks = await companyFrameworkService.getFrameworksByIds(
      companyFrameworkIds
    );

    // 转换公司框架为 SimpleFramework 类型
    const convertedCompanyFrameworks: SimpleFramework[] = companyFrameworks.map(fw => ({
      id: fw.id,
      name: fw.name,
      chapters: convertChaptersToBase(fw.chapters),
      company: fw.company,
    }));

    if (convertedCompanyFrameworks.length === 0) {
      return NextResponse.json({ error: '未找到有效的公司文档框架' }, { status: 404 });
    }

    // 准备合并
    const allFrameworks = tenderFramework
      ? [tenderFramework, ...convertedCompanyFrameworks]
      : convertedCompanyFrameworks;

    const mergeOptions: FrameworkMergeOptions = {
      tenderFrameworkId: tenderFramework?.id,
      companyFrameworkIds,
      mergeStrategy: mergeStrategy as 'tender_first' | 'company_first' | 'smart_merge',
      preserveSource: true,
    };

    // 执行合并
    const mergedResult = await frameworkMergeService.mergeFrameworks(
      allFrameworks,
      mergeOptions
    );

    // 创建投标文档
    const [document] = await db
      .insert(bidDocuments)
      .values({
        projectId,
        name: documentName,
        status: 'draft',
        createdBy: userId,
        totalChapters: mergedResult.stats.totalChapters,
        completedChapters: 0,
        wordCount: 0,
        progress: 0,
      })
      .returning();

    // 创建章节
    await createChaptersFromMerged(document.id, mergedResult.chapters);

    // 更新文档进度
    await updateDocumentProgress(document.id);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      message: '投标文档创建成功',
      stats: mergedResult.stats,
    });
  } catch (error) {
    console.error('Create document from merge error:', error);
    return NextResponse.json(
      { error: '创建投标文档失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 将框架数据转换为章节格式
 */
function convertToFrameworkChapters(chapters: any[]): BaseChapter[] {
  return chapters.map((chapter, idx) => ({
    id: -idx - 1,
    frameworkId: -1,
    parentId: null,
    level: chapter.level || 1,
    order: idx + 1,
    title: chapter.chapterTitle || chapter.title,
    titleNumber: chapter.chapterNumber || chapter.titleNumber || null,
    isRequired: true,
    description: chapter.contentRequirement || null,
    contentTemplate: null,
    children: chapter.children?.map((sub: any, subIdx: number) => ({
      id: -idx * 100 - subIdx - 1,
      frameworkId: -1,
      parentId: -idx - 1,
      level: sub.level || 2,
      order: subIdx + 1,
      title: sub.chapterTitle || sub.title,
      titleNumber: sub.chapterNumber || sub.titleNumber || null,
      isRequired: true,
      description: sub.contentRequirement || null,
      contentTemplate: null,
      children: sub.children?.map((subSub: any, subSubIdx: number) => ({
        id: -idx * 10000 - subIdx * 100 - subSubIdx - 1,
        frameworkId: -1,
        parentId: -idx * 100 - subIdx - 1,
        level: subSub.level || 3,
        order: subSubIdx + 1,
        title: subSub.chapterTitle || subSub.title,
        titleNumber: subSub.chapterNumber || subSub.titleNumber || null,
        isRequired: true,
        description: subSub.contentRequirement || null,
        contentTemplate: null,
      })),
    })),
  }));
}

/**
 * 从合并框架创建章节
 */
async function createChaptersFromMerged(
  documentId: number,
  chapters: MergedChapter[],
  parentId: number | null = null,
  sortOrder: number = 0
): Promise<number[]> {
  const chapterIds: number[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    // 创建章节
    const [created] = await db
      .insert(bidChapters)
      .values({
        documentId,
        parentId,
        type: getChapterType(chapter.title, chapter.level),
        serialNumber: chapter.titleNumber || null,
        title: chapter.title,
        content: chapter.contentTemplate || null,
        sortOrder: sortOrder + i,
        level: chapter.level,
        isRequired: chapter.isRequired ?? true,
        // 存储来源信息
        promptTemplateId: chapter.sourceFrameworkId || null,
      })
      .returning({ id: bidChapters.id });

    chapterIds.push(created.id);

    // 递归创建子章节
    if (chapter.children && chapter.children.length > 0) {
      const childIds = await createChaptersFromMerged(
        documentId,
        chapter.children,
        created.id,
        0
      );
      chapterIds.push(...childIds);
    }
  }

  return chapterIds;
}

/**
 * 根据章节标题和层级推断章节类型
 */
function getChapterType(title: string, level: number): 'business' | 'technical' | 'qualification' | 'price' | 'appendix' | 'cover' | 'toc' | null {
  const titleLower = title.toLowerCase();

  if (level === 1) {
    if (titleLower.includes('商务') || titleLower.includes('资格')) {
      return 'business';
    }
    if (titleLower.includes('技术')) {
      return 'technical';
    }
    if (titleLower.includes('价格') || titleLower.includes('报价')) {
      return 'price';
    }
    if (titleLower.includes('资质') || titleLower.includes('证书')) {
      return 'qualification';
    }
    if (titleLower.includes('附录') || titleLower.includes('附件')) {
      return 'appendix';
    }
  }

  return null;
}

/**
 * 更新文档进度
 */
async function updateDocumentProgress(documentId: number): Promise<void> {
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

// 辅助函数：将公司框架章节转换为 BaseChapter 类型
function convertChaptersToBase(chapters: any[]): BaseChapter[] {
  return chapters.map(chapter => ({
    id: chapter.id,
    frameworkId: chapter.frameworkId,
    parentId: chapter.parentId,
    level: chapter.level,
    order: chapter.order,
    title: chapter.title,
    titleNumber: chapter.titleNumber,
    isRequired: chapter.isRequired ?? true,
    description: chapter.description,
    contentTemplate: chapter.contentTemplate,
    children: chapter.children ? convertChaptersToBase(chapter.children) : undefined,
  }));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createDocumentFromMerge(req, userId));
}

/**
 * 文档框架合并API
 * 支持预览合并结果和创建合并后的文档
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { companyFrameworkService } from '@/lib/services/company-framework-service';
import frameworkMergeService, { type FrameworkMergeOptions, type MergedChapter as _MergedChapter, type SimpleFramework, type BaseChapter } from '@/lib/services/framework-merge-service';
import { db } from '@/db';
import { companies } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDocumentFramework } from '@/lib/interpretation/service';

// ============================================
// 预览框架合并
// ============================================

async function previewMerge(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      tenderInterpretationId, // 招标文件解读ID
      companyFrameworkIds, // 公司框架ID列表
      mergeStrategy = 'smart_merge', // 合并策略
    } = body;

    // 验证参数
    if (!companyFrameworkIds || companyFrameworkIds.length === 0) {
      return NextResponse.json({ error: '请选择至少一个公司文档框架' }, { status: 400 });
    }

    // 获取招标文件框架（如果有）
    let tenderFramework = null;

    if (tenderInterpretationId) {
      // 使用 getDocumentFramework 函数获取框架数据
      const frameworkData = await getDocumentFramework(tenderInterpretationId);
      
      if (frameworkData && Array.isArray(frameworkData) && frameworkData.length > 0) {
        tenderFramework = {
          id: -1, // 临时ID，表示来自招标文件解读
          name: '招标文件框架',
          chapters: convertFrameworkToChapters(frameworkData),
        } as SimpleFramework;
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

    return NextResponse.json({
      success: true,
      data: mergedResult,
    });
  } catch (error) {
    console.error('Preview merge error:', error);
    return NextResponse.json(
      { error: '预览合并失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// 辅助函数：将解读框架数据转换为章节格式
function convertFrameworkToChapters(frameworkData: any[]): BaseChapter[] {
  return frameworkData.map((item, idx) => ({
    id: -idx - 1,
    frameworkId: -1,
    parentId: null,
    level: item.level || 1,
    order: idx + 1,
    title: item.chapterTitle,
    titleNumber: item.chapterNumber || null,
    isRequired: true,
    description: item.contentRequirement || null,
    contentTemplate: null,
    children: item.children ? item.children.map((sub: any, subIdx: number) => ({
      id: -idx * 100 - subIdx - 1,
      frameworkId: -1,
      parentId: -idx - 1,
      level: sub.level || 2,
      order: subIdx + 1,
      title: sub.chapterTitle,
      titleNumber: sub.chapterNumber || null,
      isRequired: true,
      description: sub.contentRequirement || null,
      contentTemplate: null,
      children: sub.children ? sub.children.map((subSub: any, subSubIdx: number) => ({
        id: -idx * 10000 - subIdx * 100 - subSubIdx - 1,
        frameworkId: -1,
        parentId: -idx * 100 - subIdx - 1,
        level: subSub.level || 3,
        order: subSubIdx + 1,
        title: subSub.chapterTitle,
        titleNumber: subSub.chapterNumber || null,
        isRequired: true,
        description: subSub.contentRequirement || null,
        contentTemplate: null,
      })) : undefined,
    })) : undefined,
  }));
}

// ============================================
// 获取可用的框架列表
// ============================================

async function getAvailableFrameworks(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const documentType = searchParams.get('documentType') || '投标文件';

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    // 获取招标文件解读列表
    const { getInterpretationList } = await import('@/lib/interpretation/service');
    const interpretationResult = await getInterpretationList({
      projectId: parseInt(projectId),
      status: 'completed',
    });

    // 对于每个解读，获取其框架数据
    const tenderFrameworks = [];
    for (const item of interpretationResult.list || []) {
      const frameworkData = await getDocumentFramework(item.id);
      if (frameworkData && frameworkData.length > 0) {
        tenderFrameworks.push({
          id: item.id,
          type: 'tender',
          name: `${item.projectName || '招标文件'} - 文档框架`,
          chapterCount: frameworkData.length,
          createdAt: item.createdAt,
        });
      }
    }

    // 获取公司列表及其框架
    const companyList = await db
      .select({
        id: companies.id,
        name: companies.name,
      })
      .from(companies)
      .where(eq(companies.isActive, true));

    const companyFrameworks = [];

    for (const company of companyList) {
      const frameworks = await companyFrameworkService.getFrameworksByCompany(
        company.id,
        documentType
      );

      if (frameworks.length > 0) {
        companyFrameworks.push({
          companyId: company.id,
          companyName: company.name,
          frameworks: frameworks.map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description,
            isDefault: f.isDefault,
            sourceType: f.sourceType,
            createdAt: f.createdAt,
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tenderFrameworks,
        companyFrameworks,
      },
    });
  } catch (error) {
    console.error('Get available frameworks error:', error);
    return NextResponse.json(
      { error: '获取框架列表失败' },
      { status: 500 }
    );
  }
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

// ============================================
// 路由分发
// ============================================

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getAvailableFrameworks(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => previewMerge(req, userId));
}

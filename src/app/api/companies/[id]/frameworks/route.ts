/**
 * 公司文档框架API
 * GET: 获取公司的文档框架列表
 * POST: 创建新的文档框架
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { companyFrameworkService, type CreateChapterData } from '@/lib/services/company-framework-service';

// ============================================
// 获取公司文档框架列表
// ============================================

async function getFrameworks(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  userId: number
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const companyId = parseInt(id);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: '无效的公司ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType') || undefined;

    const frameworks = await companyFrameworkService.getFrameworksByCompany(
      companyId,
      documentType
    );

    // 获取每个框架的章节统计
    const frameworksWithStats = await Promise.all(
      frameworks.map(async (fw) => {
        const detail = await companyFrameworkService.getFrameworkById(fw.id);
        return {
          ...fw,
          chapters: detail?.chapters || [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      frameworks: frameworksWithStats,
    });
  } catch (error) {
    console.error('Get frameworks error:', error);
    return NextResponse.json({ error: '获取框架列表失败' }, { status: 500 });
  }
}

// ============================================
// 创建新的文档框架
// ============================================

async function createFramework(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  userId: number
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const companyId = parseInt(id);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: '无效的公司ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, documentType, isDefault, chapters } = body;

    if (!name) {
      return NextResponse.json({ error: '框架名称不能为空' }, { status: 400 });
    }

    // 转换章节数据
    const convertChapters = (items: any[], level: number = 1): CreateChapterData[] => {
      return items.map((item, index) => ({
        title: item.title,
        titleNumber: item.titleNumber,
        level,
        order: index + 1,
        isRequired: item.isRequired ?? true,
        description: item.description,
        children: item.children ? convertChapters(item.children, level + 1) : undefined,
      }));
    };

    const framework = await companyFrameworkService.createFramework(
      {
        companyId,
        name,
        description,
        documentType: documentType || '投标文件',
        sourceType: 'manual',
        isDefault: isDefault || false,
        chapters: chapters ? convertChapters(chapters) : [],
      },
      userId
    );

    return NextResponse.json({
      success: true,
      framework,
      message: '文档框架创建成功',
    });
  } catch (error) {
    console.error('Create framework error:', error);
    return NextResponse.json(
      { error: '创建框架失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, (req, userId) =>
    getFrameworks(req, context, userId)
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, (req, userId) =>
    createFramework(req, context, userId)
  );
}

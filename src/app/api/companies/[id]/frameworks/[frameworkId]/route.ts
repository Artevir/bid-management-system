/**
 * 单个公司文档框架API
 * GET: 获取框架详情
 * PUT: 更新框架
 * DELETE: 删除框架
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { companyFrameworkService, type CreateChapterData } from '@/lib/services/company-framework-service';

// ============================================
// 获取框架详情
// ============================================

async function getFramework(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; frameworkId: string }> },
  _userId: number
): Promise<NextResponse> {
  try {
    const { frameworkId: fwId } = await params;
    const frameworkId = parseInt(fwId);
    if (isNaN(frameworkId)) {
      return NextResponse.json({ error: '无效的框架ID' }, { status: 400 });
    }

    const framework = await companyFrameworkService.getFrameworkById(frameworkId);
    if (!framework) {
      return NextResponse.json({ error: '框架不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      framework,
    });
  } catch (error) {
    console.error('Get framework error:', error);
    return NextResponse.json({ error: '获取框架详情失败' }, { status: 500 });
  }
}

// ============================================
// 更新框架
// ============================================

async function updateFramework(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; frameworkId: string }> },
  _userId: number
): Promise<NextResponse> {
  try {
    const { id, frameworkId: fwId } = await params;
    const companyId = parseInt(id);
    const frameworkId = parseInt(fwId);
    if (isNaN(companyId) || isNaN(frameworkId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description, documentType, isDefault, isActive, chapters } = body;

    // 更新基本信息
    if (name || description !== undefined || documentType || isDefault !== undefined || isActive !== undefined) {
      await companyFrameworkService.updateFramework(frameworkId, {
        name,
        description,
        documentType,
        isDefault,
        isActive,
      });
    }

    // 更新章节（如果提供）
    if (chapters !== undefined) {
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

      await companyFrameworkService.updateChapters(frameworkId, convertChapters(chapters));
    }

    const framework = await companyFrameworkService.getFrameworkById(frameworkId);

    return NextResponse.json({
      success: true,
      framework,
      message: '框架更新成功',
    });
  } catch (error) {
    console.error('Update framework error:', error);
    return NextResponse.json(
      { error: '更新框架失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

// ============================================
// 删除框架
// ============================================

async function deleteFramework(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; frameworkId: string }> },
  _userId: number
): Promise<NextResponse> {
  try {
    const { frameworkId: fwId } = await params;
    const frameworkId = parseInt(fwId);
    if (isNaN(frameworkId)) {
      return NextResponse.json({ error: '无效的框架ID' }, { status: 400 });
    }

    await companyFrameworkService.deleteFramework(frameworkId);

    return NextResponse.json({
      success: true,
      message: '框架已删除',
    });
  } catch (error) {
    console.error('Delete framework error:', error);
    return NextResponse.json({ error: '删除框架失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; frameworkId: string }> }
) {
  return withAuth(request, (req, userId) =>
    getFramework(req, context, userId)
  );
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; frameworkId: string }> }
) {
  return withAuth(request, (req, userId) =>
    updateFramework(req, context, userId)
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; frameworkId: string }> }
) {
  return withAuth(request, (req, userId) =>
    deleteFramework(req, context, userId)
  );
}

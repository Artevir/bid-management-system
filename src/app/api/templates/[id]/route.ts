/**
 * 标书模板详情API
 * GET: 获取模板详情
 * PUT: 更新模板
 * DELETE: 删除模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getTemplateDetail,
  updateTemplate,
  deleteTemplate,
  applyTemplateToDocument,
  createTemplateFromDocument,
} from '@/lib/bid/template';

// 获取模板详情
async function getDetail(
  request: NextRequest,
  userId: number,
  templateId: number
): Promise<NextResponse> {
  try {
    const template = await getTemplateDetail(templateId);

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    return NextResponse.json({
      template: {
        ...template,
        content: template.content ? JSON.parse(template.content) : null,
      },
    });
  } catch (error) {
    console.error('Get template detail error:', error);
    return NextResponse.json({ error: '获取模板详情失败' }, { status: 500 });
  }
}

// 更新模板
async function updateTemplateHandler(
  request: NextRequest,
  userId: number,
  templateId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, category, industry, description, content, isActive } = body;

    await updateTemplate(templateId, {
      name,
      category,
      industry,
      description,
      content,
      isActive,
    });

    return NextResponse.json({
      success: true,
      message: '模板已更新',
    });
  } catch (error) {
    console.error('Update template error:', error);
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 });
  }
}

// 删除模板
async function deleteTemplateHandler(
  request: NextRequest,
  userId: number,
  templateId: number
): Promise<NextResponse> {
  try {
    await deleteTemplate(templateId);

    return NextResponse.json({
      success: true,
      message: '模板已删除',
    });
  } catch (error) {
    console.error('Delete template error:', error);
    const message = error instanceof Error ? error.message : '删除模板失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 应用模板到文档
async function applyTemplate(
  request: NextRequest,
  userId: number,
  templateId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    await applyTemplateToDocument(templateId, documentId);

    return NextResponse.json({
      success: true,
      message: '模板已应用到文档',
    });
  } catch (error) {
    console.error('Apply template error:', error);
    const message = error instanceof Error ? error.message : '应用模板失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getDetail(req, userId, parseInt(id)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) =>
    updateTemplateHandler(req, userId, parseInt(id))
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) =>
    deleteTemplateHandler(req, userId, parseInt(id))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) =>
    applyTemplate(req, userId, parseInt(id))
  );
}

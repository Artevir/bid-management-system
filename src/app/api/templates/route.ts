/**
 * 标书模板API
 * GET: 获取模板列表
 * POST: 创建模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getTemplates,
  createTemplate,
  getTemplateCategories,
  getIndustries,
} from '@/lib/bid/template';

// 获取模板列表
async function listTemplates(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const industry = searchParams.get('industry') || undefined;
    const search = searchParams.get('search') || undefined;

    const templates = await getTemplates({
      category,
      industry,
      isActive: true,
      search,
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json({ error: '获取模板列表失败' }, { status: 500 });
  }
}

// 创建模板
async function createTemplateHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, code, category, industry, description, content } = body;

    if (!name || !code) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const templateId = await createTemplate({
      name,
      code,
      category,
      industry,
      description,
      content,
      createdBy: userId,
    });

    return NextResponse.json({
      success: true,
      templateId,
    });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 });
  }
}

// 获取分类和行业列表
async function getCategoriesAndIndustries(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const [categories, industries] = await Promise.all([
      getTemplateCategories(),
      getIndustries(),
    ]);

    return NextResponse.json({
      categories,
      industries,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json({ error: '获取分类失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'categories') {
    return withAuth(request, (req, userId) => getCategoriesAndIndustries(req, userId));
  }

  return withAuth(request, (req, userId) => listTemplates(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createTemplateHandler(req, userId));
}

/**
 * 投标文档模板管理API
 * 提供文档模板的CRUD功能
 *
 * GET: 获取文档模板列表
 * POST: 创建文档模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { docFrameworks, companies } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================
// GET - 获取文档模板列表
// ============================================

async function getDocumentTemplates(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category') || 'general';
    const isDefault = searchParams.get('isDefault');

    // 构建查询条件
    const conditions = [];

    if (companyId) {
      conditions.push(eq(docFrameworks.companyId, parseInt(companyId)));
    }

    if (category) {
      conditions.push(eq(docFrameworks.category, category));
    }

    if (isDefault === 'true') {
      conditions.push(eq(docFrameworks.isDefault, true));
    }

    // 查询模板
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const templates = await db
      .select({
        id: docFrameworks.id,
        name: docFrameworks.name,
        description: docFrameworks.description,
        category: docFrameworks.category,
        isDefault: docFrameworks.isDefault,
        companyId: docFrameworks.companyId,
        createdAt: docFrameworks.createdAt,
        company: {
          id: companies.id,
          name: companies.name,
        },
      })
      .from(docFrameworks)
      .leftJoin(companies, eq(docFrameworks.companyId, companies.id))
      .where(whereClause)
      .orderBy(docFrameworks.createdAt);

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Get document templates error:', error);
    return NextResponse.json(
      { error: '获取模板列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - 创建文档模板
// ============================================

async function createDocumentTemplate(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      companyId,
      isDefault,
    } = body;

    if (!name || !category) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 如果设置为默认，取消该公司的其他默认模板
    if (isDefault && companyId) {
      await db
        .update(docFrameworks)
        .set({ isDefault: false })
        .where(
          and(
            eq(docFrameworks.companyId, parseInt(companyId)),
            eq(docFrameworks.category, category)
          )
        );
    }

    // 创建模板
    const [template] = await db
      .insert(docFrameworks)
      .values({
        name,
        description,
        category,
        companyId: companyId ? parseInt(companyId) : null,
        isDefault: isDefault || false,
        createdBy: userId,
        updatedAt: new Date(),
      })
      .returning({ id: docFrameworks.id });

    return NextResponse.json({
      success: true,
      templateId: template.id,
      message: '模板创建成功',
    });
  } catch (error) {
    console.error('Create document template error:', error);
    return NextResponse.json(
      { error: '创建模板失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getDocumentTemplates(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createDocumentTemplate(req, userId));
}

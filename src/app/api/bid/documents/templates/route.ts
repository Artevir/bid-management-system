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
import { eq, and, desc } from 'drizzle-orm';
import { success, created, AppError, handleError } from '@/lib/api/error-handler';

// ============================================
// GET - 获取文档模板列表
// ============================================

async function getTemplates(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const category = searchParams.get('category');
  const isDefault = searchParams.get('isDefault');

  // 构建查询条件
  const conditions = [];

  if (companyId) {
    conditions.push(eq(docFrameworks.companyId, parseInt(companyId, 10)));
  }

  if (category) {
    conditions.push(eq(docFrameworks.category, category));
  }

  if (isDefault !== null) {
    conditions.push(eq(docFrameworks.isDefault, isDefault === 'true'));
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
    .orderBy(desc(docFrameworks.isDefault), docFrameworks.createdAt);

  return success(templates);
}

// ============================================
// POST - 创建文档模板
// ============================================

async function createTemplate(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const {
    name,
    description,
    category,
    companyId,
    isDefault,
  } = body;

  if (!name || !category) {
    throw AppError.badRequest('缺少必填字段: name, category');
  }

  const [template] = await db
    .insert(docFrameworks)
    .values({
      name,
      description,
      category,
      companyId,
      isDefault: isDefault ?? false,
      createdBy: userId,
    })
    .returning();

  return created(template, '模板创建成功');
}

export async function GET(request: NextRequest) {
  return withAuth(request, getTemplates);
}

export async function POST(request: NextRequest) {
  return withAuth(request, createTemplate);
}

/**
 * 章节模板分类管理API
 * 支持分类的增删改查操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { chapterTemplateCategories, chapterTemplates } from '@/db/schema';
import { eq, asc, desc, count, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取所有分类
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // 查询分类及其模板数量
    const categories = await db
      .select({
        id: chapterTemplateCategories.id,
        name: chapterTemplateCategories.name,
        code: chapterTemplateCategories.code,
        description: chapterTemplateCategories.description,
        icon: chapterTemplateCategories.icon,
        color: chapterTemplateCategories.color,
        sortOrder: chapterTemplateCategories.sortOrder,
        isActive: chapterTemplateCategories.isActive,
        isSystem: chapterTemplateCategories.isSystem,
        createdAt: chapterTemplateCategories.createdAt,
        updatedAt: chapterTemplateCategories.updatedAt,
        templateCount: count(chapterTemplates.id),
      })
      .from(chapterTemplateCategories)
      .leftJoin(
        chapterTemplates,
        eq(chapterTemplateCategories.id, chapterTemplates.categoryId)
      )
      .where(
        includeInactive
          ? sql`1=1`
          : eq(chapterTemplateCategories.isActive, true)
      )
      .groupBy(chapterTemplateCategories.id)
      .orderBy(asc(chapterTemplateCategories.sortOrder));

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    return NextResponse.json({ error: '获取分类失败' }, { status: 500 });
  }
}

// ============================================
// POST: 创建新分类
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { name, code, description, icon, color, sortOrder } = body;

    if (!name || !code) {
      return NextResponse.json({ error: '分类名称和编码不能为空' }, { status: 400 });
    }

    // 检查编码是否已存在
    const [existing] = await db
      .select()
      .from(chapterTemplateCategories)
      .where(eq(chapterTemplateCategories.code, code));

    if (existing) {
      return NextResponse.json({ error: '分类编码已存在' }, { status: 400 });
    }

    // 获取当前最大排序号
    if (sortOrder === undefined) {
      const [maxSort] = await db
        .select({ max: sql<number>`COALESCE(MAX(${chapterTemplateCategories.sortOrder}), 0)` })
        .from(chapterTemplateCategories);
      body.sortOrder = (maxSort?.max || 0) + 1;
    }

    const [category] = await db
      .insert(chapterTemplateCategories)
      .values({
        name,
        code,
        description,
        icon: icon || 'Folder',
        color: color || '#6366f1',
        sortOrder: body.sortOrder || 0,
        createdBy: Number(currentUser.id),
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: '分类创建成功',
      data: category,
    });
  } catch (error) {
    console.error('创建分类失败:', error);
    return NextResponse.json({ error: '创建分类失败' }, { status: 500 });
  }
}

// ============================================
// PUT: 更新分类
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, code, description, icon, color, sortOrder, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: '分类ID不能为空' }, { status: 400 });
    }

    // 检查分类是否存在
    const [existing] = await db
      .select()
      .from(chapterTemplateCategories)
      .where(eq(chapterTemplateCategories.id, id));

    if (!existing) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }

    // 如果要修改编码，检查新编码是否已被使用
    if (code && code !== existing.code) {
      const [duplicate] = await db
        .select()
        .from(chapterTemplateCategories)
        .where(eq(chapterTemplateCategories.code, code));

      if (duplicate) {
        return NextResponse.json({ error: '分类编码已存在' }, { status: 400 });
      }
    }

    const [updated] = await db
      .update(chapterTemplateCategories)
      .set({
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(chapterTemplateCategories.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      message: '分类更新成功',
      data: updated,
    });
  } catch (error) {
    console.error('更新分类失败:', error);
    return NextResponse.json({ error: '更新分类失败' }, { status: 500 });
  }
}

// ============================================
// DELETE: 删除分类
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '分类ID不能为空' }, { status: 400 });
    }

    // 检查分类是否存在
    const [existing] = await db
      .select()
      .from(chapterTemplateCategories)
      .where(eq(chapterTemplateCategories.id, parseInt(id)));

    if (!existing) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }

    // 检查分类下是否有模板
    const templates = await db
      .select({ count: count() })
      .from(chapterTemplates)
      .where(eq(chapterTemplates.categoryId, parseInt(id)));

    if (templates[0].count > 0) {
      return NextResponse.json(
        { error: '该分类下存在模板，请先删除模板或迁移到其他分类' },
        { status: 400 }
      );
    }

    await db
      .delete(chapterTemplateCategories)
      .where(eq(chapterTemplateCategories.id, parseInt(id)));

    return NextResponse.json({
      success: true,
      message: '分类删除成功',
    });
  } catch (error) {
    console.error('删除分类失败:', error);
    return NextResponse.json({ error: '删除分类失败' }, { status: 500 });
  }
}

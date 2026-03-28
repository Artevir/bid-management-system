/**
 * 筛选方案保存API
 * 支持保存、加载、管理筛选方案
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { savedFilters } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取筛选方案列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');

    const conditions = [eq(savedFilters.userId, currentUser.userId)];
    
    if (entityType) {
      conditions.push(eq(savedFilters.entityType, entityType));
    }

    const filters = await db
      .select()
      .from(savedFilters)
      .where(and(...conditions))
      .orderBy(desc(savedFilters.isDefault), asc(savedFilters.sortOrder), desc(savedFilters.updatedAt));

    return NextResponse.json({ items: filters });
  } catch (error) {
    console.error('获取筛选方案失败:', error);
    return NextResponse.json(
      { error: '获取筛选方案失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建筛选方案
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { name, entityType, filters, isDefault, sortOrder } = body;

    if (!name || !entityType || !filters) {
      return NextResponse.json(
        { error: '缺少必填字段：name, entityType, filters' },
        { status: 400 }
      );
    }

    // 如果设为默认，先取消其他默认方案
    if (isDefault) {
      await db
        .update(savedFilters)
        .set({ isDefault: false })
        .where(
          and(
            eq(savedFilters.userId, currentUser.userId),
            eq(savedFilters.entityType, entityType)
          )
        );
    }

    const [saved] = await db
      .insert(savedFilters)
      .values({
        userId: currentUser.userId,
        name,
        entityType,
        filters: JSON.stringify(filters),
        isDefault: isDefault || false,
        sortOrder: sortOrder || 0,
      })
      .returning();

    return NextResponse.json({ item: saved });
  } catch (error) {
    console.error('创建筛选方案失败:', error);
    return NextResponse.json(
      { error: '创建筛选方案失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新筛选方案
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, filters, isDefault, sortOrder } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少筛选方案ID' },
        { status: 400 }
      );
    }

    // 检查方案是否存在
    const [existing] = await db
      .select()
      .from(savedFilters)
      .where(
        and(
          eq(savedFilters.id, id),
          eq(savedFilters.userId, currentUser.userId)
        )
      );

    if (!existing) {
      return NextResponse.json(
        { error: '筛选方案不存在' },
        { status: 404 }
      );
    }

    // 如果设为默认，先取消其他默认方案
    if (isDefault) {
      await db
        .update(savedFilters)
        .set({ isDefault: false })
        .where(
          and(
            eq(savedFilters.userId, currentUser.userId),
            eq(savedFilters.entityType, existing.entityType)
          )
        );
    }

    const [updated] = await db
      .update(savedFilters)
      .set({
        name: name || existing.name,
        filters: filters ? JSON.stringify(filters) : existing.filters,
        isDefault: isDefault !== undefined ? isDefault : existing.isDefault,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(savedFilters.id, id))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('更新筛选方案失败:', error);
    return NextResponse.json(
      { error: '更新筛选方案失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除筛选方案
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少筛选方案ID' },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(savedFilters)
      .where(
        and(
          eq(savedFilters.id, parseInt(id)),
          eq(savedFilters.userId, currentUser.userId)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: '筛选方案不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除筛选方案失败:', error);
    return NextResponse.json(
      { error: '删除筛选方案失败' },
      { status: 500 }
    );
  }
}

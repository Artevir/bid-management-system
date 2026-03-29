/**
 * 收藏功能API
 * 支持标签和分类的收藏管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { favorites, unifiedTags, tagCategories } from '@/db/schema';
import { eq, and, desc, asc, inArray as _inArray, sql as _sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取收藏列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const limit = parseInt(searchParams.get('limit') || '50');

    const conditions = [eq(favorites.userId, currentUser.userId)];
    
    if (entityType) {
      conditions.push(eq(favorites.entityType, entityType));
    }

    const favoriteList = await db
      .select({
        id: favorites.id,
        entityType: favorites.entityType,
        entityId: favorites.entityId,
        entityName: favorites.entityName,
        note: favorites.note,
        sortOrder: favorites.sortOrder,
        createdAt: favorites.createdAt,
      })
      .from(favorites)
      .where(and(...conditions))
      .orderBy(asc(favorites.sortOrder), desc(favorites.createdAt))
      .limit(limit);

    // 补充实体详细信息
    const result = await Promise.all(
      favoriteList.map(async (fav) => {
        let entityDetail: any = null;

        if (fav.entityType === 'tag') {
          const [tag] = await db
            .select({
              id: unifiedTags.id,
              name: unifiedTags.name,
              code: unifiedTags.code,
              color: unifiedTags.color,
              type: unifiedTags.type,
              useCount: unifiedTags.useCount,
              description: unifiedTags.description,
            })
            .from(unifiedTags)
            .where(eq(unifiedTags.id, fav.entityId));
          entityDetail = tag;
        } else if (fav.entityType === 'category') {
          const [category] = await db
            .select({
              id: tagCategories.id,
              name: tagCategories.name,
              code: tagCategories.code,
              color: tagCategories.color,
              description: tagCategories.description,
            })
            .from(tagCategories)
            .where(eq(tagCategories.id, fav.entityId));
          entityDetail = category;
        }

        return {
          ...fav,
          entityDetail,
        };
      })
    );

    return NextResponse.json({ items: result });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    return NextResponse.json(
      { error: '获取收藏列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 添加收藏
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { entityType, entityId, entityName, note, sortOrder } = body;

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: '缺少必填字段：entityType, entityId' },
        { status: 400 }
      );
    }

    // 检查是否已收藏
    const [existing] = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, currentUser.userId),
          eq(favorites.entityType, entityType),
          eq(favorites.entityId, entityId)
        )
      );

    if (existing) {
      return NextResponse.json(
        { error: '已收藏' },
        { status: 400 }
      );
    }

    const [fav] = await db
      .insert(favorites)
      .values({
        userId: currentUser.userId,
        entityType,
        entityId,
        entityName,
        note,
        sortOrder: sortOrder || 0,
      })
      .returning();

    return NextResponse.json({ item: fav });
  } catch (error) {
    console.error('添加收藏失败:', error);
    return NextResponse.json(
      { error: '添加收藏失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新收藏
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { id, note, sortOrder } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少收藏ID' },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(favorites)
      .set({
        note: note,
        sortOrder: sortOrder,
      })
      .where(
        and(
          eq(favorites.id, id),
          eq(favorites.userId, currentUser.userId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: '收藏不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('更新收藏失败:', error);
    return NextResponse.json(
      { error: '更新收藏失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 取消收藏
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (id) {
      // 通过ID删除
      const [deleted] = await db
        .delete(favorites)
        .where(
          and(
            eq(favorites.id, parseInt(id)),
            eq(favorites.userId, currentUser.userId)
          )
        )
        .returning();

      if (!deleted) {
        return NextResponse.json(
          { error: '收藏不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (entityType && entityId) {
      // 通过实体类型和ID删除
      const [deleted] = await db
        .delete(favorites)
        .where(
          and(
            eq(favorites.userId, currentUser.userId),
            eq(favorites.entityType, entityType),
            eq(favorites.entityId, parseInt(entityId))
          )
        )
        .returning();

      if (!deleted) {
        return NextResponse.json(
          { error: '收藏不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: '缺少必要参数' },
      { status: 400 }
    );
  } catch (error) {
    console.error('取消收藏失败:', error);
    return NextResponse.json(
      { error: '取消收藏失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH: 批量更新排序
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { orders } = body; // [{ id: 1, sortOrder: 0 }, { id: 2, sortOrder: 1 }, ...]

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { error: '缺少排序数据' },
        { status: 400 }
      );
    }

    for (const item of orders) {
      await db
        .update(favorites)
        .set({ sortOrder: item.sortOrder })
        .where(
          and(
            eq(favorites.id, item.id),
            eq(favorites.userId, currentUser.userId)
          )
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('批量更新排序失败:', error);
    return NextResponse.json(
      { error: '批量更新排序失败' },
      { status: 500 }
    );
  }
}

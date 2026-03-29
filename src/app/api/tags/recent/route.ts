/**
 * 最近访问记录API
 * 支持记录、查询最近访问的标签和分类
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { recentVisits, unifiedTags, tagCategories } from '@/db/schema';
import { eq, and, desc, inArray as _inArray, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取最近访问记录
// ============================================

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const limit = parseInt(searchParams.get('limit') || '20');

    const conditions = [eq(recentVisits.userId, currentUser.userId)];
    
    if (entityType) {
      conditions.push(eq(recentVisits.entityType, entityType));
    }

    const visits = await db
      .select({
        id: recentVisits.id,
        entityType: recentVisits.entityType,
        entityId: recentVisits.entityId,
        entityName: recentVisits.entityName,
        entityData: recentVisits.entityData,
        visitCount: recentVisits.visitCount,
        lastVisitedAt: recentVisits.lastVisitedAt,
      })
      .from(recentVisits)
      .where(and(...conditions))
      .orderBy(desc(recentVisits.lastVisitedAt))
      .limit(limit);

    // 补充实体详细信息
    const result = await Promise.all(
      visits.map(async (visit) => {
        let entityDetail: any = null;

        if (visit.entityType === 'tag') {
          const [tag] = await db
            .select({
              id: unifiedTags.id,
              name: unifiedTags.name,
              color: unifiedTags.color,
              type: unifiedTags.type,
            })
            .from(unifiedTags)
            .where(eq(unifiedTags.id, visit.entityId));
          entityDetail = tag;
        } else if (visit.entityType === 'category') {
          const [category] = await db
            .select({
              id: tagCategories.id,
              name: tagCategories.name,
              color: tagCategories.color,
            })
            .from(tagCategories)
            .where(eq(tagCategories.id, visit.entityId));
          entityDetail = category;
        }

        return {
          ...visit,
          entityDetail,
        };
      })
    );

    return NextResponse.json({ items: result });
  } catch (error) {
    console.error('获取最近访问记录失败:', error);
    return NextResponse.json(
      { error: '获取最近访问记录失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 记录访问
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { entityType, entityId, entityName, entityData } = body;

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: '缺少必填字段：entityType, entityId' },
        { status: 400 }
      );
    }

    // 检查是否已存在记录
    const [existing] = await db
      .select()
      .from(recentVisits)
      .where(
        and(
          eq(recentVisits.userId, currentUser.userId),
          eq(recentVisits.entityType, entityType),
          eq(recentVisits.entityId, entityId)
        )
      );

    if (existing) {
      // 更新访问次数和时间
      const [updated] = await db
        .update(recentVisits)
        .set({
          visitCount: sql`${recentVisits.visitCount} + 1`,
          lastVisitedAt: new Date(),
          entityName: entityName || existing.entityName,
          entityData: entityData || existing.entityData,
        })
        .where(eq(recentVisits.id, existing.id))
        .returning();

      return NextResponse.json({ item: updated });
    }

    // 创建新记录
    const [visit] = await db
      .insert(recentVisits)
      .values({
        userId: currentUser.userId,
        entityType,
        entityId,
        entityName,
        entityData: entityData ? JSON.stringify(entityData) : null,
        visitCount: 1,
        lastVisitedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ item: visit });
  } catch (error) {
    console.error('记录访问失败:', error);
    return NextResponse.json(
      { error: '记录访问失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 清除访问记录
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
    const clearAll = searchParams.get('clearAll') === 'true';

    if (clearAll) {
      // 清除所有记录
      await db
        .delete(recentVisits)
        .where(eq(recentVisits.userId, currentUser.userId));

      return NextResponse.json({ success: true, message: '已清除所有访问记录' });
    }

    if (id) {
      // 删除单条记录
      const [deleted] = await db
        .delete(recentVisits)
        .where(
          and(
            eq(recentVisits.id, parseInt(id)),
            eq(recentVisits.userId, currentUser.userId)
          )
        )
        .returning();

      if (!deleted) {
        return NextResponse.json(
          { error: '记录不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (entityType) {
      // 删除特定类型的记录
      await db
        .delete(recentVisits)
        .where(
          and(
            eq(recentVisits.userId, currentUser.userId),
            eq(recentVisits.entityType, entityType)
          )
        );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: '缺少必要参数' },
      { status: 400 }
    );
  } catch (error) {
    console.error('清除访问记录失败:', error);
    return NextResponse.json(
      { error: '清除访问记录失败' },
      { status: 500 }
    );
  }
}

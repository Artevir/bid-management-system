/**
 * 标签数据统计API
 * 支持使用统计、热度分析、趋势分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { unifiedTags, tagCategories, entityTags, users as _users } from '@/db/schema';
import { eq, and, desc, asc as _asc, sql, gte, lte, inArray as _inArray, count as _count, sum as _sum } from 'drizzle-orm';
import { getCurrentUser as _getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取统计数据
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'overview'; // overview/usage/hot/trend/user
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const categoryId = searchParams.get('categoryId');
    const limit = parseInt(searchParams.get('limit') || '10');

    switch (type) {
      case 'overview':
        return await getOverviewStats();
      case 'usage':
        return await getUsageStats(categoryId, limit);
      case 'hot':
        return await getHotTags(limit);
      case 'trend':
        return await getTrendStats(startDate, endDate);
      case 'category':
        return await getCategoryStats();
      case 'entity':
        return await getEntityStats();
      default:
        return await getOverviewStats();
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}

// ============================================
// 总览统计
// ============================================

async function getOverviewStats() {
  // 标签总数
  const tagCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(unifiedTags)
    .where(eq(unifiedTags.isActive, true));

  // 分类总数
  const categoryCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(tagCategories)
    .where(eq(tagCategories.isActive, true));

  // 关联总数
  const relationCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(entityTags);

  // 系统标签数
  const systemTagCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(unifiedTags)
    .where(and(eq(unifiedTags.isActive, true), eq(unifiedTags.isSystem, true)));

  // 按类型统计
  const typeStats = await db
    .select({
      type: unifiedTags.type,
      count: sql<number>`count(*)`,
    })
    .from(unifiedTags)
    .where(eq(unifiedTags.isActive, true))
    .groupBy(unifiedTags.type);

  // 最近7天新增
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentTags = await db
    .select({ count: sql<number>`count(*)` })
    .from(unifiedTags)
    .where(gte(unifiedTags.createdAt, sevenDaysAgo));

  return NextResponse.json({
    overview: {
      totalTags: tagCount[0]?.count || 0,
      totalCategories: categoryCount[0]?.count || 0,
      totalRelations: relationCount[0]?.count || 0,
      systemTags: systemTagCount[0]?.count || 0,
      recentTags: recentTags[0]?.count || 0,
      typeStats: typeStats.reduce((acc, item) => {
        acc[item.type] = item.count;
        return acc;
      }, {} as Record<string, number>),
    },
  });
}

// ============================================
// 使用统计
// ============================================

async function getUsageStats(categoryId: string | null, limit: number) {
  const conditions: any[] = [eq(unifiedTags.isActive, true)];

  if (categoryId) {
    conditions.push(eq(unifiedTags.categoryId, parseInt(categoryId)));
  }

  // 使用次数排名
  const topUsed = await db
    .select({
      id: unifiedTags.id,
      name: unifiedTags.name,
      code: unifiedTags.code,
      color: unifiedTags.color,
      useCount: unifiedTags.useCount,
      category: {
        id: tagCategories.id,
        name: tagCategories.name,
        color: tagCategories.color,
      },
    })
    .from(unifiedTags)
    .leftJoin(tagCategories, eq(unifiedTags.categoryId, tagCategories.id))
    .where(and(...conditions))
    .orderBy(desc(unifiedTags.useCount))
    .limit(limit);

  // 使用次数分布
  const distribution = await db
    .select({
      range: sql<string>`
        CASE 
          WHEN use_count = 0 THEN '0次'
          WHEN use_count BETWEEN 1 AND 5 THEN '1-5次'
          WHEN use_count BETWEEN 6 AND 20 THEN '6-20次'
          WHEN use_count BETWEEN 21 AND 50 THEN '21-50次'
          WHEN use_count > 50 THEN '50次以上'
        END
      `,
      count: sql<number>`count(*)`,
    })
    .from(unifiedTags)
    .where(and(...conditions))
    .groupBy(sql`
      CASE 
        WHEN use_count = 0 THEN '0次'
        WHEN use_count BETWEEN 1 AND 5 THEN '1-5次'
        WHEN use_count BETWEEN 6 AND 20 THEN '6-20次'
        WHEN use_count BETWEEN 21 AND 50 THEN '21-50次'
        WHEN use_count > 50 THEN '50次以上'
      END
    `);

  return NextResponse.json({
    topUsed,
    distribution,
  });
}

// ============================================
// 热门标签
// ============================================

async function getHotTags(limit: number) {
  // 综合热度 = 使用次数 * 0.6 + 最近使用次数 * 0.3 + 收藏数 * 0.1
  const hotTags = await db
    .select({
      id: unifiedTags.id,
      name: unifiedTags.name,
      code: unifiedTags.code,
      color: unifiedTags.color,
      useCount: unifiedTags.useCount,
      createdAt: unifiedTags.createdAt,
      category: {
        id: tagCategories.id,
        name: tagCategories.name,
        color: tagCategories.color,
      },
      // 计算热度分数
      hotScore: sql<number>`
        ${unifiedTags.useCount} * 0.6 + 
        (SELECT COUNT(*) FROM entity_tags WHERE entity_tags.tag_id = ${unifiedTags.id} AND entity_tags.added_at > NOW() - INTERVAL '30 days') * 0.3 +
        (SELECT COUNT(*) FROM favorites WHERE favorites.entity_type = 'tag' AND favorites.entity_id = ${unifiedTags.id}) * 0.1
      `,
    })
    .from(unifiedTags)
    .leftJoin(tagCategories, eq(unifiedTags.categoryId, tagCategories.id))
    .where(eq(unifiedTags.isActive, true))
    .orderBy(desc(sql`hot_score`))
    .limit(limit);

  // 近期热门（最近30天）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentHot = await db
    .select({
      id: unifiedTags.id,
      name: unifiedTags.name,
      color: unifiedTags.color,
      recentUseCount: sql<number>`COUNT(${entityTags.id})`,
    })
    .from(unifiedTags)
    .leftJoin(entityTags, and(
      eq(entityTags.tagId, unifiedTags.id),
      gte(entityTags.addedAt, thirtyDaysAgo)
    ))
    .where(eq(unifiedTags.isActive, true))
    .groupBy(unifiedTags.id)
    .orderBy(desc(sql`recent_use_count`))
    .limit(limit);

  return NextResponse.json({
    hotTags,
    recentHot,
  });
}

// ============================================
// 趋势统计
// ============================================

async function getTrendStats(startDate: string | null, endDate: string | null) {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // 每日新增标签
  const dailyNewTags = await db
    .select({
      date: sql<string>`DATE(${unifiedTags.createdAt})`,
      count: sql<number>`count(*)`,
    })
    .from(unifiedTags)
    .where(and(
      gte(unifiedTags.createdAt, start),
      lte(unifiedTags.createdAt, end)
    ))
    .groupBy(sql`DATE(${unifiedTags.createdAt})`)
    .orderBy(sql`DATE(${unifiedTags.createdAt})`);

  // 每日使用情况
  const dailyUsage = await db
    .select({
      date: sql<string>`DATE(${entityTags.addedAt})`,
      count: sql<number>`count(*)`,
    })
    .from(entityTags)
    .where(and(
      gte(entityTags.addedAt, start),
      lte(entityTags.addedAt, end)
    ))
    .groupBy(sql`DATE(${entityTags.addedAt})`)
    .orderBy(sql`DATE(${entityTags.addedAt})`);

  return NextResponse.json({
    dailyNewTags,
    dailyUsage,
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });
}

// ============================================
// 分类统计
// ============================================

async function getCategoryStats() {
  // 分类使用情况
  const categoryStats = await db
    .select({
      id: tagCategories.id,
      name: tagCategories.name,
      code: tagCategories.code,
      color: tagCategories.color,
      entityType: tagCategories.entityType,
      tagCount: sql<number>`COUNT(${unifiedTags.id})`,
      totalUseCount: sql<number>`COALESCE(SUM(${unifiedTags.useCount}), 0)`,
    })
    .from(tagCategories)
    .leftJoin(unifiedTags, eq(tagCategories.id, unifiedTags.categoryId))
    .where(eq(tagCategories.isActive, true))
    .groupBy(tagCategories.id)
    .orderBy(desc(sql`tag_count`));

  return NextResponse.json({
    categories: categoryStats,
  });
}

// ============================================
// 实体关联统计
// ============================================

async function getEntityStats() {
  // 按实体类型统计
  const entityTypeStats = await db
    .select({
      entityType: entityTags.entityType,
      tagCount: sql<number>`COUNT(DISTINCT ${entityTags.tagId})`,
      relationCount: sql<number>`COUNT(*)`,
    })
    .from(entityTags)
    .groupBy(entityTags.entityType)
    .orderBy(desc(sql`relation_count`));

  // 每个标签关联的实体类型数
  const tagEntityTypes = await db
    .select({
      id: unifiedTags.id,
      name: unifiedTags.name,
      color: unifiedTags.color,
      entityTypeCount: sql<number>`COUNT(DISTINCT ${entityTags.entityType})`,
    })
    .from(unifiedTags)
    .leftJoin(entityTags, eq(unifiedTags.id, entityTags.tagId))
    .where(eq(unifiedTags.isActive, true))
    .groupBy(unifiedTags.id)
    .orderBy(desc(sql`entity_type_count`))
    .limit(20);

  return NextResponse.json({
    entityTypeStats,
    tagEntityTypes,
  });
}

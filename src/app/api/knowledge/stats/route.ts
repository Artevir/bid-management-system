/**
 * 知识统计API
 * GET: 获取知识使用统计、热门推荐、趋势数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { knowledgeItems, knowledgeCategories } from '@/db/schema';
import { eq, desc, gte, and, or } from 'drizzle-orm';

interface StatsParams {
  type?: 'overview' | 'trending' | 'category' | 'recent';
  period?: '7d' | '30d' | '90d' | 'all';
  categoryId?: string;
  topK?: number;
}

async function getKnowledgeStats(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'overview') as StatsParams['type'];
    const period = (searchParams.get('period') || '30d') as StatsParams['period'];
    const categoryId = searchParams.get('categoryId');
    const topK = parseInt(searchParams.get('topK') || '10');

    const now = new Date();
    let startDate: Date | null = null;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = null;
    }

    switch (type) {
      case 'overview':
        const totalItems = await db
          .select({ count: knowledgeItems.id })
          .from(knowledgeItems)
          .where(eq(knowledgeItems.status, 'approved'));

        const totalViews = await db
          .select({ total: knowledgeItems.viewCount })
          .from(knowledgeItems);

        const totalUses = await db
          .select({ total: knowledgeItems.useCount })
          .from(knowledgeItems);

        const categoryStats = await db
          .select({
            categoryId: knowledgeCategories.id,
            categoryName: knowledgeCategories.name,
            itemCount: sql<number>`count(${knowledgeItems.id})`,
            totalViews: sql<number>`coalesce(sum(${knowledgeItems.viewCount}), 0)`,
            totalUses: sql<number>`coalesce(sum(${knowledgeItems.useCount}), 0)`,
          })
          .from(knowledgeCategories)
          .leftJoin(knowledgeItems, eq(knowledgeItems.categoryId, knowledgeCategories.id))
          .groupBy(knowledgeCategories.id, knowledgeCategories.name)
          .orderBy(desc(sql<number>`count(${knowledgeItems.id})`));

        return NextResponse.json({
          success: true,
          stats: {
            totalItems: totalItems[0]?.count || 0,
            totalViews: totalViews.reduce((sum, item) => sum + (item.total || 0), 0),
            totalUses: totalUses.reduce((sum, item) => sum + (item.total || 0), 0),
            categories: categoryStats.map(c => ({
              id: c.categoryId,
              name: c.categoryName,
              itemCount: Number(c.itemCount) || 0,
              totalViews: Number(c.totalViews),
              totalUses: Number(c.totalUses),
            })),
          },
        });

      case 'trending':
        const trendingItems = await db
          .select({
            id: knowledgeItems.id,
            title: knowledgeItems.title,
            summary: knowledgeItems.summary,
            viewCount: knowledgeItems.viewCount,
            useCount: knowledgeItems.useCount,
            categoryId: knowledgeItems.categoryId,
            updatedAt: knowledgeItems.updatedAt,
          })
          .from(knowledgeItems)
          .where(eq(knowledgeItems.status, 'approved'))
          .orderBy(desc(knowledgeItems.useCount), desc(knowledgeItems.viewCount))
          .limit(topK);

        const categoryMap = new Map(
          await db
            .select({ id: knowledgeCategories.id, name: knowledgeCategories.name })
            .from(knowledgeCategories)
        );

        return NextResponse.json({
          success: true,
          trending: trendingItems.map(item => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
            viewCount: item.viewCount,
            useCount: item.useCount,
            category: categoryMap.get(item.categoryId),
            updatedAt: item.updatedAt,
          })),
        });

      case 'recent':
        const recentItems = await db
          .select({
            id: knowledgeItems.id,
            title: knowledgeItems.title,
            summary: knowledgeItems.summary,
            viewCount: knowledgeItems.viewCount,
            useCount: knowledgeItems.useCount,
            createdAt: knowledgeItems.createdAt,
          })
          .from(knowledgeItems)
          .where(eq(knowledgeItems.status, 'approved'))
          .orderBy(desc(knowledgeItems.createdAt))
          .limit(topK);

        return NextResponse.json({
          success: true,
          recent: recentItems,
        });

      case 'category':
        const categoryIdNum = categoryId ? parseInt(categoryId) : null;
        const categoryItems = await db
          .select({
            id: knowledgeItems.id,
            title: knowledgeItems.title,
            summary: knowledgeItems.summary,
            viewCount: knowledgeItems.viewCount,
            useCount: knowledgeItems.useCount,
          })
          .from(knowledgeItems)
          .where(
            categoryIdNum
              ? and(
                  eq(knowledgeItems.status, 'approved'),
                  eq(knowledgeItems.categoryId, categoryIdNum)
                )
              : eq(knowledgeItems.status, 'approved')
          )
          .orderBy(desc(knowledgeItems.useCount), desc(knowledgeItems.viewCount))
          .limit(topK);

        return NextResponse.json({
          success: true,
          items: categoryItems,
        });

      default:
        return NextResponse.json({ error: 'Invalid stats type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Knowledge stats error:', error);
    return NextResponse.json({ error: '获取知识统计失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getKnowledgeStats(req, userId));
}
/**
 * 知识条目API
 * GET: 获取知识条目列表
 * POST: 创建知识条目
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { knowledgeItems, knowledgeCategories } from '@/db/schema';
import { eq, and, or, ilike, desc } from 'drizzle-orm';

// 获取知识条目列表
async function getEntries(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const keyword = searchParams.get('keyword');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 构建查询条件
    const conditions = [eq(knowledgeItems.status, 'approved')];

    if (categoryId) {
      conditions.push(eq(knowledgeItems.categoryId, parseInt(categoryId)));
    }

    if (keyword) {
      // 关键词搜索（标题或内容）
      const entries = await db
        .select({
          id: knowledgeItems.id,
          categoryId: knowledgeItems.categoryId,
          title: knowledgeItems.title,
          content: knowledgeItems.content,
          keywords: knowledgeItems.keywords,
          source: knowledgeItems.source,
          sourceUrl: knowledgeItems.sourceUrl,
          viewCount: knowledgeItems.viewCount,
          useCount: knowledgeItems.useCount,
          createdAt: knowledgeItems.createdAt,
          category: knowledgeCategories,
        })
        .from(knowledgeItems)
        .leftJoin(
          knowledgeCategories,
          eq(knowledgeItems.categoryId, knowledgeCategories.id)
        )
        .where(
          and(
            ...conditions,
            or(
              ilike(knowledgeItems.title, `%${keyword}%`),
              ilike(knowledgeItems.content, `%${keyword}%`)
            )
          )
        )
        .orderBy(desc(knowledgeItems.useCount), desc(knowledgeItems.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ entries });
    }

    // 无关键词搜索
    const entries = await db
      .select({
        id: knowledgeItems.id,
        categoryId: knowledgeItems.categoryId,
        title: knowledgeItems.title,
        content: knowledgeItems.content,
        keywords: knowledgeItems.keywords,
        source: knowledgeItems.source,
        sourceUrl: knowledgeItems.sourceUrl,
        viewCount: knowledgeItems.viewCount,
        useCount: knowledgeItems.useCount,
        createdAt: knowledgeItems.createdAt,
        category: knowledgeCategories,
      })
      .from(knowledgeItems)
      .leftJoin(
        knowledgeCategories,
        eq(knowledgeItems.categoryId, knowledgeCategories.id)
      )
      .where(and(...conditions))
      .orderBy(desc(knowledgeItems.useCount), desc(knowledgeItems.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Get knowledge entries error:', error);
    return NextResponse.json({ error: '获取知识条目失败' }, { status: 500 });
  }
}

// 创建知识条目
async function createEntry(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      categoryId,
      title,
      content,
      keywords,
      source,
      sourceUrl,
      effectiveFrom,
      effectiveTo,
    } = body;

    if (!title || !content) {
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 });
    }

    // 检查分类是否存在
    if (categoryId) {
      const category = await db
        .select()
        .from(knowledgeCategories)
        .where(eq(knowledgeCategories.id, categoryId))
        .limit(1);

      if (category.length === 0) {
        return NextResponse.json({ error: '分类不存在' }, { status: 404 });
      }
    }

    const [entry] = await db
      .insert(knowledgeItems)
      .values({
        categoryId: categoryId || null,
        title,
        content,
        keywords: keywords || null,
        source: source || null,
        sourceUrl: sourceUrl || null,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        status: 'draft',
        authorId: userId,
      })
      .returning();

    // TODO: 生成向量嵌入（KB-003实现）

    return NextResponse.json({
      success: true,
      entry,
      message: '知识条目创建成功',
    });
  } catch (error) {
    console.error('Create knowledge entry error:', error);
    return NextResponse.json({ error: '创建知识条目失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getEntries(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createEntry(req, userId));
}

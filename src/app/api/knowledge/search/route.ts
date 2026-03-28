/**
 * 知识检索API
 * POST: 语义搜索知识条目
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { db } from '@/db';
import { knowledgeItems, knowledgeCategories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { KnowledgeEmbeddingService } from '@/lib/embedding/service';

// 语义搜索知识条目
async function searchKnowledge(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { query, categoryId, topK = 10 } = body;

    if (!query) {
      return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 });
    }

    // 构建查询条件
    const conditions = [eq(knowledgeItems.status, 'approved')];

    if (categoryId) {
      conditions.push(eq(knowledgeItems.categoryId, categoryId));
    }

    // 获取知识条目
    const items = await db
      .select({
        id: knowledgeItems.id,
        title: knowledgeItems.title,
        content: knowledgeItems.content,
        summary: knowledgeItems.summary,
        keywords: knowledgeItems.keywords,
        embeddingVector: knowledgeItems.embeddingVector,
        viewCount: knowledgeItems.viewCount,
        useCount: knowledgeItems.useCount,
        createdAt: knowledgeItems.createdAt,
        category: {
          id: knowledgeCategories.id,
          name: knowledgeCategories.name,
        },
      })
      .from(knowledgeItems)
      .leftJoin(
        knowledgeCategories,
        eq(knowledgeItems.categoryId, knowledgeCategories.id)
      )
      .where(eq(knowledgeItems.status, 'approved'));

    if (items.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 提取请求头用于向量嵌入服务
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 执行语义搜索
    const embeddingService = new KnowledgeEmbeddingService({ customHeaders });
    const results = await embeddingService.searchSimilarKnowledge(
      query,
      items.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        embeddingVector: item.embeddingVector,
      })),
      topK
    );

    // 合并搜索结果和详细信息
    const enrichedResults = results.map((result) => {
      const item = items.find((i) => i.id === result.id);
      return {
        ...result,
        summary: item?.summary,
        keywords: item?.keywords,
        category: item?.category,
        viewCount: item?.viewCount,
        useCount: item?.useCount,
        createdAt: item?.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      query,
      results: enrichedResults,
      total: results.length,
    });
  } catch (error) {
    console.error('Search knowledge error:', error);
    return NextResponse.json({ error: '知识检索失败' }, { status: 500 });
  }
}

// 为知识条目生成向量嵌入
async function generateEmbedding(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: '缺少知识条目ID' }, { status: 400 });
    }

    // 获取知识条目
    const item = await db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.id, itemId))
      .limit(1);

    if (item.length === 0) {
      return NextResponse.json({ error: '知识条目不存在' }, { status: 404 });
    }

    // 提取请求头用于向量嵌入服务
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 生成向量嵌入
    const embeddingService = new KnowledgeEmbeddingService({ customHeaders });
    const embeddingVector = await embeddingService.generateKnowledgeEmbedding(
      item[0].title,
      item[0].content
    );

    // 更新知识条目
    await db
      .update(knowledgeItems)
      .set({ embeddingVector })
      .where(eq(knowledgeItems.id, itemId));

    return NextResponse.json({
      success: true,
      message: '向量嵌入生成成功',
      itemId,
    });
  } catch (error) {
    console.error('Generate embedding error:', error);
    return NextResponse.json({ error: '生成向量嵌入失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'embed') {
    return withAuth(request, (req, userId) => generateEmbedding(req, userId));
  }

  return withAuth(request, (req, userId) => searchKnowledge(req, userId));
}

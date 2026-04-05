/**
 * 知识推荐API
 * GET/POST: 根据文档上下文推荐相关知识条目
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { db } from '@/db';
import { knowledgeItems, knowledgeCategories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { KnowledgeEmbeddingService } from '@/lib/embedding/service';
import { bidDocuments, bidDocumentInterpretations } from '@/db/schema';

interface RecommendParams {
  documentId?: number;
  chapterTitle?: string;
  topK?: number;
}

async function recommendKnowledge(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { documentId, chapterTitle, topK = 5 } = body as RecommendParams;

    if (!documentId && !chapterTitle) {
      return NextResponse.json({ error: '缺少文档ID或章节标题' }, { status: 400 });
    }

    // 构建查询条件
    const conditions = [eq(knowledgeItems.status, 'approved')];

    // 获取知识条目
    const items = await db
      .select({
        id: knowledgeItems.id,
        title: knowledgeItems.title,
        content: knowledgeItems.content,
        summary: knowledgeItems.summary,
        keywords: knowledgeItems.keywords,
        embeddingVector: knowledgeItems.embeddingVector,
        useCount: knowledgeItems.useCount,
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
      return NextResponse.json({ recommendations: [] });
    }

    // 构建搜索查询
    let searchQuery = chapterTitle || '';
    
    // 如果有文档ID，尝试获取招标文件信息来增强查询
    if (documentId) {
      const doc = await db
        .select({
          interpretationId: bidDocuments.interpretationId,
          name: bidDocuments.name,
        })
        .from(bidDocuments)
        .where(eq(bidDocuments.id, documentId))
        .limit(1);

      if (doc.length > 0 && doc[0].interpretationId) {
        const interpretation = await db
          .select({
            projectName: bidDocumentInterpretations.projectName,
            tenderScope: bidDocumentInterpretations.tenderScope,
            qualificationRequirements: bidDocumentInterpretations.qualificationRequirements,
          })
          .from(bidDocumentInterpretations)
          .where(eq(bidDocumentInterpretations.id, doc[0].interpretationId))
          .limit(1);

        if (interpretation.length > 0) {
          const interp = interpretation[0];
          searchQuery = `${chapterTitle || ''} ${interp.projectName || ''} ${interp.tenderScope || ''}`.trim();
        }
      }
    }

    // 提取请求头用于向量嵌入服务
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    
    // 执行语义搜索
    const embeddingService = new KnowledgeEmbeddingService({ customHeaders });
    const results = await embeddingService.searchSimilarKnowledge(
      searchQuery,
      items.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        embeddingVector: item.embeddingVector,
      })),
      topK
    );

    // 合并搜索结果和详细信息
    const recommendations = results.map((result) => {
      const item = items.find((i) => i.id === result.id);
      return {
        id: result.id,
        title: item?.title || '',
        summary: item?.summary || item?.content?.slice(0, 200) || '',
        content: item?.content,
        score: result.score,
        category: item?.category,
        useCount: item?.useCount,
      };
    });

    return NextResponse.json({
      success: true,
      recommendations,
      total: recommendations.length,
    });
  } catch (error) {
    console.error('Recommend knowledge error:', error);
    return NextResponse.json({ error: '知识推荐失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => recommendKnowledge(req, userId));
}
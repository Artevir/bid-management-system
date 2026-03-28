/**
 * 知识库导入API
 * POST: 导入知识条目
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import {
  importKnowledgeItem,
  importFromDocument,
  batchImportKnowledge,
  reviewKnowledgeItem,
  updateKnowledgeItem,
} from '@/lib/knowledge/import';

// 导入单个知识条目
async function importSingle(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { categoryId, title, content, source, sourceUrl, keywords } = body;

    if (!categoryId || !title || !content) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const itemId = await importKnowledgeItem({
      categoryId,
      title,
      content,
      source,
      sourceUrl,
      keywords,
      userId,
      customHeaders,
    });

    return NextResponse.json({
      success: true,
      itemId,
      message: '知识条目导入成功',
    });
  } catch (error) {
    console.error('Import knowledge error:', error);
    return NextResponse.json({ error: '导入知识条目失败' }, { status: 500 });
  }
}

// 从文档导入
async function importFromDoc(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { documentContent, categoryId } = body;

    if (!documentContent || !categoryId) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const result = await importFromDocument(
      documentContent,
      categoryId,
      userId,
      customHeaders
    );

    return NextResponse.json({
      success: true,
      result,
      message: `成功导入 ${result.success} 条，失败 ${result.failed} 条`,
    });
  } catch (error) {
    console.error('Import from document error:', error);
    return NextResponse.json({ error: '从文档导入失败' }, { status: 500 });
  }
}

// 批量导入
async function importBatch(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '无效的导入数据' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const result = await batchImportKnowledge(items, userId, customHeaders);

    return NextResponse.json({
      success: true,
      result,
      message: `成功导入 ${result.success} 条，失败 ${result.failed} 条`,
    });
  } catch (error) {
    console.error('Batch import error:', error);
    return NextResponse.json({ error: '批量导入失败' }, { status: 500 });
  }
}

// 审核知识条目
async function reviewItem(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { itemId, status, reviewNotes } = body;

    if (!itemId || !status) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    await reviewKnowledgeItem(itemId, status, userId, reviewNotes);

    return NextResponse.json({
      success: true,
      message: '审核完成',
    });
  } catch (error) {
    console.error('Review knowledge error:', error);
    return NextResponse.json({ error: '审核失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'document':
      return withAuth(request, (req, userId) => importFromDoc(req, userId));
    case 'batch':
      return withAuth(request, (req, userId) => importBatch(req, userId));
    case 'review':
      return withAuth(request, (req, userId) => reviewItem(req, userId));
    default:
      return withAuth(request, (req, userId) => importSingle(req, userId));
  }
}

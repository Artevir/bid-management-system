/**
 * AI生成文档审核API
 * GET: 获取待审核列表
 * POST: 提交审核结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const { oneClickGenerateService } = await import('@/lib/services/one-click-generate-service');
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const reviews = await oneClickGenerateService.getPendingReviews(
      projectId ? parseInt(projectId) : undefined
    );

    return NextResponse.json({
      success: true,
      data: reviews,
    });
  } catch (error: any) {
    console.error('Get pending reviews error:', error);
    return NextResponse.json({ error: error.message || '获取失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { oneClickGenerateService } = await import('@/lib/services/one-click-generate-service');
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, reviewId, result, comments, chapterModifications } = body;

    if (!documentId || !reviewId || !result) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(result)) {
      return NextResponse.json({ error: '审核结果无效' }, { status: 400 });
    }

    await oneClickGenerateService.reviewDocument(
      documentId,
      reviewId,
      {
        result,
        comments,
        chapterModifications,
      },
      session.user.id
    );

    return NextResponse.json({
      success: true,
      message: result === 'approved' ? '审核通过' : '审核拒绝',
    });
  } catch (error: any) {
    console.error('Review document error:', error);
    return NextResponse.json({ error: error.message || '审核失败' }, { status: 500 });
  }
}

/**
 * 审核记录API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getReviews,
  createReview,
  submitReview,
} from '@/lib/authorization/service';

// GET - 获取审核记录列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);
    const reviews = await getReviews(applicationId);

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('获取审核记录列表失败:', error);
    return NextResponse.json({ error: '获取审核记录列表失败' }, { status: 500 });
  }
}

// POST - 创建审核记录或提交审核
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);
    const body = await req.json();

    // 提交审核结果
    if (body.action === 'submit_review' && body.reviewId) {
      const review = await submitReview(
        body.reviewId,
        body.result,
        body.comment,
        body.exceptionHandling
      );
      return NextResponse.json(review);
    }

    // 创建审核记录
    const review = await createReview({
      applicationId,
      stage: body.stage,
      reviewerId: body.reviewerId || session.user.id,
      reviewerName: body.reviewerName || session.user.username,
      result: body.result,
      comment: body.comment,
      exceptionHandling: body.exceptionHandling,
    });

    return NextResponse.json(review);
  } catch (error) {
    console.error('创建审核记录失败:', error);
    return NextResponse.json({ error: '创建审核记录失败' }, { status: 500 });
  }
}

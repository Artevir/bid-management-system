/**
 * 审核记录API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getReviews, createReview, submitReview } from '@/lib/authorization/service';
import { parseIdFromParams, parseResourceId } from '@/lib/api/validators';
import { canAccessAuthorizationApplication } from '@/lib/support/application-access';
import { db } from '@/db';
import { authorizationReviews, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - 获取审核记录列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const reviews = await getReviews(applicationId);
      return NextResponse.json(reviews);
    } catch (error) {
      console.error('获取审核记录列表失败:', error);
      return NextResponse.json({ error: '获取审核记录列表失败' }, { status: 500 });
    }
  });
}

// POST - 创建审核记录或提交审核
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const body = await request.json();

      // 提交审核结果
      if (body.action === 'submit_review' && body.reviewId) {
        const reviewId = parseResourceId(String(body.reviewId), '审核');
        const existing = await db.query.authorizationReviews.findFirst({
          where: and(
            eq(authorizationReviews.id, reviewId),
            eq(authorizationReviews.applicationId, applicationId)
          ),
          columns: { id: true },
        });
        if (!existing) {
          return NextResponse.json({ error: '审核记录不存在' }, { status: 404 });
        }

        const review = await submitReview(
          reviewId,
          body.result,
          body.comment,
          body.exceptionHandling
        );
        return NextResponse.json(review);
      }

      const reviewer = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { username: true, realName: true },
      });
      const reviewerName = reviewer?.username || reviewer?.realName || `用户${userId}`;

      // 创建审核记录
      const review = await createReview({
        applicationId,
        stage: body.stage,
        reviewerId: userId,
        reviewerName,
        result: body.result,
        comment: body.comment,
        exceptionHandling: body.exceptionHandling,
      });

      return NextResponse.json(review);
    } catch (error) {
      console.error('创建审核记录失败:', error);
      return NextResponse.json({ error: '创建审核记录失败' }, { status: 500 });
    }
  });
}

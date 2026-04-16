/**
 * 授权申请审核API路由
 * 用于审核中心进行审核操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { authorizationApplications, authorizationReviews, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseIdFromParams } from '@/lib/api/validators';
import { canAccessAuthorizationApplication } from '@/lib/support/application-access';

// POST - 审核操作
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权审核该申请' }, { status: 403 });
      }

      const body = await request.json();
      const { result, comment } = body;

      if (!result || !['approved', 'rejected'].includes(result)) {
        return NextResponse.json({ error: '无效的审核结果' }, { status: 400 });
      }

      if (!comment || !comment.trim()) {
        return NextResponse.json({ error: '请填写审核意见' }, { status: 400 });
      }

      // 获取申请信息
      const application = await db.query.authorizationApplications.findFirst({
        where: eq(authorizationApplications.id, applicationId),
      });

      if (!application) {
        return NextResponse.json({ error: '申请不存在' }, { status: 404 });
      }

      if (application.status !== 'pending_review') {
        return NextResponse.json({ error: '该申请不在待审核状态' }, { status: 400 });
      }

      const reviewer = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { username: true, realName: true },
      });
      const reviewerName = reviewer?.username || reviewer?.realName || `用户${userId}`;

      // 创建审核记录
      const [review] = await db
        .insert(authorizationReviews)
        .values({
          applicationId,
          stage: 'final',
          reviewerId: userId,
          reviewerName,
          result,
          comment,
          reviewedAt: new Date(),
        })
        .returning();

      // 更新申请状态
      await db
        .update(authorizationApplications)
        .set({
          status: result === 'approved' ? 'approved' : 'rejected',
          updatedAt: new Date(),
        })
        .where(eq(authorizationApplications.id, applicationId));

      return NextResponse.json({ success: true, review });
    } catch (error) {
      console.error('审核失败:', error);
      return NextResponse.json({ error: '审核失败' }, { status: 500 });
    }
  });
}

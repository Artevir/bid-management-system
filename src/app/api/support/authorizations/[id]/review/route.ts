/**
 * 授权申请审核API路由
 * 用于审核中心进行审核操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/db';
import { authorizationApplications, authorizationReviews } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST - 审核操作
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

    // 创建审核记录
    const [review] = await db.insert(authorizationReviews).values({
      applicationId,
      stage: 'final',
      reviewerId: session.user.id,
      reviewerName: session.user.username || '审核人',
      result,
      comment,
      reviewedAt: new Date(),
    }).returning();

    // 更新申请状态
    await db.update(authorizationApplications)
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
}

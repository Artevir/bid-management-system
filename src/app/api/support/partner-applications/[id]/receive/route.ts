/**
 * 友司支持材料接收API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/db';
import { partnerApplications, partnerReviews } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST - 材料接收确认
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
    const { comment } = body;

    // 获取申请信息
    const application = await db.query.partnerApplications.findFirst({
      where: eq(partnerApplications.id, applicationId),
    });

    if (!application) {
      return NextResponse.json({ error: '申请不存在' }, { status: 404 });
    }

    if (application.status !== 'material_pending') {
      return NextResponse.json({ error: '该申请不在材料待接收状态' }, { status: 400 });
    }

    // 创建审核记录
    await db.insert(partnerReviews).values({
      applicationId,
      stage: 'material_completeness',
      reviewerId: session.user.id,
      reviewerName: session.user.username || '接收人',
      result: 'approved',
      comment: comment || '已接收材料',
      reviewedAt: new Date(),
    });

    // 更新申请状态
    await db.update(partnerApplications)
      .set({
        status: 'material_received',
        updatedAt: new Date(),
      })
      .where(eq(partnerApplications.id, applicationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('接收确认失败:', error);
    return NextResponse.json({ error: '接收确认失败' }, { status: 500 });
  }
}

/**
 * 友司支持材料接收API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { partnerApplications, partnerReviews } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseIdFromParams } from '@/lib/api/validators';
import { hasProjectPermission } from '@/lib/project/member';

// POST - 材料接收确认
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const body = await request.json();
      const { comment } = body;

      const application = await db.query.partnerApplications.findFirst({
        where: eq(partnerApplications.id, applicationId),
      });
      if (!application) {
        return NextResponse.json({ error: '申请不存在' }, { status: 404 });
      }

      const isOwner = application.createdBy === userId || application.handlerId === userId;
      const hasProjectAccess = application.projectId
        ? await hasProjectPermission(application.projectId, userId, 'edit')
        : false;
      if (!isOwner && !hasProjectAccess) {
        return NextResponse.json({ error: '无权接收该申请材料' }, { status: 403 });
      }

      if (application.status !== 'material_pending') {
        return NextResponse.json({ error: '该申请不在材料待接收状态' }, { status: 400 });
      }

      await db.insert(partnerReviews).values({
        applicationId,
        stage: 'material_completeness',
        reviewerId: userId,
        reviewerName: `用户${userId}`,
        result: 'approved',
        comment: comment || '已接收材料',
        reviewedAt: new Date(),
      });

      await db
        .update(partnerApplications)
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
  });
}

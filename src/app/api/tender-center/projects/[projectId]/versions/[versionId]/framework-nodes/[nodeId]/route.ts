import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { tenderCenterError } from '@/app/api/tender-center/_response';
import { db } from '@/db';
import { bidFrameworkNodes } from '@/db/schema';

// 060: PATCH /api/tender-center/projects/{projectId}/versions/{versionId}/framework-nodes/{nodeId}
// confirm_object 确认框架节点
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string; nodeId: string }> }
) {
  const { projectId, versionId, nodeId } = await params;
  const id = Number(nodeId);
  if (!Number.isFinite(id) || id <= 0) {
    return tenderCenterError('无效的 nodeId', 400);
  }

  return withAuth(request, async (req, userId) => {
    const { version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return tenderCenterError('未找到对应版本', 404);
    }

    const body = await req.json().catch(() => ({}));
    const reviewStatusRaw = String(body.reviewStatus || 'confirmed');

    const validStatuses = ['draft', 'pending_review', 'confirmed', 'modified', 'rejected'] as const;
    const reviewStatus = validStatuses.includes(reviewStatusRaw as (typeof validStatuses)[number])
      ? (reviewStatusRaw as (typeof validStatuses)[number])
      : 'confirmed';

    const [existing] = await db
      .select()
      .from(bidFrameworkNodes)
      .where(and(eq(bidFrameworkNodes.id, id), eq(bidFrameworkNodes.isDeleted, false)))
      .limit(1);

    if (!existing) {
      return tenderCenterError('框架节点不存在', 404);
    }

    await db
      .update(bidFrameworkNodes)
      .set({
        reviewStatus: sql`${reviewStatus}`,
        updatedAt: new Date(),
      })
      .where(eq(bidFrameworkNodes.id, id));

    return NextResponse.json({
      success: true,
      data: {
        nodeId: id,
        reviewStatus,
        action: 'confirm_object',
      },
      message: '框架节点确认成功',
    });
  });
}

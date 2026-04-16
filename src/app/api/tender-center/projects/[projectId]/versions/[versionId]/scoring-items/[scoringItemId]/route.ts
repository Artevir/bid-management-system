import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { tenderCenterError } from '@/app/api/tender-center/_response';
import { db } from '@/db';
import { scoringItems, scoringSchemes } from '@/db/schema';

// 060: PATCH /api/tender-center/projects/{projectId}/versions/{versionId}/scoring-items/{scoringItemId}
// confirm_object 确认评分项
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string; scoringItemId: string }> }
) {
  const { projectId, versionId, scoringItemId } = await params;
  const itemId = Number(scoringItemId);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return tenderCenterError('无效的 scoringItemId', 400);
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
      .from(scoringItems)
      .where(and(eq(scoringItems.id, itemId), eq(scoringItems.isDeleted, false)))
      .limit(1);

    if (!existing) {
      return tenderCenterError('评分项不存在', 404);
    }

    await db
      .update(scoringItems)
      .set({
        reviewStatus: sql`${reviewStatus}`,
        updatedAt: new Date(),
      })
      .where(eq(scoringItems.id, itemId));

    return NextResponse.json({
      success: true,
      data: {
        scoringItemId: itemId,
        reviewStatus,
        action: 'confirm_object',
      },
      message: '评分项确认成功',
    });
  });
}

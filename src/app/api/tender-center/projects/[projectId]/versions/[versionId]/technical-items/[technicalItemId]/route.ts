import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { tenderCenterError } from '@/app/api/tender-center/_response';
import { db } from '@/db';
import { technicalSpecItems, technicalSpecGroups } from '@/db/schema';

// 060: PATCH /api/tender-center/projects/{projectId}/versions/{versionId}/technical-items/{technicalItemId}
// confirm_object / modify_and_confirm
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string; technicalItemId: string }> }
) {
  const { projectId, versionId, technicalItemId } = await params;
  const itemId = Number(technicalItemId);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return tenderCenterError('无效的 technicalItemId', 400);
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
      .from(technicalSpecItems)
      .where(and(eq(technicalSpecItems.id, itemId), eq(technicalSpecItems.isDeleted, false)))
      .limit(1);

    if (!existing) {
      return tenderCenterError('技术参数项不存在', 404);
    }

    await db
      .update(technicalSpecItems)
      .set({
        reviewStatus: sql`${reviewStatus}`,
        updatedAt: new Date(),
      })
      .where(eq(technicalSpecItems.id, itemId));

    const action = reviewStatus === 'modified' ? 'modify_and_confirm' : 'confirm_object';

    return NextResponse.json({
      success: true,
      data: {
        technicalItemId: itemId,
        reviewStatus,
        action,
      },
      message: action === 'modify_and_confirm' ? '修改后确认成功' : '确认对象成功',
    });
  });
}

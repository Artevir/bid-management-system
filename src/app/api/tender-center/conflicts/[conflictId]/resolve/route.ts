import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { conflictItems, tenderProjects, tenderProjectVersions } from '@/db/schema';
import { tenderCenterError } from '@/app/api/tender-center/_response';

function parseConflictId(conflictId: string): number | null {
  const raw = String(conflictId || '');
  const m = raw.match(/^conflict-(\d+)$/);
  const numeric = m ? Number(m[1]) : Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

// 040: POST /api/tender-center/conflicts/{conflictId}/resolve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conflictId: string }> }
) {
  const { conflictId } = await params;
  const requirementId = parseConflictId(conflictId);
  if (!requirementId) {
    return tenderCenterError('无效的 conflictId', 400);
  }

  return withAuth(request, async (req, userId) => {
    const body = await req.json().catch(() => ({}));
    const resolutionType = String(body.resolutionType || 'manual_override');
    const allowedResolutionTypes = [
      'accept_requirement',
      'accept_actual',
      'manual_override',
    ] as const;
    if (
      !allowedResolutionTypes.includes(resolutionType as (typeof allowedResolutionTypes)[number])
    ) {
      return tenderCenterError('无效的 resolutionType', 400);
    }

    const rows = await db
      .select({
        id: conflictItems.id,
        reviewStatus: conflictItems.reviewStatus,
        candidateA: conflictItems.candidateA,
        candidateB: conflictItems.candidateB,
        projectCreatedBy: tenderProjects.createdBy,
      })
      .from(conflictItems)
      .innerJoin(
        tenderProjectVersions,
        eq(tenderProjectVersions.id, conflictItems.tenderProjectVersionId)
      )
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .where(and(eq(conflictItems.id, requirementId), eq(conflictItems.isDeleted, false)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return tenderCenterError('冲突不存在', 404);
    }
    if (row.projectCreatedBy && row.projectCreatedBy !== userId) {
      return tenderCenterError('无权处理该冲突', 403);
    }
    if (row.reviewStatus === 'resolved') {
      return tenderCenterError('该冲突已处理完成', 409);
    }

    const note = String(body.note || body.resolution || '').trim();
    const resolvedValueRaw = String(body.resolvedValue || '').trim();
    const resolvedValue =
      resolvedValueRaw ||
      (resolutionType === 'accept_requirement'
        ? String(row.candidateA || '')
        : resolutionType === 'accept_actual'
          ? String(row.candidateB || '')
          : String(row.candidateB || row.candidateA || ''));
    const resolutionSummary = note || '已人工确认处理';

    await db
      .update(conflictItems)
      .set({
        reviewStatus: 'resolved',
        finalResolution: JSON.stringify({
          resolutionType,
          resolvedValue,
          note: resolutionSummary,
          resolvedBy: userId,
          resolvedAt: new Date().toISOString(),
        }),
        updatedAt: new Date(),
      })
      .where(eq(conflictItems.id, requirementId));

    return NextResponse.json({
      success: true,
      data: {
        conflictId: `conflict-${row.id}`,
        previousStatus: row.reviewStatus,
        status: 'resolved',
        resolutionType,
        resolvedValue,
      },
      message: '冲突已处理',
    });
  });
}

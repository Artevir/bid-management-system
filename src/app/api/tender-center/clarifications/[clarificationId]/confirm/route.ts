import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { clarificationCandidates, tenderProjects, tenderProjectVersions } from '@/db/schema';
import { tenderCenterError } from '@/app/api/tender-center/_response';

function parseClarificationId(clarificationId: string): number | null {
  const raw = String(clarificationId || '');
  const m = raw.match(/^clar(?:ification)?-(\d+)$/);
  const numeric = m ? Number(m[1]) : Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

// 040: POST /api/tender-center/clarifications/{clarificationId}/confirm
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clarificationId: string }> }
) {
  const { clarificationId } = await params;
  const clarificationRowId = parseClarificationId(clarificationId);
  const normalizedId = clarificationRowId ? `clar-${clarificationRowId}` : clarificationId;
  if (!clarificationRowId) {
    return tenderCenterError('无效的 clarificationId', 400);
  }

  return withAuth(request, async (req, userId) => {
    const hitRows = await db
      .select({
        id: clarificationCandidates.id,
        reviewStatus: clarificationCandidates.reviewStatus,
        projectCreatedBy: tenderProjects.createdBy,
      })
      .from(clarificationCandidates)
      .innerJoin(
        tenderProjectVersions,
        eq(tenderProjectVersions.id, clarificationCandidates.tenderProjectVersionId)
      )
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .where(
        and(
          eq(clarificationCandidates.id, clarificationRowId),
          eq(clarificationCandidates.isDeleted, false)
        )
      )
      .limit(1);
    const current = hitRows[0];
    if (!current) {
      return tenderCenterError('澄清项不存在', 404);
    }
    if (current.projectCreatedBy && current.projectCreatedBy !== userId) {
      return tenderCenterError('无权确认该澄清项', 403);
    }
    if (current.reviewStatus === 'confirmed') {
      return NextResponse.json({
        success: true,
        data: { clarificationId: normalizedId, clarificationRowId, status: 'confirmed' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const comment = String(body.comment || body.note || '已澄清确认').trim();

    await db
      .update(clarificationCandidates)
      .set({
        reviewStatus: 'confirmed',
        questionReason: comment,
        updatedAt: new Date(),
      })
      .where(eq(clarificationCandidates.id, clarificationRowId));

    return NextResponse.json({
      success: true,
      data: { clarificationId: normalizedId, clarificationRowId, status: 'confirmed' },
    });
  });
}

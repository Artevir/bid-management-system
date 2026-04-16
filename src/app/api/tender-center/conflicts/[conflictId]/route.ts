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

// 040: GET /api/tender-center/conflicts/{conflictId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conflictId: string }> }
) {
  const { conflictId } = await params;
  const requirementId = parseConflictId(conflictId);
  if (!requirementId) {
    return tenderCenterError('无效的 conflictId', 400);
  }

  return withAuth(request, async (_req, userId) => {
    const rows = await db
      .select({
        id: conflictItems.id,
        conflictType: conflictItems.conflictType,
        fieldName: conflictItems.fieldName,
        candidateA: conflictItems.candidateA,
        candidateB: conflictItems.candidateB,
        reviewStatus: conflictItems.reviewStatus,
        finalResolution: conflictItems.finalResolution,
        conflictLevel: conflictItems.conflictLevel,
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
      return tenderCenterError('无权访问该冲突', 403);
    }

    return NextResponse.json({
      success: true,
      data: {
        conflictId: `conflict-${row.id}`,
        title: row.fieldName || `冲突 #${row.id}`,
        category: row.conflictType,
        status: row.reviewStatus,
        detail: [row.candidateA, row.candidateB].filter(Boolean).join(' / ') || '',
        level: row.conflictLevel,
        finalResolution: row.finalResolution,
      },
    });
  });
}

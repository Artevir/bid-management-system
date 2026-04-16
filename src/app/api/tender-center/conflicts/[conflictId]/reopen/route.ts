import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { conflictItems, tenderProjects, tenderProjectVersions } from '@/db/schema';
import { tenderCenterError } from '@/app/api/tender-center/_response';

function parseConflictId(value: string): number | null {
  const m = value.match(/^conflict-(\d+)$/);
  const numeric = m ? Number(m[1]) : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

// 060: POST /api/tender-center/conflicts/{conflictId}/reopen
// rollback_resolution 回退定案（重新打开）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conflictId: string }> }
) {
  const { conflictId } = await params;
  const id = parseConflictId(conflictId);
  if (!id) {
    return tenderCenterError('无效的 conflictId', 400);
  }

  return withAuth(request, async (_req, userId) => {
    const [conflict] = await db
      .select()
      .from(conflictItems)
      .where(and(eq(conflictItems.id, id), eq(conflictItems.isDeleted, false)))
      .limit(1);

    if (!conflict) {
      return tenderCenterError('冲突不存在', 404);
    }

    const versionRows = await db
      .select({ projectCreatedBy: tenderProjects.createdBy })
      .from(tenderProjectVersions)
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .where(eq(tenderProjectVersions.id, conflict.tenderProjectVersionId))
      .limit(1);

    if (versionRows[0]?.projectCreatedBy && versionRows[0].projectCreatedBy !== userId) {
      return tenderCenterError('无权操作该冲突', 403);
    }

    await db
      .update(conflictItems)
      .set({
        reviewStatus: 'reviewing',
        finalResolution: null,
        updatedAt: new Date(),
      })
      .where(eq(conflictItems.id, id));

    return NextResponse.json({
      success: true,
      data: {
        conflictId: `conflict-${id}`,
        previousStatus: conflict.reviewStatus,
        newStatus: 'reviewing',
        action: 'rollback_resolution',
      },
      message: '冲突定案已回退',
    });
  });
}

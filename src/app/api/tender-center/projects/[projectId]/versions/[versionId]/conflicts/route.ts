import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { conflictItems } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/conflicts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;

  return withAuth(request, async (_req, userId) => {
    const { project, version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }

    const rows = await db.query.conflictItems.findMany({
      where: and(
        eq(conflictItems.tenderProjectVersionId, version.id),
        eq(conflictItems.isDeleted, false)
      ),
    });

    const conflicts = rows.map((row) => ({
      conflictId: row.id,
      requirementId: null as number | null,
      title: row.fieldName || `冲突 #${row.id}`,
      category: row.conflictType,
      status: row.reviewStatus,
      detail: [row.candidateA, row.candidateB].filter(Boolean).join(' / ') || '',
    }));

    return NextResponse.json({
      success: true,
      data: conflicts,
      meta: {
        projectId: project.id,
        versionId: version.id,
        interpretationId: null,
        total: conflicts.length,
      },
    });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { clarificationCandidates } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/clarifications
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  return withAuth(request, async (_req, userId) => {
    const { version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }

    const rows = await db.query.clarificationCandidates.findMany({
      where: and(
        eq(clarificationCandidates.tenderProjectVersionId, version.id),
        eq(clarificationCandidates.isDeleted, false)
      ),
    });

    const data = rows.map((row) => ({
      clarificationId: row.id,
      requirementId: row.relatedRequirementId,
      title: row.questionTitle,
      detail: row.questionContent,
      status: row.reviewStatus,
    }));

    return NextResponse.json({ success: true, data });
  });
}

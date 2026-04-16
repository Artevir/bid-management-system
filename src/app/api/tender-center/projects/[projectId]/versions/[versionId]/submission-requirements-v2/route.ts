import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { submissionRequirements } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/submission-requirements
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
    const rows = await db
      .select({
        id: submissionRequirements.id,
        submissionType: submissionRequirements.submissionType,
        requirementText: submissionRequirements.requirementText,
        copiesText: submissionRequirements.copiesText,
        submissionLocation: submissionRequirements.submissionLocation,
        signatureRequiredFlag: submissionRequirements.signatureRequiredFlag,
        sealRequiredFlag: submissionRequirements.sealRequiredFlag,
      })
      .from(submissionRequirements)
      .where(
        and(
          eq(submissionRequirements.tenderProjectVersionId, version.id),
          eq(submissionRequirements.isDeleted, false)
        )
      );
    return NextResponse.json({ success: true, data: rows });
  });
}

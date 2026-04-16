import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { submissionRequirements } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

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

    const rows = await db.query.submissionRequirements.findMany({
      where: and(
        eq(submissionRequirements.tenderProjectVersionId, version.id),
        eq(submissionRequirements.isDeleted, false)
      ),
    });

    const data = rows.map((row) => ({
      requirementId: row.id,
      title: row.requirementText,
      detail: row.copiesText,
      status: row.submissionType,
      requiredDocuments: null as string | null,
      signatureRequired: row.signatureRequiredFlag,
      sealRequired: row.sealRequiredFlag,
    }));

    return NextResponse.json({ success: true, data });
  });
}

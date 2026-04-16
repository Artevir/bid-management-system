import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { hubBidTemplates } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/templates
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
    const rows = await db.query.hubBidTemplates.findMany({
      where: and(
        eq(hubBidTemplates.tenderProjectVersionId, version.id),
        eq(hubBidTemplates.isDeleted, false)
      ),
    });
    const data = rows.map((row) => ({
      templateId: row.id,
      name: row.templateName,
      category: row.templateType,
      sourceTitle: row.sourceTitle,
      templateText: row.templateText,
      sourceNodeId: row.sourceSegmentId,
      pageNumber: row.sourcePageNo,
      fixedFormat: row.fixedFormatFlag,
      originalFormatRequired: row.originalFormatRequiredFlag,
      signatureRequired: row.signatureRequiredFlag,
      sealRequired: row.sealRequiredFlag,
      dateRequired: row.dateRequiredFlag,
      reviewStatus: row.reviewStatus,
    }));
    return NextResponse.json({ success: true, data });
  });
}

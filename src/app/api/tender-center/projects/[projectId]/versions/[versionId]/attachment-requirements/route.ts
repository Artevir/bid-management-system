import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { attachmentRequirementNodes } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET .../attachment-requirements — 010 §6.2.4 附件要求节点
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

    const rows = await db.query.attachmentRequirementNodes.findMany({
      where: and(
        eq(attachmentRequirementNodes.tenderProjectVersionId, version.id),
        eq(attachmentRequirementNodes.isDeleted, false)
      ),
      orderBy: [asc(attachmentRequirementNodes.id)],
    });

    const data = rows.map((row) => ({
      attachmentNodeId: row.id,
      attachmentName: row.attachmentName,
      attachmentNo: row.attachmentNo,
      attachmentType: row.attachmentType,
      requiredType: row.requiredType,
      sourceDocumentId: row.sourceDocumentId,
      sourceSegmentId: row.sourceSegmentId,
    }));

    return NextResponse.json({ success: true, data });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { sourceDocuments, documentParseBatches } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/documents
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

    const documents = await db.query.sourceDocuments.findMany({
      where: and(
        eq(sourceDocuments.tenderProjectVersionId, version.id),
        eq(sourceDocuments.isDeleted, false)
      ),
    });

    const batches = await db.query.documentParseBatches.findMany({
      where: and(
        eq(documentParseBatches.tenderProjectVersionId, version.id),
        eq(documentParseBatches.isDeleted, false)
      ),
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });

    const docData = documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileExt: d.fileExt,
      fileSize: d.fileSize,
      pageCount: d.pageCount,
      docCategory: d.docCategory,
      parseStatus: d.parseStatus,
      textExtractStatus: d.textExtractStatus,
      structureExtractStatus: d.structureExtractStatus,
      createdAt: d.createdAt?.toISOString() ?? '',
    }));

    const batchData = batches.map((b) => ({
      id: b.id,
      batchNo: b.batchNo,
      triggerSource: b.triggerSource,
      modelProfile: b.modelProfile,
      batchStatus: b.batchStatus,
      parseStartedAt: b.parseStartedAt?.toISOString() ?? null,
      parseFinishedAt: b.parseFinishedAt?.toISOString() ?? null,
      createdAt: b.createdAt?.toISOString() ?? '',
    }));

    return NextResponse.json({ success: true, data: { documents: docData, batches: batchData } });
  });
}

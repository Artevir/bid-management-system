import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { confidenceAssessments, documentParseBatches } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

type ConfidenceItem = {
  batchId: string;
  batchNo: string;
  documentParseBatchId: number;
  confidence: number;
  confidenceLevel: string;
  extractionConfidence: number;
  businessConfidence: number;
  meta: Record<string, unknown> | null;
};

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/confidence
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

    const batches = await db.query.documentParseBatches.findMany({
      where: and(
        eq(documentParseBatches.tenderProjectVersionId, version.id),
        eq(documentParseBatches.isDeleted, false)
      ),
      orderBy: [desc(documentParseBatches.id)],
    });

    if (batches.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { versionId: version.id, total: 0 },
      });
    }

    const batchIds = batches.map((b) => b.id);
    const confidences = await db.query.confidenceAssessments.findMany({
      where: and(inArray(confidenceAssessments.generatedByBatchId, batchIds)),
      orderBy: [desc(confidenceAssessments.id)],
    });

    const confidenceMap = new Map<number, (typeof confidences)[0]>();
    for (const c of confidences) {
      const batchId = c.generatedByBatchId as number | null;
      if (batchId !== null && !confidenceMap.has(batchId)) {
        confidenceMap.set(batchId, c);
      }
    }

    const results: ConfidenceItem[] = batches.map((batch) => {
      const conf = confidenceMap.get(batch.id);
      const extraction = conf?.extractionConfidence ? Number(conf.extractionConfidence) : 0;
      const business = conf?.businessConfidence ? Number(conf.businessConfidence) : 0;
      const confidence = Math.round((extraction + business) / 2) || 0;
      const confidenceLevel = confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';

      return {
        batchId: `hub-batch-${batch.id}`,
        batchNo: batch.batchNo,
        documentParseBatchId: batch.id,
        confidence,
        confidenceLevel,
        extractionConfidence: extraction,
        businessConfidence: business,
        meta: (conf?.reasonJson as Record<string, unknown> | null) ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        projectId: project.id,
        versionId: version.id,
        batchCount: batches.length,
        total: results.length,
      },
    });
  });
}

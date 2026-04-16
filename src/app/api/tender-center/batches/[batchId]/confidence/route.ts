import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { confidenceAssessments } from '@/db/schema';
import { resolveHubDocumentParseBatchContext } from '@/app/api/tender-center/_utils';

// 040: GET /api/tender-center/batches/{batchId}/confidence
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  return withAuth(request, async (_req, userId) => {
    const hub = await resolveHubDocumentParseBatchContext(batchId);
    if (!hub) {
      return NextResponse.json({ error: '批次不存在（仅支持 hub-batch-*）' }, { status: 404 });
    }
    if (hub.project.createdBy && hub.project.createdBy !== userId) {
      return NextResponse.json({ error: '无权访问该批次' }, { status: 403 });
    }

    const [row] = await db
      .select()
      .from(confidenceAssessments)
      .where(eq(confidenceAssessments.generatedByBatchId, hub.batch.id))
      .orderBy(desc(confidenceAssessments.id))
      .limit(1);
    const extraction = row?.extractionConfidence ? Number(row.extractionConfidence) : 0;
    const business = row?.businessConfidence ? Number(row.businessConfidence) : 0;
    const confidence = Math.round((extraction + business) / 2) || 0;

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        interpretationId: null,
        documentParseBatchId: hub.batch.id,
        confidence,
        confidenceLevel: confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low',
        meta: row?.reasonJson ?? null,
      },
    });
  });
}

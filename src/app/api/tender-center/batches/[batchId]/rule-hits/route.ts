import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { ruleHitRecords } from '@/db/schema';
import { resolveHubDocumentParseBatchContext } from '@/app/api/tender-center/_utils';

// 040: GET /api/tender-center/batches/{batchId}/rule-hits
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

    const hits = await db.query.ruleHitRecords.findMany({
      where: eq(ruleHitRecords.documentParseBatchId, hub.batch.id),
    });
    const data = hits.map((h) => ({
      ruleHitId: h.id,
      ruleDefinitionId: h.ruleDefinitionId,
      targetObjectType: h.targetObjectType,
      targetObjectId: h.targetObjectId,
      hitResult: h.hitResult,
      severityLevel: h.severityLevel,
      detail: h.hitDetailJson,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: {
        batchId,
        interpretationId: null,
        documentParseBatchId: hub.batch.id,
        total: data.length,
      },
    });
  });
}

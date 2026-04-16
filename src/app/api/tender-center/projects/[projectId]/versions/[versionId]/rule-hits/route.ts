import { NextRequest, NextResponse } from 'next/server';
import { and, eq, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { ruleHitRecords, documentParseBatches, ruleDefinitions } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

type RuleHitWithRule = {
  hitId: number;
  targetObjectType: string;
  targetObjectId: number;
  hitResult: string;
  severityLevel: string;
  detail: Record<string, unknown> | null;
  ruleCode: string;
  ruleName: string | null;
  ruleType: string;
  batchNo: string;
};

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/rule-hits
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
    });

    if (batches.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { versionId: version.id, total: 0 },
      });
    }

    const batchId = batches[0].id;
    const batchNo = batches[0].batchNo;

    const hits = await db
      .select({
        id: ruleHitRecords.id,
        targetObjectType: ruleHitRecords.targetObjectType,
        targetObjectId: ruleHitRecords.targetObjectId,
        hitResult: ruleHitRecords.hitResult,
        severityLevel: ruleHitRecords.severityLevel,
        hitDetailJson: ruleHitRecords.hitDetailJson,
        ruleId: ruleHitRecords.ruleDefinitionId,
        ruleCode: ruleDefinitions.ruleCode,
        ruleName: ruleDefinitions.ruleName,
        ruleType: ruleDefinitions.ruleType,
      })
      .from(ruleHitRecords)
      .leftJoin(ruleDefinitions, eq(ruleHitRecords.ruleDefinitionId, ruleDefinitions.id))
      .where(eq(ruleHitRecords.documentParseBatchId, batchId));

    const ruleHits: RuleHitWithRule[] = hits.map((h) => ({
      hitId: h.id,
      targetObjectType: h.targetObjectType,
      targetObjectId: h.targetObjectId,
      hitResult: h.hitResult,
      severityLevel: h.severityLevel,
      detail: h.hitDetailJson as Record<string, unknown> | null,
      ruleCode: h.ruleCode || '',
      ruleName: h.ruleName || null,
      ruleType: h.ruleType || '',
      batchNo,
    }));

    return NextResponse.json({
      success: true,
      data: ruleHits,
      meta: {
        projectId: project.id,
        versionId: version.id,
        batchCount: batches.length,
        total: ruleHits.length,
      },
    });
  });
}

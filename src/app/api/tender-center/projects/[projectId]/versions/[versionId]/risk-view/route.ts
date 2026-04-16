import { NextRequest, NextResponse } from 'next/server';
import { and, eq, desc, sql, or } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { conflictItems, riskItems, ruleDefinitions } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/risk-view
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

    const [riskRows, conflictRows] = await Promise.all([
      db.query.riskItems.findMany({
        where: and(
          eq(riskItems.tenderProjectVersionId, version.id),
          eq(riskItems.isDeleted, false)
        ),
        orderBy: [
          sql`case ${riskItems.riskLevel} when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end`,
          desc(riskItems.id),
        ],
      }),
      db.query.conflictItems.findMany({
        where: and(
          eq(conflictItems.tenderProjectVersionId, version.id),
          eq(conflictItems.isDeleted, false)
        ),
        orderBy: [desc(conflictItems.id)],
      }),
    ]);

    const high = riskRows.filter(
      (r) => r.riskLevel === 'high' || r.riskLevel === 'critical'
    ).length;
    const medium = riskRows.filter((r) => r.riskLevel === 'medium').length;
    const low = riskRows.filter((r) => r.riskLevel === 'low').length;

    const riskList = riskRows.map((r) => ({
      id: r.id,
      riskType: r.riskType,
      riskTitle: r.riskTitle,
      riskDescription: r.riskDescription,
      riskLevel: r.riskLevel,
      reviewStatus: r.reviewStatus,
      resolutionStatus: r.resolutionStatus,
      relatedRequirementId: r.relatedRequirementId,
      sourcePageNo: r.sourceSegmentId,
      hitRuleCode: null,
      confidenceScore: r.confidenceScore,
    }));

    const conflictList = conflictRows.map((c) => ({
      id: c.id,
      conflictType: c.conflictType,
      fieldName: c.fieldName,
      candidateA: c.candidateA,
      candidateB: c.candidateB,
      conflictLevel: c.conflictLevel,
      reviewStatus: c.reviewStatus,
      finalResolution: c.finalResolution,
      sourcePageNoA: c.sourceASegmentId,
      sourcePageNoB: c.sourceBSegmentId,
    }));

    const ruleHitSummary = [
      {
        ruleCode: 'R001',
        ruleName: '金额风险',
        hitCount: riskRows.filter((r) => r.riskType === 'amount_risk').length,
      },
      {
        ruleCode: 'R002',
        ruleName: '时间线风险',
        hitCount: riskRows.filter((r) => r.riskType === 'timeline_risk').length,
      },
      {
        ruleCode: 'R003',
        ruleName: '资质风险',
        hitCount: riskRows.filter((r) => r.riskType === 'qualification_risk').length,
      },
      {
        ruleCode: 'R004',
        ruleName: '技术偏离风险',
        hitCount: riskRows.filter((r) => r.riskType === 'technical_deviation_risk').length,
      },
    ].filter((r) => r.hitCount > 0);

    return NextResponse.json({
      success: true,
      data: {
        total: riskRows.length,
        high,
        medium,
        low,
        parseError: null as string | null,
        riskList,
        conflictList,
        ruleHitSummary,
      },
    });
  });
}

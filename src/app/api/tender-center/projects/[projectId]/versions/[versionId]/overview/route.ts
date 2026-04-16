import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql, desc, asc } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  bidFrameworkNodes,
  conflictItems,
  moneyTerms,
  riskItems,
  reviewTasks,
  scoringItems,
  scoringSchemes,
  technicalSpecGroups,
  technicalSpecItems,
  tenderRequirements,
  timeNodes,
} from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/overview
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

    const [
      requirementsCount,
      frameworkCount,
      scoringCount,
      technicalCount,
      riskRows,
      conflictRows,
      reviewTasksRows,
      timeNodeRows,
      moneyTermRows,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(tenderRequirements)
        .where(
          and(
            eq(tenderRequirements.tenderProjectVersionId, version.id),
            eq(tenderRequirements.isDeleted, false)
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bidFrameworkNodes)
        .where(
          and(
            eq(bidFrameworkNodes.tenderProjectVersionId, version.id),
            eq(bidFrameworkNodes.isDeleted, false)
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(scoringItems)
        .innerJoin(scoringSchemes, eq(scoringSchemes.id, scoringItems.scoringSchemeId))
        .where(
          and(
            eq(scoringSchemes.tenderProjectVersionId, version.id),
            eq(scoringSchemes.isDeleted, false),
            eq(scoringItems.isDeleted, false)
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(technicalSpecItems)
        .innerJoin(
          technicalSpecGroups,
          eq(technicalSpecGroups.id, technicalSpecItems.technicalSpecGroupId)
        )
        .where(
          and(
            eq(technicalSpecGroups.tenderProjectVersionId, version.id),
            eq(technicalSpecGroups.isDeleted, false),
            eq(technicalSpecItems.isDeleted, false)
          )
        ),
      db.query.riskItems.findMany({
        where: and(
          eq(riskItems.tenderProjectVersionId, version.id),
          eq(riskItems.isDeleted, false)
        ),
        orderBy: [
          sql`case ${riskItems.riskLevel} when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end`,
          desc(riskItems.id),
        ],
        limit: 5,
      }),
      db.query.conflictItems.findMany({
        where: and(
          eq(conflictItems.tenderProjectVersionId, version.id),
          eq(conflictItems.isDeleted, false)
        ),
        orderBy: [desc(conflictItems.id)],
        limit: 5,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reviewTasks)
        .where(
          and(
            eq(reviewTasks.tenderProjectVersionId, version.id),
            eq(reviewTasks.reviewStatus, 'pending')
          )
        ),
      db.query.timeNodes.findMany({
        where: and(
          eq(timeNodes.tenderProjectVersionId, version.id),
          eq(timeNodes.isDeleted, false)
        ),
        orderBy: [asc(timeNodes.timeValue), asc(timeNodes.id)],
        limit: 10,
      }),
      db.query.moneyTerms.findMany({
        where: and(
          eq(moneyTerms.tenderProjectVersionId, version.id),
          eq(moneyTerms.isDeleted, false)
        ),
        orderBy: [desc(moneyTerms.id)],
        limit: 10,
      }),
    ]);

    const riskCount = riskRows.length;
    const conflictCount = conflictRows.length;
    const pendingReviews = Number(reviewTasksRows[0]?.count ?? 0);

    const topRisks = riskRows.map((r) => ({
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

    const topConflicts = conflictRows.map((c) => ({
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

    const keyTimeNodes = timeNodeRows.map((t) => ({
      id: t.id,
      nodeType: t.nodeType,
      nodeName: t.nodeName,
      timeText: t.timeText,
      timeValue: t.timeValue?.toISOString() || null,
      sourcePageNo: t.sourceSegmentId,
    }));

    const keyMoneyTerms = moneyTermRows.map((m) => ({
      id: m.id,
      moneyType: m.moneyType,
      amountText: m.amountText,
      amountValue: m.amountValue?.toString() || null,
      sourcePageNo: m.sourceSegmentId,
    }));

    const projectOverview = {
      projectId: project.id,
      versionId: version.id,
      projectName: project.projectName || '',
      projectCode: project.projectCode || null,
      tendererName: project.tendererName || null,
      tenderAgentName: project.tenderAgentName || null,
      parseStatus: version.versionLabel || 'pending',
      reviewStatus: project.reviewStatus || 'pending',
      assetStatus: 'generated',
      requirementCount: Number(requirementsCount[0]?.count ?? 0),
      riskCount: riskCount,
      conflictCount: conflictCount,
      scoringItemCount: Number(scoringCount[0]?.count ?? 0),
      technicalSpecCount: Number(technicalCount[0]?.count ?? 0),
      frameworkNodeCount: Number(frameworkCount[0]?.count ?? 0),
      templateCount: 0,
      materialCount: 0,
      pendingReviewCount: pendingReviews,
      criticalRiskCount: riskRows.filter(
        (r) => r.riskLevel === 'critical' || r.riskLevel === 'high'
      ).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        project: projectOverview,
        topRisks,
        topConflicts,
        pendingReviews,
        keyTimeNodes,
        keyMoneyTerms,
      },
    });
  });
}

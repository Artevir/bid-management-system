import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  bidFrameworkNodes,
  riskItems,
  scoringItems,
  scoringSchemes,
  technicalSpecGroups,
  technicalSpecItems,
  tenderRequirements,
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
    const [requirementsCount, frameworkCount, scoringCount, technicalCount, riskCount] =
      await Promise.all([
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
        db
          .select({ count: sql<number>`count(*)` })
          .from(riskItems)
          .where(
            and(eq(riskItems.tenderProjectVersionId, version.id), eq(riskItems.isDeleted, false))
          ),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
        versionId: version.id,
        status: version.versionLabel ?? '',
        parseProgress: 0,
        extractAccuracy: 0,
        metrics: {
          requirements: Number(requirementsCount[0]?.count ?? 0),
          frameworkNodes: Number(frameworkCount[0]?.count ?? 0),
          scoringItems: Number(scoringCount[0]?.count ?? 0),
          technicalItems: Number(technicalCount[0]?.count ?? 0),
          risks: Number(riskCount[0]?.count ?? 0),
        },
      },
    });
  });
}

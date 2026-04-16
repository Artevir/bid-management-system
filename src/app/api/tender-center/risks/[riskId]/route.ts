import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { riskItems, tenderProjects, tenderProjectVersions } from '@/db/schema';
import { tenderCenterError } from '@/app/api/tender-center/_response';

function parseRiskId(value: string): number | null {
  const normalized = value.startsWith('risk-') ? value.slice(5) : value;
  const id = Number(normalized);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// 040: GET /api/tender-center/risks/{riskId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ riskId: string }> }
) {
  const { riskId } = await params;
  return withAuth(request, async (_req, userId) => {
    const rid = parseRiskId(riskId);
    if (!rid) {
      return tenderCenterError('无效的 riskId', 400);
    }

    const rows = await db
      .select({
        id: riskItems.id,
        riskType: riskItems.riskType,
        riskTitle: riskItems.riskTitle,
        riskDescription: riskItems.riskDescription,
        riskLevel: riskItems.riskLevel,
        reviewStatus: riskItems.reviewStatus,
        resolutionStatus: riskItems.resolutionStatus,
        resolutionNote: riskItems.resolutionNote,
        relatedRequirementId: riskItems.relatedRequirementId,
        projectCreatedBy: tenderProjects.createdBy,
      })
      .from(riskItems)
      .innerJoin(
        tenderProjectVersions,
        eq(tenderProjectVersions.id, riskItems.tenderProjectVersionId)
      )
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .where(and(eq(riskItems.id, rid), eq(riskItems.isDeleted, false)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return tenderCenterError('风险不存在', 404);
    }
    if (row.projectCreatedBy && row.projectCreatedBy !== userId) {
      return tenderCenterError('无权访问该风险', 403);
    }

    return NextResponse.json({
      success: true,
      data: {
        riskId: `risk-${row.id}`,
        level:
          row.riskLevel === 'critical' || row.riskLevel === 'high'
            ? 'high'
            : row.riskLevel === 'medium'
              ? 'medium'
              : 'low',
        type: row.riskType,
        requirementId: row.relatedRequirementId,
        title: row.riskTitle,
        detail: row.riskDescription || '',
        reviewStatus: row.reviewStatus,
        resolutionStatus: row.resolutionStatus,
        resolutionNote: row.resolutionNote ?? null,
      },
    });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { riskItems } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

type TenderCenterRisk = {
  riskId: string;
  level: 'high' | 'medium' | 'low';
  type: string;
  title: string;
  detail: string;
  reviewStatus: string;
  resolutionStatus: string;
  resolutionNote: string | null;
  sourceRequirementId?: number | null;
};

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/risks
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

    const rows = await db.query.riskItems.findMany({
      where: and(eq(riskItems.tenderProjectVersionId, version.id), eq(riskItems.isDeleted, false)),
    });

    const risks: TenderCenterRisk[] = rows.map((row) => ({
      riskId: `risk-${row.id}`,
      level:
        row.riskLevel === 'critical' || row.riskLevel === 'high'
          ? 'high'
          : row.riskLevel === 'medium'
            ? 'medium'
            : 'low',
      type: row.riskType,
      title: row.riskTitle,
      detail: row.riskDescription || '',
      reviewStatus: row.reviewStatus,
      resolutionStatus: row.resolutionStatus,
      resolutionNote: row.resolutionNote ?? null,
      sourceRequirementId: row.relatedRequirementId,
    }));

    return NextResponse.json({
      success: true,
      data: risks,
      meta: {
        projectId: project.id,
        versionId: version.id,
        interpretationId: null,
        total: risks.length,
      },
    });
  });
}

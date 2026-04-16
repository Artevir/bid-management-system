import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { scoringItems, scoringSchemes } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/scoring-schemes
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
    const schemes = await db.query.scoringSchemes.findMany({
      where: and(
        eq(scoringSchemes.tenderProjectVersionId, version.id),
        eq(scoringSchemes.isDeleted, false)
      ),
    });
    const data = await Promise.all(
      schemes.map(async (scheme) => {
        const [countRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(scoringItems)
          .where(
            and(eq(scoringItems.scoringSchemeId, scheme.id), eq(scoringItems.isDeleted, false))
          );
        return {
          schemeId: scheme.id,
          schemeName: scheme.schemeName,
          itemCount: Number(countRow?.count ?? 0),
          totalScore: scheme.totalScore,
          businessScore: scheme.businessScore,
          technicalScore: scheme.technicalScore,
          priceScore: scheme.priceScore,
        };
      })
    );
    return NextResponse.json({ success: true, data });
  });
}

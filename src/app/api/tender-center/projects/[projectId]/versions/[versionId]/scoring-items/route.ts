import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { scoringItems, scoringSchemes } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/scoring-items
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
    const rows = await db
      .select({
        scoringItemId: scoringItems.id,
        scoringSchemeId: scoringItems.scoringSchemeId,
        category: scoringItems.categoryName,
        itemName: scoringItems.itemName,
        scoreText: scoringItems.scoreText,
        scoreValue: scoringItems.scoreValue,
        criteria: scoringItems.criteriaText,
        reviewStatus: scoringItems.reviewStatus,
        orderNo: scoringItems.orderNo,
      })
      .from(scoringItems)
      .innerJoin(scoringSchemes, eq(scoringSchemes.id, scoringItems.scoringSchemeId))
      .where(
        and(
          eq(scoringSchemes.tenderProjectVersionId, version.id),
          eq(scoringSchemes.isDeleted, false),
          eq(scoringItems.isDeleted, false)
        )
      );
    const data = rows.map((row) => ({
      ...row,
      subCategory: null,
      maxScore: row.scoreValue,
      minScore: null,
      scoringMethod: row.scoreText,
      pageNumber: null,
    }));
    return NextResponse.json({ success: true, data });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { hubBidTemplates } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/template-view
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

    const rows = await db.query.hubBidTemplates.findMany({
      where: and(
        eq(hubBidTemplates.tenderProjectVersionId, version.id),
        eq(hubBidTemplates.isDeleted, false)
      ),
    });

    const categoryMap = new Map<string, number>();
    for (const row of rows) {
      const key = row.templateType;
      categoryMap.set(key, (categoryMap.get(key) || 0) + 1);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalTemplates: rows.length,
        categories: Array.from(categoryMap.entries()).map(([category, count]) => ({
          category,
          count,
        })),
      },
    });
  });
}

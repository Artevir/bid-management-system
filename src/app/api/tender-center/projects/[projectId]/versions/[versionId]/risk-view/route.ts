import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { riskItems } from '@/db/schema';
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

    const rows = await db
      .select({
        level: riskItems.riskLevel,
      })
      .from(riskItems)
      .where(and(eq(riskItems.tenderProjectVersionId, version.id), eq(riskItems.isDeleted, false)));

    const high = rows.filter((r) => r.level === 'high' || r.level === 'critical').length;
    const medium = rows.filter((r) => r.level === 'medium').length;
    const low = rows.filter((r) => r.level === 'low').length;

    return NextResponse.json({
      success: true,
      data: {
        total: rows.length,
        high,
        medium,
        low,
        parseError: null as string | null,
      },
    });
  });
}

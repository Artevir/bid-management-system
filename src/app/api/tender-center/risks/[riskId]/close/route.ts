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

// 040: POST /api/tender-center/risks/{riskId}/close
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ riskId: string }> }
) {
  const { riskId } = await params;
  return withAuth(request, async (req, userId) => {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'close');
    if (!['close', 'reopen'].includes(action)) {
      return tenderCenterError('无效的 action，支持 close 或 reopen', 400);
    }
    const note = String(body.comment || body.note || '').trim();

    const rid = parseRiskId(riskId);
    if (!rid) {
      return tenderCenterError('无效的 riskId', 400);
    }

    const rows = await db
      .select({
        id: riskItems.id,
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
      return tenderCenterError('无权操作该风险', 403);
    }

    await db
      .update(riskItems)
      .set({
        resolutionStatus: action === 'reopen' ? 'open' : 'closed',
        reviewStatus: action === 'reopen' ? 'reviewing' : 'confirmed',
        riskDescription: note || undefined,
        updatedAt: new Date(),
      })
      .where(eq(riskItems.id, row.id));

    return NextResponse.json({
      success: true,
      data: { riskId: `risk-${row.id}`, status: action === 'reopen' ? 'open' : 'closed', action },
    });
  });
}

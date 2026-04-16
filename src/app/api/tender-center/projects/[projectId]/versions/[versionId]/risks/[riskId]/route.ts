import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { db } from '@/db';
import { riskItems } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

const REVIEW_STATUSES = new Set([
  'draft',
  'pending_review',
  'reviewing',
  'confirmed',
  'modified',
  'rejected',
  'closed',
]);
const RESOLUTION_STATUSES = new Set(['open', 'acknowledged', 'mitigated', 'closed', 'waived']);
const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);

// 040: PATCH /api/tender-center/projects/{projectId}/versions/{versionId}/risks/{riskId}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string; riskId: string }> }
) {
  const { projectId, versionId, riskId } = await params;
  const rid = parseResourceId(riskId, '风险');

  return withAuth(request, async (req, userId) => {
    const { version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      throw AppError.notFound('版本');
    }

    const body = await req.json().catch(() => ({}));
    const patch: Partial<typeof riskItems.$inferInsert> = {};

    if (typeof body.title === 'string') {
      patch.riskTitle = body.title.trim().slice(0, 200);
    }
    if (typeof body.detail === 'string') {
      patch.riskDescription = body.detail.trim() || null;
    }
    if (typeof body.level === 'string') {
      const value = body.level.trim();
      if (!RISK_LEVELS.has(value)) {
        throw AppError.badRequest('level 非法');
      }
      patch.riskLevel = value as 'low' | 'medium' | 'high' | 'critical';
    }
    if (typeof body.reviewStatus === 'string') {
      const value = body.reviewStatus.trim();
      if (!REVIEW_STATUSES.has(value)) {
        throw AppError.badRequest('reviewStatus 非法');
      }
      patch.reviewStatus = value as
        | 'draft'
        | 'pending_review'
        | 'reviewing'
        | 'confirmed'
        | 'modified'
        | 'rejected'
        | 'closed';
    }
    if (typeof body.resolutionStatus === 'string') {
      const value = body.resolutionStatus.trim();
      if (!RESOLUTION_STATUSES.has(value)) {
        throw AppError.badRequest('resolutionStatus 非法');
      }
      patch.resolutionStatus = value as 'open' | 'acknowledged' | 'mitigated' | 'closed' | 'waived';
    }

    if (Object.keys(patch).length === 0) {
      throw AppError.badRequest('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const rows = await db
      .update(riskItems)
      .set(patch)
      .where(
        and(
          eq(riskItems.id, rid),
          eq(riskItems.tenderProjectVersionId, version.id),
          eq(riskItems.isDeleted, false)
        )
      )
      .returning();
    const row = rows[0];
    if (!row) {
      throw AppError.notFound('风险');
    }

    return NextResponse.json({
      success: true,
      data: {
        riskId: row.id,
        title: row.riskTitle,
        detail: row.riskDescription,
        level: row.riskLevel,
        reviewStatus: row.reviewStatus,
        resolutionStatus: row.resolutionStatus,
      },
    });
  });
}

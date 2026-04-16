import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { db } from '@/db';
import { tenderRequirements } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import {
  HubGovernanceTargetType,
  recordHubPatchGovernance,
} from '@/lib/tender-center/hub-governance';

const REVIEW_STATUSES = new Set([
  'draft',
  'pending_review',
  'reviewing',
  'confirmed',
  'modified',
  'rejected',
  'closed',
]);

const IMPORTANCE_LEVELS = new Set(['low', 'medium', 'high', 'critical']);
const REQUIREMENT_TYPES = new Set([
  'basic_info',
  'qualification',
  'commercial',
  'technical',
  'time',
  'money',
  'submission',
  'format',
  'signature',
  'other',
]);

// 040: PATCH /api/tender-center/projects/{projectId}/versions/{versionId}/requirements/{requirementId}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string; requirementId: string }> }
) {
  const { projectId, versionId, requirementId } = await params;
  const rid = parseResourceId(requirementId, '要求');

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
    const patch: Partial<typeof tenderRequirements.$inferInsert> = {};

    if (typeof body.title === 'string') {
      patch.title = body.title.trim().slice(0, 200) || null;
    }
    if (typeof body.description === 'string') {
      patch.content = body.description.trim() || null;
      patch.normalizedContent = body.description.replace(/\s+/g, ' ').trim() || null;
    }
    if (typeof body.category === 'string') {
      const category = body.category.trim();
      if (REQUIREMENT_TYPES.has(category)) {
        patch.requirementType = category as
          | 'basic_info'
          | 'qualification'
          | 'commercial'
          | 'technical'
          | 'time'
          | 'money'
          | 'submission'
          | 'format'
          | 'signature'
          | 'other';
      }
    }
    if (typeof body.checkStatus === 'string') {
      const value = body.checkStatus.trim();
      if (!REVIEW_STATUSES.has(value)) {
        throw AppError.badRequest('checkStatus 非法');
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
    if (typeof body.importanceLevel === 'string') {
      const value = body.importanceLevel.trim();
      if (!IMPORTANCE_LEVELS.has(value)) {
        throw AppError.badRequest('importanceLevel 非法');
      }
      patch.importanceLevel = value as 'low' | 'medium' | 'high' | 'critical';
    }

    if (Object.keys(patch).length === 0) {
      throw AppError.badRequest('未提供可更新字段');
    }

    const before = await db.query.tenderRequirements.findFirst({
      where: and(
        eq(tenderRequirements.id, rid),
        eq(tenderRequirements.tenderProjectVersionId, version.id),
        eq(tenderRequirements.isDeleted, false)
      ),
    });
    if (!before) {
      throw AppError.notFound('要求');
    }

    patch.updatedAt = new Date();

    const rows = await db
      .update(tenderRequirements)
      .set(patch)
      .where(
        and(
          eq(tenderRequirements.id, rid),
          eq(tenderRequirements.tenderProjectVersionId, version.id),
          eq(tenderRequirements.isDeleted, false)
        )
      )
      .returning();
    const row = rows[0];
    if (!row) {
      throw AppError.notFound('要求');
    }

    await recordHubPatchGovernance({
      operatorId: userId,
      tenderProjectVersionId: version.id,
      targetObjectType: HubGovernanceTargetType.tenderRequirement,
      targetObjectId: row.id,
      beforeJson: {
        id: before.id,
        requirementType: before.requirementType,
        title: before.title,
        content: before.content,
        importanceLevel: before.importanceLevel,
        reviewStatus: before.reviewStatus,
      },
      afterJson: {
        id: row.id,
        requirementType: row.requirementType,
        title: row.title,
        content: row.content,
        importanceLevel: row.importanceLevel,
        reviewStatus: row.reviewStatus,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        requirementId: row.id,
        category: row.requirementType,
        title: row.title,
        description: row.content,
        importanceLevel: row.importanceLevel,
        checkStatus: row.reviewStatus,
      },
    });
  });
}

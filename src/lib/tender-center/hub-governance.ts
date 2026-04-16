import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { objectChangeLogs, reviewTasks } from '@/db/schema';

/** object_change_log / review_task 与010 口径对齐的 target_object_type */
export const HubGovernanceTargetType = {
  tenderRequirement: 'tender_requirement',
  riskItem: 'risk_item',
  assetExportSnapshot: 'asset_export_snapshot',
} as const;

type ReviewReason =
  | 'low_confidence'
  | 'high_risk'
  | 'conflict_detected'
  | 'template_ambiguity'
  | 'framework_ambiguity'
  | 'manual_sampling'
  | 'rule_exception'
  // legacy compatibility
  | 'accuracy'
  | 'compliance'
  | 'conflict_resolution'
  | 'template_binding'
  | 'other';

function jsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => jsonSafe(v));
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = jsonSafe(v);
    }
    return out;
  }
  return value;
}

/** 中枢对象人工 PATCH 后写入变更日志，并在无待办时挂一条复核任务 */
export async function recordHubPatchGovernance(params: {
  operatorId: number;
  tenderProjectVersionId: number;
  targetObjectType: string;
  targetObjectId: number;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown>;
  reviewReason?: ReviewReason;
}): Promise<void> {
  await db.insert(objectChangeLogs).values({
    targetObjectType: params.targetObjectType,
    targetObjectId: params.targetObjectId,
    changeType: 'updated',
    beforeJson:
      params.beforeJson === null ? null : (jsonSafe(params.beforeJson) as Record<string, unknown>),
    afterJson: jsonSafe(params.afterJson) as Record<string, unknown>,
    operatorId: params.operatorId,
  });

  const existing = await db.query.reviewTasks.findFirst({
    where: and(
      eq(reviewTasks.tenderProjectVersionId, params.tenderProjectVersionId),
      eq(reviewTasks.targetObjectType, params.targetObjectType),
      eq(reviewTasks.targetObjectId, params.targetObjectId),
      inArray(reviewTasks.reviewStatus, [
        'pending_assign',
        'assigned',
        'reviewing',
        // legacy compatibility
        'pending',
        'in_progress',
      ])
    ),
  });
  if (existing) return;

  await db.insert(reviewTasks).values({
    tenderProjectVersionId: params.tenderProjectVersionId,
    targetObjectType: params.targetObjectType,
    targetObjectId: params.targetObjectId,
    reviewReason: params.reviewReason ?? 'manual_sampling',
    reviewStatus: 'pending_assign',
  });
}

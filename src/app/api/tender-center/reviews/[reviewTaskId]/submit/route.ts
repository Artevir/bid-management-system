import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  conflictItems,
  reviewTasks,
  riskItems,
  tenderProjects,
  tenderProjectVersions,
  tenderRequirements,
} from '@/db/schema';
import { parseHubReviewTaskId } from '@/app/api/tender-center/_utils';
import { tenderCenterError } from '@/app/api/tender-center/_response';
import {
  buildIdempotencyDigest,
  extractIdempotencyKey,
} from '@/app/api/tender-center/_idempotency';
import {
  lookupHubIdempotentResponse,
  recordHubIdempotentResponse,
} from '@/app/api/tender-center/_hub-idempotency';
import {
  buildTenderTraceContext,
  getOrCreateTraceId,
  logTenderTraceEvent,
} from '@/app/api/tender-center/_trace';

const IDEM_OPERATION_TYPE_HUB = 'idem_review_submit_hub';

type Decision = 'approved' | 'rejected' | 'needs_revision' | 'deferred';

function normalizeDecision(value: string): Decision {
  if (value === 'rejected') return 'rejected';
  if (value === 'needs_revision') return 'needs_revision';
  if (value === 'deferred') return 'deferred';
  return 'approved';
}

async function syncTargetReviewStatus(task: typeof reviewTasks.$inferSelect, decision: Decision) {
  if (task.targetObjectType === 'tender_requirement') {
    await db
      .update(tenderRequirements)
      .set({
        reviewStatus:
          decision === 'approved'
            ? 'confirmed'
            : decision === 'rejected'
              ? 'rejected'
              : decision === 'needs_revision'
                ? 'modified'
                : 'pending_review',
        updatedAt: new Date(),
      })
      .where(eq(tenderRequirements.id, task.targetObjectId));
    return;
  }

  if (task.targetObjectType === 'risk_item') {
    await db
      .update(riskItems)
      .set({
        reviewStatus:
          decision === 'approved'
            ? 'confirmed'
            : decision === 'rejected'
              ? 'rejected'
              : decision === 'needs_revision'
                ? 'modified'
                : 'pending_review',
        updatedAt: new Date(),
      })
      .where(eq(riskItems.id, task.targetObjectId));
    return;
  }

  if (task.targetObjectType === 'conflict_item') {
    await db
      .update(conflictItems)
      .set({
        reviewStatus:
          decision === 'approved'
            ? 'resolved'
            : decision === 'rejected'
              ? 'accepted_risk'
              : 'under_review',
        updatedAt: new Date(),
      })
      .where(eq(conflictItems.id, task.targetObjectId));
  }
}

// 040: POST /api/tender-center/reviews/{reviewTaskId}/submit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewTaskId: string }> }
) {
  const { reviewTaskId } = await params;

  return withAuth(request, async (req, userId) => {
    try {
      const body = await req.json();
      const reviewResult = normalizeDecision(String(body.decision || 'approved').toLowerCase());
      const traceId = getOrCreateTraceId(req.headers);
      const idempotencyKey = extractIdempotencyKey(req.headers);

      const hubTaskId = parseHubReviewTaskId(reviewTaskId);
      if (hubTaskId === null) {
        return tenderCenterError('无效的 reviewTaskId（仅支持 review-hub-{id}）', 400);
      }

      const taskRows = await db
        .select({
          task: reviewTasks,
          projectCreatedBy: tenderProjects.createdBy,
        })
        .from(reviewTasks)
        .innerJoin(
          tenderProjectVersions,
          eq(tenderProjectVersions.id, reviewTasks.tenderProjectVersionId)
        )
        .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
        .where(eq(reviewTasks.id, hubTaskId))
        .limit(1);
      const hit = taskRows[0];
      if (!hit) {
        return tenderCenterError('复核任务不存在', 404);
      }
      if (hit.projectCreatedBy && hit.projectCreatedBy !== userId) {
        return tenderCenterError('无权提交该复核任务', 403);
      }

      const task = hit.task;
      const batchId = `review-batch-${task.tenderProjectVersionId}`;
      const requestDigest = idempotencyKey
        ? buildIdempotencyDigest({
            reviewTaskId,
            hubTaskId,
            decision: reviewResult,
            comment: String(body.comment || ''),
            reviewAccuracy: body.reviewAccuracy ? Number(body.reviewAccuracy) : null,
            action: 'submit_review',
          })
        : null;

      if (idempotencyKey && requestDigest) {
        const lookup = await lookupHubIdempotentResponse<{
          success: boolean;
          data: { reviewTaskId: string; interpretationId: number | null; decision: string };
          message: string;
        }>({
          tenderProjectVersionId: task.tenderProjectVersionId,
          idemOp: IDEM_OPERATION_TYPE_HUB,
          idempotencyKey,
          requestDigest,
        });
        if (lookup.status === 'conflict') {
          return NextResponse.json(
            { error: 'Idempotency-Key 与请求参数不一致，请更换后重试' },
            { status: 409 }
          );
        }
        if (lookup.status === 'hit') {
          return NextResponse.json({
            ...lookup.response,
            idempotentReplay: true,
            traceId,
            batchId,
            message: '幂等命中，返回首次提交结果',
          });
        }
      }

      await db
        .update(reviewTasks)
        .set({
          reviewStatus: 'completed',
          reviewResult,
          comment: body.comment || '',
          finalValueJson: body.reviewAccuracy
            ? { reviewAccuracy: Number(body.reviewAccuracy) }
            : null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reviewTasks.id, hubTaskId),
            eq(reviewTasks.tenderProjectVersionId, task.tenderProjectVersionId)
          )
        );

      await syncTargetReviewStatus(task, reviewResult);

      await logTenderTraceEvent({
        interpretationId: null,
        userId,
        trace: buildTenderTraceContext({
          interpretationId: null,
          traceId,
          taskId: reviewTaskId,
          event: 'review_submitted',
          batchId,
        }),
        detail: {
          decision: reviewResult,
          tenderProjectVersionId: task.tenderProjectVersionId,
        },
      });

      const responsePayload = {
        success: true,
        data: {
          reviewTaskId,
          interpretationId: null as number | null,
          decision: reviewResult,
          traceId,
          batchId,
        },
        message: '复核结果已提交',
      };

      if (idempotencyKey && requestDigest) {
        await recordHubIdempotentResponse({
          tenderProjectVersionId: task.tenderProjectVersionId,
          idemOp: IDEM_OPERATION_TYPE_HUB,
          idempotencyKey,
          requestDigest,
          response: responsePayload,
          userId,
        });
      }

      return NextResponse.json(responsePayload);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '提交复核失败' },
        { status: 500 }
      );
    }
  });
}

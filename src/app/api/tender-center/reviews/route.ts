import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { db } from '@/db';
import { reviewTasks } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { toHubReviewTaskId } from '@/app/api/tender-center/_utils';
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

const IDEM_OPERATION_TYPE = 'idem_review_create';

const HUB_REVIEW_REASONS = [
  'low_confidence',
  'high_risk',
  'conflict_detected',
  'template_ambiguity',
  'framework_ambiguity',
  'manual_sampling',
  'rule_exception',
  // legacy兼容
  'accuracy',
  'compliance',
  'conflict_resolution',
  'template_binding',
  'other',
] as const;

// 040: POST /api/tender-center/reviews
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      const body = await req.json();
      const projectId = parseResourceId(String(body.projectId), '项目');
      const versionId = String(body.versionId || '');
      if (!versionId) {
        return NextResponse.json({ error: '缺少 versionId' }, { status: 400 });
      }

      const { version } = await resolveHubProjectAndVersion({
        projectId: String(projectId),
        versionId,
        userId,
      });
      if (!version) {
        return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
      }

      const traceId = getOrCreateTraceId(req.headers);
      const batchId = `review-batch-${version.id}`;

      const idempotencyKey = extractIdempotencyKey(req.headers);
      const requestDigest = idempotencyKey
        ? buildIdempotencyDigest({
            projectId,
            versionId: version.id,
            assignedReviewerId: body.assignedReviewerId ? Number(body.assignedReviewerId) : null,
            note: String(body.note || ''),
            action: 'create_review',
          })
        : null;

      if (idempotencyKey && requestDigest) {
        const lookup = await lookupHubIdempotentResponse<{
          success: boolean;
          data: {
            reviewTaskId: string;
            interpretationId: number | null;
            tenderProjectVersionId: number;
          };
          message: string;
        }>({
          tenderProjectVersionId: version.id,
          idemOp: IDEM_OPERATION_TYPE,
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
            message: '幂等命中，返回首次创建的复核任务',
          });
        }
      }

      const reasonRaw = String(body.reviewReason || 'manual_sampling');
      const reviewReason = (HUB_REVIEW_REASONS as readonly string[]).includes(reasonRaw)
        ? (reasonRaw as (typeof HUB_REVIEW_REASONS)[number])
        : 'manual_sampling';

      const [inserted] = await db
        .insert(reviewTasks)
        .values({
          tenderProjectVersionId: version.id,
          targetObjectType: 'tender_project_version',
          targetObjectId: version.id,
          reviewReason,
          assignedTo: body.assignedReviewerId ? Number(body.assignedReviewerId) : null,
          reviewStatus: 'pending_assign',
        })
        .returning({ id: reviewTasks.id });

      const reviewTaskId = toHubReviewTaskId(inserted.id);

      await logTenderTraceEvent({
        interpretationId: null,
        userId,
        trace: buildTenderTraceContext({
          interpretationId: null,
          traceId,
          taskId: reviewTaskId,
          event: 'review_created',
          batchId,
        }),
        detail: {
          projectId,
          versionId: version.id,
        },
      });

      const responsePayload = {
        success: true,
        data: {
          reviewTaskId,
          interpretationId: null as number | null,
          tenderProjectVersionId: version.id,
          traceId,
          batchId,
        },
        message: '复核任务已创建',
      };

      if (idempotencyKey && requestDigest) {
        await recordHubIdempotentResponse({
          tenderProjectVersionId: version.id,
          idemOp: IDEM_OPERATION_TYPE,
          idempotencyKey,
          requestDigest,
          response: responsePayload,
          userId,
        });
      }

      return NextResponse.json(responsePayload);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '创建复核任务失败' },
        { status: 500 }
      );
    }
  });
}

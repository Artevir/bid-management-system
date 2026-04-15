import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { bidDocumentInterpretations, bidInterpretationLogs } from '@/db/schema';
import { parseReviewTaskId, toBatchId } from '@/app/api/tender-center/_utils';
import { tenderCenterError } from '@/app/api/tender-center/_response';
import {
  buildIdempotencyDigest,
  extractIdempotencyKey,
  lookupIdempotentResponse,
  recordIdempotentResponse,
} from '@/app/api/tender-center/_idempotency';
import {
  buildTenderTraceContext,
  getOrCreateTraceId,
  logTenderTraceEvent,
} from '@/app/api/tender-center/_trace';

const IDEM_OPERATION_TYPE = 'idem_review_submit';

// 040: POST /api/tender-center/reviews/{reviewTaskId}/submit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewTaskId: string }> }
) {
  const { reviewTaskId } = await params;
  const interpretationId = parseReviewTaskId(reviewTaskId);
  if (!interpretationId) {
    return tenderCenterError('无效的 reviewTaskId', 400);
  }

  return withAuth(request, async (req, userId) => {
    try {
      const body = await req.json();
      const decision = String(body.decision || 'approved').toLowerCase();
      const reviewStatus = decision === 'rejected' ? 'rejected' : 'approved';
      const traceId = getOrCreateTraceId(req.headers);
      const batchId = toBatchId(interpretationId);
      const idempotencyKey = extractIdempotencyKey(req.headers);
      const requestDigest = idempotencyKey
        ? buildIdempotencyDigest({
            reviewTaskId,
            interpretationId,
            decision: reviewStatus,
            comment: String(body.comment || ''),
            reviewAccuracy: body.reviewAccuracy ? Number(body.reviewAccuracy) : null,
            action: 'submit_review',
          })
        : null;

      if (idempotencyKey && requestDigest) {
        const lookup = await lookupIdempotentResponse<{
          success: boolean;
          data: { reviewTaskId: string; interpretationId: number; decision: string };
          message: string;
        }>({
          interpretationId,
          operationType: IDEM_OPERATION_TYPE,
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
        .update(bidDocumentInterpretations)
        .set({
          reviewStatus,
          reviewerId: userId,
          reviewedAt: new Date(),
          reviewComment: body.comment || '',
          reviewAccuracy: body.reviewAccuracy ? Number(body.reviewAccuracy) : null,
          updatedAt: new Date(),
        })
        .where(eq(bidDocumentInterpretations.id, interpretationId));

      await db.insert(bidInterpretationLogs).values({
        interpretationId,
        operationType: 'review_submitted',
        operationContent: JSON.stringify({
          reviewTaskId,
          decision: reviewStatus,
          comment: body.comment || '',
        }),
        operatorId: userId,
        operatorName: 'system',
      });

      await logTenderTraceEvent({
        interpretationId,
        userId,
        trace: buildTenderTraceContext({
          interpretationId,
          traceId,
          taskId: reviewTaskId,
          event: 'review_submitted',
        }),
        detail: {
          decision: reviewStatus,
        },
      });

      const responsePayload = {
        success: true,
        data: { reviewTaskId, interpretationId, decision: reviewStatus, traceId, batchId },
        message: '复核结果已提交',
      };

      if (idempotencyKey && requestDigest) {
        await recordIdempotentResponse({
          interpretationId,
          operationType: IDEM_OPERATION_TYPE,
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

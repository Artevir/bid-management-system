import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { db } from '@/db';
import { bidInterpretationLogs, bidDocumentInterpretations } from '@/db/schema';
import {
  resolveInterpretationByProjectAndVersion,
  toReviewTaskId,
} from '@/app/api/tender-center/_utils';
import { eq } from 'drizzle-orm';
import {
  buildIdempotencyDigest,
  extractIdempotencyKey,
  lookupIdempotentResponse,
  recordIdempotentResponse,
} from '@/app/api/tender-center/_idempotency';

const IDEM_OPERATION_TYPE = 'idem_review_create';

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

      const interpretation = await resolveInterpretationByProjectAndVersion(projectId, versionId);
      if (!interpretation) {
        return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
      }

      const idempotencyKey = extractIdempotencyKey(req.headers);
      const requestDigest = idempotencyKey
        ? buildIdempotencyDigest({
            projectId,
            versionId,
            interpretationId: interpretation.id,
            assignedReviewerId: body.assignedReviewerId ? Number(body.assignedReviewerId) : null,
            note: String(body.note || ''),
            action: 'create_review',
          })
        : null;

      if (idempotencyKey && requestDigest) {
        const lookup = await lookupIdempotentResponse<{
          success: boolean;
          data: { reviewTaskId: string; interpretationId: number };
          message: string;
        }>({
          interpretationId: interpretation.id,
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
            message: '幂等命中，返回首次创建的复核任务',
          });
        }
      }

      const reviewTaskId = toReviewTaskId(interpretation.id);
      await db
        .update(bidDocumentInterpretations)
        .set({
          reviewStatus: 'pending',
          assignedReviewerId: body.assignedReviewerId ? Number(body.assignedReviewerId) : null,
          updatedAt: new Date(),
        })
        .where(eq(bidDocumentInterpretations.id, interpretation.id));

      await db.insert(bidInterpretationLogs).values({
        interpretationId: interpretation.id,
        operationType: 'review_created',
        operationContent: JSON.stringify({
          reviewTaskId,
          projectId,
          versionId,
          note: body.note || '',
        }),
        operatorId: userId,
        operatorName: 'system',
      });

      const responsePayload = {
        success: true,
        data: { reviewTaskId, interpretationId: interpretation.id },
        message: '复核任务已创建',
      };

      if (idempotencyKey && requestDigest) {
        await recordIdempotentResponse({
          interpretationId: interpretation.id,
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
        { error: error instanceof Error ? error.message : '创建复核任务失败' },
        { status: 500 }
      );
    }
  });
}

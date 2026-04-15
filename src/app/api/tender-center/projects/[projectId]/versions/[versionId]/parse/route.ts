import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { executeInterpretation } from '@/lib/interpretation/service';
import { db } from '@/db';
import { bidInterpretationLogs } from '@/db/schema';
import { resolveInterpretationByProjectAndVersion } from '@/app/api/tender-center/_utils';
import {
  buildIdempotencyDigest,
  extractIdempotencyKey,
  lookupIdempotentResponse,
  recordIdempotentResponse,
} from '@/app/api/tender-center/_idempotency';

const IDEM_OPERATION_TYPE = 'idem_parse';

// 040: POST /api/tender-center/projects/{projectId}/versions/{versionId}/parse
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  const pid = parseResourceId(projectId, '项目');

  return withAuth(request, async (req, userId) => {
    const interpretation = await resolveInterpretationByProjectAndVersion(pid, versionId);
    if (!interpretation) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }

    if (interpretation.uploaderId !== userId) {
      return NextResponse.json({ error: '无权操作该版本' }, { status: 403 });
    }

    // 避免重复触发同一解析任务
    if (interpretation.status === 'parsing') {
      return NextResponse.json({ error: '正在解析中，请勿重复操作' }, { status: 400 });
    }

    const idempotencyKey = extractIdempotencyKey(req.headers);
    const requestDigest = idempotencyKey
      ? buildIdempotencyDigest({
          projectId: pid,
          versionId,
          interpretationId: interpretation.id,
          action: 'parse',
        })
      : null;

    if (idempotencyKey && requestDigest) {
      const lookup = await lookupIdempotentResponse<{
        success: boolean;
        data: { projectId: number; versionId: string; interpretationId: number };
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
          message: '幂等命中，返回首次解析触发结果',
        });
      }
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers);
    executeInterpretation(interpretation.id, customHeaders).catch((error) => {
      console.error('tender-center parse failed:', error);
    });

    await db.insert(bidInterpretationLogs).values({
      interpretationId: interpretation.id,
      operationType: 'parse_triggered',
      operationContent: `由中枢接口触发解析: project=${pid}, version=${versionId}`,
      operatorId: userId,
      operatorName: 'system',
    });

    const responsePayload = {
      success: true,
      data: {
        projectId: pid,
        versionId,
        interpretationId: interpretation.id,
      },
      message: '解析任务已启动',
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
  });
}

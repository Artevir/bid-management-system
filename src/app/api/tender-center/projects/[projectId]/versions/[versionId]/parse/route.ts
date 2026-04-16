import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { documentParseBatches } from '@/db/schema';
import { toHubDocumentParseBatchId } from '@/app/api/tender-center/_utils';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
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
import { ingestTenderVersionDocuments } from '@/lib/tender-center/ingestion';

const IDEM_OPERATION_TYPE = 'idem_parse';

// 040: POST /api/tender-center/projects/{projectId}/versions/{versionId}/parse
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;

  return withAuth(request, async (req, userId) => {
    const { project, version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }

    const traceId = getOrCreateTraceId(req.headers);
    const idempotencyKey = extractIdempotencyKey(req.headers);
    const requestDigest = idempotencyKey
      ? buildIdempotencyDigest({
          projectId: project.id,
          versionId: version.id,
          action: 'parse',
        })
      : null;

    if (idempotencyKey && requestDigest) {
      const lookup = await lookupHubIdempotentResponse<{
        success: boolean;
        data: {
          projectId: number;
          versionId: number;
          documentParseBatchId: number;
          batchId: string;
          traceId: string;
          taskId: string;
          parsedDocuments: number;
          failedDocuments: number;
          pagesInserted: number;
          segmentsInserted: number;
          requirementsInserted: number;
          risksInserted: number;
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
        const batchId = lookup.response.data?.batchId ?? '';
        return NextResponse.json({
          ...lookup.response,
          idempotentReplay: true,
          traceId,
          batchId,
          taskId: lookup.response.data?.taskId ?? `parse-${version.id}`,
          message: '幂等命中，返回首次解析触发结果',
        });
      }
    }

    const [batch] = await db
      .insert(documentParseBatches)
      .values({
        tenderProjectVersionId: version.id,
        batchNo: `parse-${Date.now()}`,
        triggerSource: 'manual',
        batchStatus: 'running',
        parseStartedAt: new Date(),
        operatorId: userId,
      })
      .returning({ id: documentParseBatches.id });

    const ingestResult = await ingestTenderVersionDocuments({
      projectId: project.id,
      versionId: version.id,
      batchId: batch.id,
    });

    const finalBatchStatus: 'succeeded' | 'partial' | 'failed' =
      ingestResult.failedDocuments === 0
        ? 'succeeded'
        : ingestResult.parsedDocuments > 0
          ? 'partial'
          : 'failed';
    await db
      .update(documentParseBatches)
      .set({
        batchStatus: finalBatchStatus,
        parseFinishedAt: new Date(),
      })
      .where(eq(documentParseBatches.id, batch.id));

    const batchId = toHubDocumentParseBatchId(batch.id);
    const taskId = `parse-${batch.id}`;

    await logTenderTraceEvent({
      interpretationId: null,
      userId,
      trace: buildTenderTraceContext({
        interpretationId: null,
        traceId,
        taskId,
        event: 'parse_triggered',
        batchId,
      }),
      detail: {
        projectId: project.id,
        versionId: version.id,
        documentParseBatchId: batch.id,
        ...ingestResult,
      },
    });

    const responsePayload = {
      success: true,
      data: {
        projectId: project.id,
        versionId: version.id,
        documentParseBatchId: batch.id,
        batchId,
        traceId,
        taskId,
        ...ingestResult,
      },
      message:
        ingestResult.parsedDocuments > 0
          ? `解析完成：成功 ${ingestResult.parsedDocuments} 个文件，新增 ${ingestResult.pagesInserted} 页、${ingestResult.segmentsInserted} 条分段、${ingestResult.requirementsInserted} 条要求、${ingestResult.risksInserted} 条风险`
          : ingestResult.failedDocuments > 0
            ? `解析失败：${ingestResult.failedDocuments} 个文件处理失败，请检查 source_document.storage_key 与文件格式`
            : '解析批次已记录（当前版本无可解析文件，或均已解析过）',
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
  });
}

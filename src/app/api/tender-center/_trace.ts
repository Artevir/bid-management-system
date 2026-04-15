import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { bidInterpretationLogs } from '@/db/schema';
import { toBatchId } from '@/app/api/tender-center/_utils';

export type TenderTraceContext = {
  traceId: string;
  batchId: string;
  taskId: string;
  event: string;
  timestamp: string;
};

export function getOrCreateTraceId(headers: Headers): string {
  const candidates = ['x-trace-id', 'x-request-id', 'trace-id', 'traceparent'];
  for (const key of candidates) {
    const value = headers.get(key)?.trim();
    if (!value) {
      continue;
    }
    if (key === 'traceparent') {
      const parts = value.split('-');
      if (parts.length >= 2 && parts[1]) {
        return parts[1];
      }
    }
    return value;
  }
  return randomUUID().replace(/-/g, '');
}

export function buildTenderTraceContext(params: {
  interpretationId: number;
  traceId: string;
  taskId: string;
  event: string;
}) {
  const context: TenderTraceContext = {
    traceId: params.traceId,
    batchId: toBatchId(params.interpretationId),
    taskId: params.taskId,
    event: params.event,
    timestamp: new Date().toISOString(),
  };
  return context;
}

export async function logTenderTraceEvent(params: {
  interpretationId: number;
  userId: number;
  trace: TenderTraceContext;
  detail?: Record<string, unknown>;
}) {
  const payload = {
    ...params.trace,
    detail: params.detail ?? {},
  };

  // 保留一条统一可检索的结构化日志
  console.info('[TENDER_TRACE]', JSON.stringify(payload));

  await db.insert(bidInterpretationLogs).values({
    interpretationId: params.interpretationId,
    operationType: 'trace_event',
    operationContent: JSON.stringify(payload),
    operatorId: params.userId,
    operatorName: 'system',
  });
}

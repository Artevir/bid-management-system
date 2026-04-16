import { randomUUID } from 'node:crypto';

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
  interpretationId?: number | null;
  traceId: string;
  taskId: string;
  event: string;
  /** 中枢批次：hub-batch-{id} */
  batchId?: string | null;
}) {
  const batchId = params.batchId?.trim() || 'unknown';
  const context: TenderTraceContext = {
    traceId: params.traceId,
    batchId,
    taskId: params.taskId,
    event: params.event,
    timestamp: new Date().toISOString(),
  };
  return context;
}

export async function logTenderTraceEvent(params: {
  interpretationId?: number | null;
  userId: number;
  trace: TenderTraceContext;
  detail?: Record<string, unknown>;
}) {
  const payload = {
    ...params.trace,
    detail: params.detail ?? {},
  };

  console.info('[TENDER_TRACE]', JSON.stringify(payload));
}

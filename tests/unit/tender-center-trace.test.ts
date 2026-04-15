import { describe, expect, it } from 'vitest';
import { buildTenderTraceContext, getOrCreateTraceId } from '@/app/api/tender-center/_trace';

describe('Tender Center Trace Utils', () => {
  it('prefers x-trace-id header', () => {
    const headers = new Headers({
      'x-trace-id': 'trace-abc',
      'x-request-id': 'req-1',
    });
    expect(getOrCreateTraceId(headers)).toBe('trace-abc');
  });

  it('extracts trace id from traceparent', () => {
    const headers = new Headers({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00',
    });
    expect(getOrCreateTraceId(headers)).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('builds structured trace context with batchId/taskId', () => {
    const trace = buildTenderTraceContext({
      interpretationId: 12,
      traceId: 'trace-x',
      taskId: 'task-1',
      event: 'parse_triggered',
    });
    expect(trace.traceId).toBe('trace-x');
    expect(trace.taskId).toBe('task-1');
    expect(trace.batchId).toBe('batch-12-1');
    expect(trace.event).toBe('parse_triggered');
    expect(typeof trace.timestamp).toBe('string');
  });
});

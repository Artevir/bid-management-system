import { describe, expect, it } from 'vitest';
import {
  assertInterpretationStatusTransition,
  canTransitionInterpretationStatus,
  toTenderBatchStatus,
} from '@/lib/interpretation/status-machine';

describe('Tender Center Batch Status Machine', () => {
  it('maps interpretation status to tender batch status', () => {
    expect(toTenderBatchStatus('pending')).toBe('pending');
    expect(toTenderBatchStatus('parsing')).toBe('running');
    expect(toTenderBatchStatus('completed')).toBe('succeeded');
    expect(toTenderBatchStatus('failed')).toBe('failed');
  });

  it('allows legal transitions', () => {
    expect(canTransitionInterpretationStatus('pending', 'parsing')).toBe(true);
    expect(canTransitionInterpretationStatus('parsing', 'completed')).toBe(true);
    expect(canTransitionInterpretationStatus('parsing', 'failed')).toBe(true);
    expect(canTransitionInterpretationStatus('failed', 'pending')).toBe(true);
    expect(canTransitionInterpretationStatus('failed', 'parsing')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransitionInterpretationStatus('pending', 'completed')).toBe(false);
    expect(canTransitionInterpretationStatus('pending', 'failed')).toBe(false);
    expect(canTransitionInterpretationStatus('parsing', 'pending')).toBe(false);
    expect(canTransitionInterpretationStatus('completed', 'pending')).toBe(false);
    expect(canTransitionInterpretationStatus('completed', 'parsing')).toBe(false);
  });

  it('throws explicit error for illegal transition assertions', () => {
    expect(() =>
      assertInterpretationStatusTransition('completed', 'parsing', 'batch-transition-test')
    ).toThrow(/非法状态迁移/);
  });
});

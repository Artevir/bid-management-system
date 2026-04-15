import type { InterpretationStatus } from '@/db/schema';

export type TenderBatchStatus = 'pending' | 'running' | 'succeeded' | 'failed';

const ALLOWED_INTERPRETATION_STATUS_TRANSITIONS: Record<
  InterpretationStatus,
  readonly InterpretationStatus[]
> = {
  pending: ['parsing'],
  parsing: ['completed', 'failed'],
  completed: [],
  failed: ['pending', 'parsing'],
};

export function toTenderBatchStatus(status: InterpretationStatus): TenderBatchStatus {
  if (status === 'parsing') {
    return 'running';
  }
  if (status === 'completed') {
    return 'succeeded';
  }
  return status;
}

export function canTransitionInterpretationStatus(
  from: InterpretationStatus,
  to: InterpretationStatus
): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_INTERPRETATION_STATUS_TRANSITIONS[from].includes(to);
}

export function assertInterpretationStatusTransition(
  from: InterpretationStatus,
  to: InterpretationStatus,
  context?: string
) {
  if (canTransitionInterpretationStatus(from, to)) {
    return;
  }
  const allowed = ALLOWED_INTERPRETATION_STATUS_TRANSITIONS[from];
  const prefix = context ? `${context}: ` : '';
  throw new Error(
    `${prefix}非法状态迁移 ${from} -> ${to}，允许迁移为 [${allowed.join(', ') || '无'}]`
  );
}

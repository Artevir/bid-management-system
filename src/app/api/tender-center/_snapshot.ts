export const TENDER_SNAPSHOT_TYPES = [
  'requirements_snapshot',
  'framework_snapshot',
  'templates_snapshot',
  'materials_snapshot',
  'full_snapshot',
] as const;

export type TenderSnapshotType = (typeof TENDER_SNAPSHOT_TYPES)[number];

export const TENDER_EXPORT_MODES = [
  'internal_consumption',
  'downstream_module',
  'manual_download',
  'api_delivery',
] as const;

export type TenderExportMode = (typeof TENDER_EXPORT_MODES)[number];

export const TENDER_SNAPSHOT_STATUSES = [
  'generating',
  'generated',
  'published',
  'invalidated',
] as const;

export type TenderSnapshotStatus = (typeof TENDER_SNAPSHOT_STATUSES)[number];

export interface TenderSnapshotPayload {
  snapshotId: string;
  interpretationId: number;
  projectId: number;
  versionId: string;
  name: string;
  note: string;
  snapshotType: TenderSnapshotType;
  exportMode: TenderExportMode;
  status: TenderSnapshotStatus;
  createdAt: string;
  publishedAt: string | null;
  publishedBy: number | null;
  invalidatedAt: string | null;
  invalidatedBy: number | null;
  summary: {
    reviewStatus: string | null;
    parseProgress: number | null;
    checklistCount: number | null;
  };
}

export function isTenderSnapshotType(value: string): value is TenderSnapshotType {
  return (TENDER_SNAPSHOT_TYPES as readonly string[]).includes(value);
}

export function isTenderExportMode(value: string): value is TenderExportMode {
  return (TENDER_EXPORT_MODES as readonly string[]).includes(value);
}

function toSnapshotStatus(value: unknown): TenderSnapshotStatus {
  if (typeof value !== 'string') {
    return 'generated';
  }
  return (TENDER_SNAPSHOT_STATUSES as readonly string[]).includes(value)
    ? (value as TenderSnapshotStatus)
    : 'generated';
}

function toSnapshotType(value: unknown): TenderSnapshotType {
  if (typeof value === 'string' && isTenderSnapshotType(value)) {
    return value;
  }
  return 'full_snapshot';
}

function toExportMode(value: unknown): TenderExportMode {
  if (typeof value === 'string' && isTenderExportMode(value)) {
    return value;
  }
  return 'internal_consumption';
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseTenderSnapshotPayload(raw: unknown): TenderSnapshotPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const payload = raw as Record<string, unknown>;
  if (typeof payload.snapshotId !== 'string' || typeof payload.interpretationId !== 'number') {
    return null;
  }
  return {
    snapshotId: payload.snapshotId,
    interpretationId: payload.interpretationId,
    projectId: typeof payload.projectId === 'number' ? payload.projectId : 0,
    versionId: toStringValue(payload.versionId),
    name: toStringValue(payload.name, payload.snapshotId),
    note: toStringValue(payload.note),
    snapshotType: toSnapshotType(payload.snapshotType),
    exportMode: toExportMode(payload.exportMode),
    status: toSnapshotStatus(payload.status),
    createdAt: toStringValue(payload.createdAt, new Date().toISOString()),
    publishedAt: toNullableString(payload.publishedAt),
    publishedBy: toNullableNumber(payload.publishedBy),
    invalidatedAt: toNullableString(payload.invalidatedAt),
    invalidatedBy: toNullableNumber(payload.invalidatedBy),
    summary: {
      reviewStatus:
        payload.summary && typeof payload.summary === 'object'
          ? toNullableString((payload.summary as Record<string, unknown>).reviewStatus)
          : null,
      parseProgress:
        payload.summary && typeof payload.summary === 'object'
          ? toNullableNumber((payload.summary as Record<string, unknown>).parseProgress)
          : null,
      checklistCount:
        payload.summary && typeof payload.summary === 'object'
          ? toNullableNumber((payload.summary as Record<string, unknown>).checklistCount)
          : null,
    },
  };
}

export interface TenderSnapshotMutationInput {
  action?: 'publish' | 'invalidate';
  name?: string;
  note?: string;
}

export interface TenderSnapshotMutationResult {
  ok: boolean;
  payload: TenderSnapshotPayload;
  error?: string;
}

export function mutateTenderSnapshotPayload(
  current: TenderSnapshotPayload,
  input: TenderSnapshotMutationInput,
  operatorId: number
): TenderSnapshotMutationResult {
  const next: TenderSnapshotPayload = {
    ...current,
    summary: { ...current.summary },
  };

  if ((input.name !== undefined || input.note !== undefined) && current.status === 'published') {
    return {
      ok: false,
      payload: current,
      error: '已发布快照不可修改',
    };
  }

  if (input.name !== undefined) {
    next.name = input.name;
  }
  if (input.note !== undefined) {
    next.note = input.note;
  }

  if (input.action === 'publish') {
    if (current.status !== 'generated') {
      return {
        ok: false,
        payload: current,
        error: '仅生成态快照允许发布',
      };
    }
    next.status = 'published';
    next.publishedAt = new Date().toISOString();
    next.publishedBy = operatorId;
  }

  if (input.action === 'invalidate') {
    if (current.status === 'invalidated') {
      return {
        ok: false,
        payload: current,
        error: '快照已失效，无需重复失效',
      };
    }
    next.status = 'invalidated';
    next.invalidatedAt = new Date().toISOString();
    next.invalidatedBy = operatorId;
  }

  return {
    ok: true,
    payload: next,
  };
}

import { describe, expect, it } from 'vitest';
import {
  mutateTenderSnapshotPayload,
  parseTenderSnapshotPayload,
} from '@/app/api/tender-center/_snapshot';

describe('Tender Center Snapshot Immutability', () => {
  it('rejects metadata update after snapshot is published', () => {
    const payload = parseTenderSnapshotPayload({
      snapshotId: 'snap-1',
      interpretationId: 1,
      projectId: 2,
      versionId: 'v1',
      name: 'first',
      note: 'n',
      snapshotType: 'full_snapshot',
      exportMode: 'internal_consumption',
      status: 'published',
      createdAt: '2026-04-15T00:00:00.000Z',
      publishedAt: '2026-04-15T01:00:00.000Z',
      publishedBy: 1,
      invalidatedAt: null,
      invalidatedBy: null,
      summary: { reviewStatus: 'pending', parseProgress: 100, checklistCount: 10 },
    });
    expect(payload).not.toBeNull();

    const result = mutateTenderSnapshotPayload(payload!, { name: 'renamed' }, 1);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('已发布快照不可修改');
    expect(result.payload.name).toBe('first');
  });

  it('allows publishing generated snapshot', () => {
    const payload = parseTenderSnapshotPayload({
      snapshotId: 'snap-2',
      interpretationId: 1,
      projectId: 2,
      versionId: 'v1',
      name: 'second',
      note: '',
      snapshotType: 'requirements_snapshot',
      exportMode: 'manual_download',
      status: 'generated',
      createdAt: '2026-04-15T00:00:00.000Z',
      summary: { reviewStatus: 'pending', parseProgress: 90, checklistCount: 5 },
    });
    expect(payload).not.toBeNull();

    const result = mutateTenderSnapshotPayload(payload!, { action: 'publish' }, 99);
    expect(result.ok).toBe(true);
    expect(result.payload.status).toBe('published');
    expect(result.payload.publishedBy).toBe(99);
    expect(result.payload.publishedAt).toBeTruthy();
  });
});

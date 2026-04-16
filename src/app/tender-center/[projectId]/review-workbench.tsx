'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ReviewTask = {
  reviewLogId: number;
  reviewTaskId: string;
  type: string;
  content: string | null;
  operationTime: string;
  reviewStatus: string;
  reviewResult: string | null;
};

type ConflictItem = {
  conflictId: number;
  title: string;
  category: string;
  status: string;
  detail: string;
};

type SnapshotItem = {
  snapshotId?: string;
  name?: string;
  status?: string;
  createdAt?: string;
  note?: string;
};

const REVIEW_DECISIONS = ['approved', 'rejected', 'needs_revision', 'deferred'] as const;
const SNAPSHOT_TYPES = [
  'requirements_snapshot',
  'framework_snapshot',
  'templates_snapshot',
  'materials_snapshot',
  'full_snapshot',
] as const;

export function ReviewWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [reviewRows, setReviewRows] = useState<ReviewTask[]>([]);
  const [conflictRows, setConflictRows] = useState<ConflictItem[]>([]);
  const [snapshotRows, setSnapshotRows] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotType, setSnapshotType] =
    useState<(typeof SNAPSHOT_TYPES)[number]>('full_snapshot');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [reviewsRes, conflictsRes, snapshotsRes] = await Promise.all([
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/reviews`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/conflicts`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/snapshots`),
      ]);
      const reviewsPayload = await reviewsRes.json();
      const conflictsPayload = await conflictsRes.json();
      const snapshotsPayload = await snapshotsRes.json();
      if (!reviewsRes.ok || !reviewsPayload.success) {
        throw new Error(reviewsPayload.error || reviewsPayload.message || '加载复核任务失败');
      }
      if (!conflictsRes.ok || !conflictsPayload.success) {
        throw new Error(conflictsPayload.error || conflictsPayload.message || '加载冲突失败');
      }
      if (!snapshotsRes.ok || !snapshotsPayload.success) {
        throw new Error(snapshotsPayload.error || snapshotsPayload.message || '加载快照失败');
      }
      setReviewRows(Array.isArray(reviewsPayload.data) ? reviewsPayload.data : []);
      setConflictRows(Array.isArray(conflictsPayload.data) ? conflictsPayload.data : []);
      setSnapshotRows(Array.isArray(snapshotsPayload.data) ? snapshotsPayload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载复核工作台失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId, versionId]);

  const submitReview = async (
    reviewTaskId: string,
    decision: (typeof REVIEW_DECISIONS)[number]
  ) => {
    setError('');
    try {
      const res = await fetch(`/api/tender-center/reviews/${reviewTaskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '提交复核失败');
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交复核失败');
    }
  };

  const resolveConflict = async (conflictId: number) => {
    setError('');
    try {
      const res = await fetch(`/api/tender-center/conflicts/conflict-${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionType: 'manual_override' }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '处理冲突失败');
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理冲突失败');
    }
  };

  const createSnapshot = async () => {
    setCreatingSnapshot(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/snapshots`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            snapshotType,
            exportMode: 'manual_download',
            name: snapshotName.trim() || undefined,
            note: 'review-workbench',
          }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '创建快照失败');
      }
      setSnapshotName('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建快照失败');
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const updateSnapshot = async (snapshotId: string, action: 'publish' | 'invalidate') => {
    setError('');
    try {
      const res = await fetch(`/api/tender-center/snapshots/${encodeURIComponent(snapshotId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(
          payload.error || payload.message || `快照${action === 'publish' ? '发布' : '失效'}失败`
        );
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新快照失败');
    }
  };

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>复核任务</CardTitle>
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            刷新
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviewRows.map((row) => (
            <div key={row.reviewLogId} className="rounded border p-3 space-y-2">
              <p className="text-sm font-medium">
                任务 {row.reviewTaskId} | 类型 {row.type}
              </p>
              <p className="text-xs text-muted-foreground">
                状态: {row.reviewStatus} | 结果: {row.reviewResult || '-'} | 时间:{' '}
                {row.operationTime}
              </p>
              <p className="text-sm">{row.content || '-'}</p>
              <div className="flex flex-wrap gap-2">
                {REVIEW_DECISIONS.map((decision) => (
                  <Button
                    key={decision}
                    size="sm"
                    variant="outline"
                    onClick={() => void submitReview(row.reviewTaskId, decision)}
                  >
                    提交 {decision}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          {reviewRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无复核任务。</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>冲突处理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conflictRows.map((row) => (
            <div key={row.conflictId} className="rounded border p-3 space-y-2">
              <p className="text-sm font-medium">
                conflict-{row.conflictId} | {row.title}
              </p>
              <p className="text-xs text-muted-foreground">
                分类: {row.category} | 状态: {row.status}
              </p>
              <p className="text-sm">{row.detail || '-'}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void resolveConflict(row.conflictId)}
              >
                标记为已处理
              </Button>
            </div>
          ))}
          {conflictRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无冲突数据。</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>快照中心</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="快照名称（可选）"
              className="max-w-xs"
            />
            <select
              className="rounded border px-2 py-1 text-sm bg-background"
              value={snapshotType}
              onChange={(e) => setSnapshotType(e.target.value as (typeof SNAPSHOT_TYPES)[number])}
            >
              {SNAPSHOT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Button onClick={() => void createSnapshot()} disabled={creatingSnapshot}>
              {creatingSnapshot ? '创建中...' : '创建快照'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshotRows.map((row, index) => {
            const sid = row.snapshotId || '';
            return (
              <div key={`${sid}-${index}`} className="rounded border p-3 space-y-2">
                <p className="text-sm font-medium">{row.name || sid || `snapshot-${index + 1}`}</p>
                <p className="text-xs text-muted-foreground">
                  snapshotId: {sid || '-'} | 状态: {row.status || '-'} | 创建时间:{' '}
                  {row.createdAt || '-'}
                </p>
                <p className="text-sm">{row.note || '-'}</p>
                {sid ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void updateSnapshot(sid, 'publish')}
                    >
                      发布
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void updateSnapshot(sid, 'invalidate')}
                    >
                      失效
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {snapshotRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无快照数据。</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type ReviewTask = {
  reviewLogId: number;
  reviewTaskId: string;
  type: string;
  content: string | null;
  operationTime: string;
  reviewStatus: string;
  reviewResult: string | null;
  objectType?: string | null;
  objectId?: number | null;
  originalValue?: string | null;
  aiValue?: string | null;
  suggestedValue?: string | null;
  assignedTo?: string | null;
  reason?: string | null;
};

type ConflictItem = {
  conflictId: number;
  title: string;
  category: string;
  status: string;
  detail: string;
  riskLevel?: string | null;
};

type SnapshotItem = {
  snapshotId?: string;
  name?: string;
  status?: string;
  createdAt?: string;
  note?: string;
};

type ConfidenceItem = {
  batchId: string;
  batchNo: string;
  documentParseBatchId: number;
  confidence: number;
  confidenceLevel: string;
  extractionConfidence: number;
  businessConfidence: number;
  meta: Record<string, unknown> | null;
};

const REVIEW_DECISIONS = ['approved', 'rejected', 'needs_revision', 'deferred'] as const;
const SNAPSHOT_TYPES = [
  'requirements_snapshot',
  'framework_snapshot',
  'templates_snapshot',
  'materials_snapshot',
  'full_snapshot',
] as const;

type TabType = 'reviews' | 'conflicts' | 'confidence' | 'snapshots';

type FilterState = {
  reviewStatus: string;
  reviewResult: string;
  objectType: string;
  conflictStatus: string;
  conflictCategory: string;
};

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
  const [confidenceRows, setConfidenceRows] = useState<ConfidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotType, setSnapshotType] =
    useState<(typeof SNAPSHOT_TYPES)[number]>('full_snapshot');
  const [activeTab, setActiveTab] = useState<TabType>('reviews');
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedConflictId, setSelectedConflictId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    reviewStatus: '',
    reviewResult: '',
    objectType: '',
    conflictStatus: '',
    conflictCategory: '',
  });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [reviewsRes, conflictsRes, snapshotsRes, confidenceRes] = await Promise.all([
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/reviews`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/conflicts`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/snapshots`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/confidence`),
      ]);
      const reviewsPayload = await reviewsRes.json();
      const conflictsPayload = await conflictsRes.json();
      const snapshotsPayload = await snapshotsRes.json();
      const confidencePayload = await confidenceRes.json();
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
      setConfidenceRows(
        confidencePayload.success && Array.isArray(confidencePayload.data)
          ? confidencePayload.data
          : []
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载复核工作台失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId, versionId]);

  const stats = useMemo(() => {
    const pendingCount = reviewRows.filter((r) => r.reviewStatus === 'pending').length;
    const approvedCount = reviewRows.filter((r) => r.reviewResult === 'approved').length;
    const rejectedCount = reviewRows.filter((r) => r.reviewResult === 'rejected').length;
    const todayAdded = reviewRows.filter((r) => {
      const today = new Date().toDateString();
      return new Date(r.operationTime).toDateString() === today;
    }).length;
    const closedConflicts = conflictRows.filter((c) => c.status === 'resolved').length;
    const pendingConflicts = conflictRows.filter((c) => c.status !== 'resolved').length;
    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      todayAdded,
      closedConflicts,
      pendingConflicts,
    };
  }, [reviewRows, conflictRows]);

  const filteredReviews = useMemo(() => {
    let result = reviewRows;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((r) =>
        `${r.reviewTaskId} ${r.type} ${r.content || ''}`.toLowerCase().includes(kw)
      );
    }
    if (filters.reviewStatus)
      result = result.filter((r) => r.reviewStatus === filters.reviewStatus);
    if (filters.reviewResult)
      result = result.filter((r) => r.reviewResult === filters.reviewResult);
    if (filters.objectType) result = result.filter((r) => r.objectType === filters.objectType);
    return result;
  }, [reviewRows, keyword, filters]);

  const filteredConflicts = useMemo(() => {
    let result = conflictRows;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((c) =>
        `${c.title} ${c.category} ${c.detail || ''}`.toLowerCase().includes(kw)
      );
    }
    if (filters.conflictStatus) result = result.filter((c) => c.status === filters.conflictStatus);
    if (filters.conflictCategory)
      result = result.filter((c) => c.category === filters.conflictCategory);
    return result;
  }, [conflictRows, keyword, filters]);

  const selectedReview = useMemo(() => {
    if (!selectedReviewId) return null;
    return reviewRows.find((r) => r.reviewTaskId === selectedReviewId) ?? null;
  }, [reviewRows, selectedReviewId]);

  const selectedConflict = useMemo(() => {
    if (selectedConflictId === null) return null;
    return conflictRows.find((c) => c.conflictId === selectedConflictId) ?? null;
  }, [conflictRows, selectedConflictId]);

  const handleConfirmObject = async (reviewTaskId: string) => {
    const key = `confirm_object-${reviewTaskId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(`/api/tender-center/reviews/${reviewTaskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved' }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '确认失败');
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleModifyAndConfirm = async (reviewTaskId: string) => {
    const key = `modify_and_confirm-${reviewTaskId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(`/api/tender-center/reviews/${reviewTaskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'modified' }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '修改后确认失败');
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改后确认失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleRejectObject = async (reviewTaskId: string) => {
    const key = `reject_object-${reviewTaskId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(`/api/tender-center/reviews/${reviewTaskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'rejected' }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '驳回失败');
    } catch (err) {
      setError(err instanceof Error ? err.message : '驳回失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleReassignReview = async (reviewTaskId: string) => {
    const key = `reassign_review-${reviewTaskId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(`/api/tender-center/reviews/${reviewTaskId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: '重新分派' }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '重新分派失败');
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新分派失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleResolveConflict = async (conflictId: number) => {
    const key = `resolve_conflict-${conflictId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(`/api/tender-center/conflicts/conflict-${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionType: 'manual_override', note: '复核页定案' }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '冲突定案失败');
      setConflictRows((prev) =>
        prev.map((c) => (c.conflictId === conflictId ? { ...c, reviewStatus: 'resolved' } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '冲突定案失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleRollbackResolution = async (conflictId: number) => {
    const key = `rollback_resolution-${conflictId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(`/api/tender-center/conflicts/conflict-${conflictId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '回退定案失败');
      setConflictRows((prev) =>
        prev.map((c) => (c.conflictId === conflictId ? { ...c, reviewStatus: 'reviewing' } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '回退定案失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

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

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'reviews', label: '复核任务', count: filteredReviews.length },
    { key: 'conflicts', label: '冲突处理', count: filteredConflicts.length },
    { key: 'confidence', label: '置信度', count: confidenceRows.length },
    { key: 'snapshots', label: '快照中心', count: snapshotRows.length },
  ];

  const renderDetailPanel = () => {
    if (activeTab === 'reviews' && selectedReview) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">复核详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">复核任务ID</Label>
              <p className="font-medium">{selectedReview.reviewTaskId}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">对象类型</Label>
                <p>{selectedReview.objectType ?? '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">对象ID</Label>
                <p>{selectedReview.objectId ?? '-'}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">复核原因</Label>
              <p>{selectedReview.reason ?? selectedReview.type}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">原始值</Label>
              <p className="p-2 bg-muted rounded text-xs">{selectedReview.originalValue ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">AI识别值</Label>
              <p className="p-2 bg-muted rounded text-xs">{selectedReview.aiValue ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">建议值</Label>
              <p className="p-2 bg-muted rounded text-xs">{selectedReview.suggestedValue ?? '-'}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">状态</Label>
                <Badge
                  variant={selectedReview.reviewStatus === 'confirmed' ? 'default' : 'secondary'}
                >
                  {selectedReview.reviewStatus}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">结果</Label>
                <Badge
                  variant={selectedReview.reviewResult === 'approved' ? 'default' : 'secondary'}
                >
                  {selectedReview.reviewResult ?? '-'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`confirm_object-${selectedReview.reviewTaskId}`]}
                onClick={() => handleConfirmObject(selectedReview.reviewTaskId)}
              >
                确认 (confirm_object)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`modify_and_confirm-${selectedReview.reviewTaskId}`]}
                onClick={() => handleModifyAndConfirm(selectedReview.reviewTaskId)}
              >
                修改后确认 (modify_and_confirm)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`reject_object-${selectedReview.reviewTaskId}`]}
                onClick={() => handleRejectObject(selectedReview.reviewTaskId)}
              >
                驳回 (reject_object)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`reassign_review-${selectedReview.reviewTaskId}`]}
                onClick={() => handleReassignReview(selectedReview.reviewTaskId)}
              >
                重新分派 (reassign_review)
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedReviewId(null)}>
                关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (activeTab === 'conflicts' && selectedConflict) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">冲突详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">冲突标题</Label>
              <p className="font-medium">{selectedConflict.title}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">分类</Label>
                <p>{selectedConflict.category}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">状态</Label>
                <Badge variant={selectedConflict.status === 'resolved' ? 'default' : 'secondary'}>
                  {selectedConflict.status}
                </Badge>
              </div>
            </div>
            {selectedConflict.riskLevel && (
              <div>
                <Label className="text-muted-foreground">风险等级</Label>
                <Badge
                  variant={selectedConflict.riskLevel === 'high' ? 'destructive' : 'secondary'}
                >
                  {selectedConflict.riskLevel}
                </Badge>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">详情</Label>
              <p className="whitespace-pre-wrap">{selectedConflict.detail ?? '-'}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`resolve_conflict-${selectedConflict.conflictId}`]}
                onClick={() => handleResolveConflict(selectedConflict.conflictId)}
              >
                冲突定案 (resolve_conflict)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`rollback_resolution-${selectedConflict.conflictId}`]}
                onClick={() => handleRollbackResolution(selectedConflict.conflictId)}
              >
                回退定案 (rollback_resolution)
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedConflictId(null)}>
                关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="h-fit">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>点击左侧项查看详情</p>
        </CardContent>
      </Card>
    );
  };

  const confidenceLevelColors: Record<string, string> = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">复核与留痕</CardTitle>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                刷新
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="text-sm bg-muted px-3 py-1 rounded">
                待复核: <strong>{stats.pendingCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                已通过: <strong>{stats.approvedCount}</strong>
              </div>
              <div className="text-sm bg-destructive/10 text-destructive px-3 py-1 rounded">
                已驳回: <strong>{stats.rejectedCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                今日新增: <strong>{stats.todayAdded}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                冲突待定: <strong>{stats.pendingConflicts}</strong>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && <p className="text-sm text-muted-foreground">加载中...</p>}

            <div className="flex flex-wrap gap-2 items-center border-b pb-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="关键词搜索"
                className="max-w-[200px]"
              />
              {activeTab === 'reviews' && (
                <>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.reviewStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, reviewStatus: e.target.value }))}
                  >
                    <option value="">复核状态</option>
                    <option value="draft">draft</option>
                    <option value="pending">pending</option>
                    <option value="confirmed">confirmed</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.reviewResult}
                    onChange={(e) => setFilters((f) => ({ ...f, reviewResult: e.target.value }))}
                  >
                    <option value="">复核结果</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="needs_revision">needs_revision</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.objectType}
                    onChange={(e) => setFilters((f) => ({ ...f, objectType: e.target.value }))}
                  >
                    <option value="">对象类型</option>
                    <option value="requirement">requirement</option>
                    <option value="risk">risk</option>
                    <option value="conflict">conflict</option>
                    <option value="template">template</option>
                  </select>
                </>
              )}
              {activeTab === 'conflicts' && (
                <>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.conflictStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, conflictStatus: e.target.value }))}
                  >
                    <option value="">冲突状态</option>
                    <option value="pending">pending</option>
                    <option value="resolved">resolved</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.conflictCategory}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, conflictCategory: e.target.value }))
                    }
                  >
                    <option value="">冲突分类</option>
                    <option value="value_conflict">value_conflict</option>
                    <option value="requirement_conflict">requirement_conflict</option>
                  </select>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-1 border-b">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSelectedReviewId(null);
                    setSelectedConflictId(null);
                  }}
                  className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {activeTab === 'reviews' && (
              <div className="space-y-3">
                {filteredReviews.map((row) => (
                  <div
                    key={row.reviewLogId}
                    className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                      selectedReviewId === row.reviewTaskId
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/30'
                    }`}
                    onClick={() => setSelectedReviewId(row.reviewTaskId)}
                  >
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
                          onClick={(e) => {
                            e.stopPropagation();
                            void submitReview(row.reviewTaskId, decision);
                          }}
                        >
                          {decision}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
                {filteredReviews.length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无复核任务。</p>
                )}
              </div>
            )}

            {activeTab === 'conflicts' && (
              <div className="space-y-3">
                {filteredConflicts.map((row) => (
                  <div
                    key={row.conflictId}
                    className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                      selectedConflictId === row.conflictId
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/30'
                    }`}
                    onClick={() => setSelectedConflictId(row.conflictId)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          conflict-{row.conflictId} | {row.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          分类: {row.category} | 状态: {row.status}
                        </p>
                      </div>
                      <Badge variant={row.status === 'resolved' ? 'default' : 'secondary'}>
                        {row.status}
                      </Badge>
                    </div>
                    <p className="text-sm">{row.detail || '-'}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        void resolveConflict(row.conflictId);
                      }}
                    >
                      标记为已处理
                    </Button>
                  </div>
                ))}
                {filteredConflicts.length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无冲突数据。</p>
                )}
              </div>
            )}

            {activeTab === 'confidence' && (
              <div className="space-y-3">
                {confidenceRows.map((row) => (
                  <div key={row.batchId} className="rounded border p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">批次 {row.batchNo}</p>
                        <p className="text-xs text-muted-foreground">
                          文档批次ID: {row.documentParseBatchId}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${confidenceLevelColors[row.confidenceLevel] || 'bg-gray-100'}`}
                      >
                        {row.confidenceLevel} ({row.confidence}%)
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      抽取置信度: {row.extractionConfidence}% | 业务置信度: {row.businessConfidence}
                      %
                    </div>
                  </div>
                ))}
                {confidenceRows.length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无置信度数据</p>
                )}
              </div>
            )}

            {activeTab === 'snapshots' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    placeholder="快照名称（可选）"
                    className="max-w-xs"
                  />
                  <select
                    className="rounded border px-2 py-1 text-sm bg-background"
                    value={snapshotType}
                    onChange={(e) =>
                      setSnapshotType(e.target.value as (typeof SNAPSHOT_TYPES)[number])
                    }
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
                {snapshotRows.map((row, index) => {
                  const sid = row.snapshotId || '';
                  return (
                    <div key={`${sid}-${index}`} className="rounded border p-3 space-y-2">
                      <p className="text-sm font-medium">
                        {row.name || sid || `snapshot-${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        snapshotId: {sid || '-'} | 状态: {row.status || '-'} | 创建时间:{' '}
                        {row.createdAt || '-'}
                      </p>
                      <p className="text-sm">{row.note || '-'}</p>
                      {sid && (
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
                      )}
                    </div>
                  );
                })}
                {snapshotRows.length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无快照数据。</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">{renderDetailPanel()}</div>
    </div>
  );
}

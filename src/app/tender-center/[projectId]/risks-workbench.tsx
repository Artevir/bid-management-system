'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type RiskItem = {
  riskId: string;
  level: 'high' | 'medium' | 'low';
  type: string;
  title: string;
  detail: string;
  reviewStatus: string;
  resolutionStatus: string;
  resolutionNote: string | null;
  sourceRequirementId?: number | null;
  sourceSegmentId?: number | null;
  hitRuleId?: number | null;
  hitRuleName?: string | null;
};

type ConflictItem = {
  conflictId: number;
  conflictType: string;
  fieldName: string | null;
  candidateA: string | null;
  candidateB: string | null;
  conflictLevel: string;
  reviewStatus: string;
  finalResolution: string | null;
  sourceSegmentIdA?: number | null;
  sourceSegmentIdB?: number | null;
};

const RESOLUTION_OPTIONS = ['open', 'acknowledged', 'mitigated', 'closed', 'waived'];
const RISK_LEVELS = ['high', 'medium', 'low'];
const RISK_TYPES = ['compliance', 'technical', 'commercial', 'timeline', 'qualification', 'other'];
const CONFLICT_LEVELS = ['critical', 'major', 'minor'];

type TabType = 'risks' | 'conflicts';

type FilterState = {
  level: string;
  riskType: string;
  reviewStatus: string;
  resolutionStatus: string;
  conflictLevel: string;
};

export function RisksWorkbench({ projectId, versionId }: { projectId: string; versionId: string }) {
  const [riskRows, setRiskRows] = useState<RiskItem[]>([]);
  const [conflictRows, setConflictRows] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [resolutionMap, setResolutionMap] = useState<Record<string, string>>({});
  const [resolutionNoteMap, setResolutionNoteMap] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('risks');
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [selectedConflictId, setSelectedConflictId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    level: '',
    riskType: '',
    reviewStatus: '',
    resolutionStatus: '',
    conflictLevel: '',
  });

  const loadRows = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const [risksRes, conflictsRes] = await Promise.all([
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/risks`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/conflicts`),
      ]);
      const [risksPayload, conflictsPayload] = await Promise.all([
        risksRes.json(),
        conflictsRes.json(),
      ]);
      if (risksRes.ok && risksPayload.success) {
        const nextRows: RiskItem[] = Array.isArray(risksPayload.data) ? risksPayload.data : [];
        setRiskRows(nextRows);
        setResolutionMap((prev) => {
          const next = { ...prev };
          for (const item of nextRows) {
            next[item.riskId] = item.resolutionStatus || next[item.riskId] || 'open';
          }
          return next;
        });
        setResolutionNoteMap((prev) => {
          const next = { ...prev };
          for (const item of nextRows) {
            next[item.riskId] = item.resolutionNote ?? next[item.riskId] ?? '';
          }
          return next;
        });
      }
      if (conflictsRes.ok && conflictsPayload.success) {
        setConflictRows(Array.isArray(conflictsPayload.data) ? conflictsPayload.data : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId]);

  const stats = useMemo(() => {
    const riskCount = riskRows.length;
    const highRiskCount = riskRows.filter((r) => r.level === 'high').length;
    const criticalRiskCount = riskRows.filter(
      (r) => r.level === 'high' && r.resolutionStatus === 'open'
    ).length;
    const openRiskCount = riskRows.filter((r) => r.resolutionStatus === 'open').length;
    const conflictCount = conflictRows.length;
    const pendingConflictCount = conflictRows.filter((c) => c.reviewStatus !== 'resolved').length;
    return {
      riskCount,
      highRiskCount,
      criticalRiskCount,
      openRiskCount,
      conflictCount,
      pendingConflictCount,
    };
  }, [riskRows, conflictRows]);

  const filteredRisks = useMemo(() => {
    let result = riskRows;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((row) => {
        const text =
          `${row.title} ${row.detail} ${row.type} ${row.resolutionNote ?? ''}`.toLowerCase();
        return text.includes(kw);
      });
    }
    if (filters.level) result = result.filter((r) => r.level === filters.level);
    if (filters.riskType) result = result.filter((r) => r.type === filters.riskType);
    if (filters.reviewStatus)
      result = result.filter((r) => r.reviewStatus === filters.reviewStatus);
    if (filters.resolutionStatus)
      result = result.filter((r) => r.resolutionStatus === filters.resolutionStatus);
    return result;
  }, [riskRows, keyword, filters]);

  const filteredConflicts = useMemo(() => {
    let result = conflictRows;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((row) => {
        const text =
          `${row.conflictType || ''} ${row.fieldName || ''} ${row.candidateA || ''} ${row.candidateB || ''}`.toLowerCase();
        return text.includes(kw);
      });
    }
    if (filters.conflictLevel)
      result = result.filter((r) => r.conflictLevel === filters.conflictLevel);
    return result;
  }, [conflictRows, keyword, filters]);

  const selectedRisk = useMemo(() => {
    if (activeTab !== 'risks' || !selectedRiskId) return null;
    return riskRows.find((r) => r.riskId === selectedRiskId) ?? null;
  }, [riskRows, activeTab, selectedRiskId]);

  const selectedConflict = useMemo(() => {
    if (activeTab !== 'conflicts' || !selectedConflictId) return null;
    return conflictRows.find((c) => c.conflictId === selectedConflictId) ?? null;
  }, [conflictRows, activeTab, selectedConflictId]);

  const updateResolution = async (riskIdRaw: string, resolutionStatus: string) => {
    const numericId = Number(String(riskIdRaw).replace(/^risk-/, ''));
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setError(`非法 riskId: ${riskIdRaw}`);
      return;
    }
    setUpdatingId(riskIdRaw);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/risks/${numericId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolutionStatus }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '更新处置状态失败');
      }
      setResolutionMap((prev) => ({ ...prev, [riskIdRaw]: payload.data.resolutionStatus }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新处置状态失败');
    } finally {
      setUpdatingId(null);
    }
  };

  const saveResolutionNote = async (riskIdRaw: string) => {
    const numericId = Number(String(riskIdRaw).replace(/^risk-/, ''));
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setError(`非法 riskId: ${riskIdRaw}`);
      return;
    }
    const resolutionNote = (resolutionNoteMap[riskIdRaw] ?? '').trim() || null;
    setUpdatingId(riskIdRaw);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/risks/${numericId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolutionNote }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '保存处置说明失败');
      }
      setResolutionNoteMap((prev) => ({
        ...prev,
        [riskIdRaw]: payload.data.resolutionNote ?? '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存处置说明失败');
    } finally {
      setUpdatingId(null);
    }
  };

  const renderRiskItem = (row: RiskItem) => (
    <div
      key={row.riskId}
      className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
        selectedRiskId === row.riskId ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
      }`}
      onClick={() => setSelectedRiskId(row.riskId)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                row.level === 'high'
                  ? 'destructive'
                  : row.level === 'medium'
                    ? 'secondary'
                    : 'outline'
              }
            >
              {row.level}
            </Badge>
            <p className="font-medium">{row.title}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            类型：{row.type} | 来源要求：{row.sourceRequirementId ?? '-'} | 审阅：{row.reviewStatus}
          </p>
        </div>
        <div className="min-w-[180px] space-y-1">
          <Label htmlFor={`risk-resolution-${row.riskId}`} className="text-xs">
            处置状态
          </Label>
          <select
            id={`risk-resolution-${row.riskId}`}
            className="w-full rounded border px-2 py-1 text-sm bg-background"
            value={resolutionMap[row.riskId] || 'open'}
            disabled={updatingId === row.riskId}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => void updateResolution(row.riskId, e.target.value)}
          >
            {RESOLUTION_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap">{row.detail || '-'}</p>
    </div>
  );

  const renderConflictItem = (row: ConflictItem) => (
    <div
      key={row.conflictId}
      className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
        selectedConflictId === row.conflictId ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
      }`}
      onClick={() => setSelectedConflictId(row.conflictId)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                row.conflictLevel === 'critical'
                  ? 'destructive'
                  : row.conflictLevel === 'major'
                    ? 'secondary'
                    : 'outline'
              }
            >
              {row.conflictLevel}
            </Badge>
            <p className="font-medium">{row.conflictType}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            冲突字段：{row.fieldName ?? '-'} | 状态：{row.reviewStatus}
          </p>
        </div>
      </div>
      <div className="text-sm space-y-1">
        <p>候选A: {row.candidateA ?? '-'}</p>
        <p>候选B: {row.candidateB ?? '-'}</p>
      </div>
    </div>
  );

  const renderDetailPanel = () => {
    if (activeTab === 'risks' && selectedRisk) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">风险详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2">
              <Badge variant={selectedRisk.level === 'high' ? 'destructive' : 'secondary'}>
                {selectedRisk.level}
              </Badge>
              <Badge variant="outline">{selectedRisk.type}</Badge>
            </div>
            <div>
              <Label className="text-muted-foreground">风险标题</Label>
              <p className="font-medium">{selectedRisk.title}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">风险说明</Label>
              <p className="whitespace-pre-wrap">{selectedRisk.detail || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">来源要求ID</Label>
              <p>{selectedRisk.sourceRequirementId ?? '-'}</p>
            </div>
            {selectedRisk.hitRuleName && (
              <div>
                <Label className="text-muted-foreground">命中规则</Label>
                <p>{selectedRisk.hitRuleName}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">复核状态</Label>
              <p>{selectedRisk.reviewStatus}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">处置说明</Label>
              <Textarea
                className="min-h-[80px] text-sm"
                value={resolutionNoteMap[selectedRisk.riskId] ?? ''}
                disabled={updatingId === selectedRisk.riskId}
                onChange={(e) =>
                  setResolutionNoteMap((prev) => ({
                    ...prev,
                    [selectedRisk.riskId]: e.target.value,
                  }))
                }
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={updatingId === selectedRisk.riskId}
                onClick={() => void saveResolutionNote(selectedRisk.riskId)}
              >
                保存
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelectedRiskId(null)}>
              关闭
            </Button>
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
            <div className="flex gap-2">
              <Badge
                variant={
                  selectedConflict.conflictLevel === 'critical' ? 'destructive' : 'secondary'
                }
              >
                {selectedConflict.conflictLevel}
              </Badge>
              <Badge variant="outline">{selectedConflict.conflictType}</Badge>
            </div>
            <div>
              <Label className="text-muted-foreground">冲突字段</Label>
              <p>{selectedConflict.fieldName ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">候选值 A</Label>
              <p className="p-2 bg-muted rounded">{selectedConflict.candidateA ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">候选值 B</Label>
              <p className="p-2 bg-muted rounded">{selectedConflict.candidateB ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">当前状态</Label>
              <p>{selectedConflict.reviewStatus}</p>
            </div>
            {selectedConflict.finalResolution && (
              <div>
                <Label className="text-muted-foreground">最终结论</Label>
                <p>{selectedConflict.finalResolution}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">风险与冲突</CardTitle>
              <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
                刷新
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="text-sm bg-muted px-3 py-1 rounded">
                风险总数: <strong>{stats.riskCount}</strong>
              </div>
              <div className="text-sm bg-destructive/10 text-destructive px-3 py-1 rounded">
                高风险: <strong>{stats.highRiskCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                待关闭: <strong>{stats.openRiskCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                冲突: <strong>{stats.conflictCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                待定案: <strong>{stats.pendingConflictCount}</strong>
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
              {activeTab === 'risks' && (
                <>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.level}
                    onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}
                  >
                    <option value="">全部等级</option>
                    {RISK_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.riskType}
                    onChange={(e) => setFilters((f) => ({ ...f, riskType: e.target.value }))}
                  >
                    <option value="">全部类型</option>
                    {RISK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.reviewStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, reviewStatus: e.target.value }))}
                  >
                    <option value="">全部审阅状态</option>
                    <option value="pending">pending</option>
                    <option value="confirmed">confirmed</option>
                    <option value="rejected">rejected</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.resolutionStatus}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, resolutionStatus: e.target.value }))
                    }
                  >
                    <option value="">全部处置状态</option>
                    {RESOLUTION_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {activeTab === 'conflicts' && (
                <select
                  className="rounded border px-2 py-1 text-sm"
                  value={filters.conflictLevel}
                  onChange={(e) => setFilters((f) => ({ ...f, conflictLevel: e.target.value }))}
                >
                  <option value="">全部等级</option>
                  {CONFLICT_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap gap-1 border-b">
              <button
                onClick={() => {
                  setActiveTab('risks');
                  setSelectedRiskId(null);
                  setSelectedConflictId(null);
                }}
                className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                  activeTab === 'risks'
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                风险项 ({riskRows.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('conflicts');
                  setSelectedRiskId(null);
                  setSelectedConflictId(null);
                }}
                className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                  activeTab === 'conflicts'
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                冲突项 ({conflictRows.length})
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {activeTab === 'risks'
                ? `显示 ${filteredRisks.length} 条（总计 ${riskRows.length} 条）`
                : `显示 ${filteredConflicts.length} 条（总计 ${conflictRows.length} 条）`}
            </p>

            <div className="space-y-3">
              {activeTab === 'risks'
                ? filteredRisks.map(renderRiskItem)
                : filteredConflicts.map(renderConflictItem)}
              {!loading &&
                (activeTab === 'risks' ? filteredRisks : filteredConflicts).length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无数据</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">{renderDetailPanel()}</div>
    </div>
  );
}

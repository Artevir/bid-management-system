'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
};

const RESOLUTION_OPTIONS = ['open', 'acknowledged', 'mitigated', 'closed', 'waived'];

export function RisksWorkbench({ projectId, versionId }: { projectId: string; versionId: string }) {
  const [rows, setRows] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [resolutionMap, setResolutionMap] = useState<Record<string, string>>({});
  const [resolutionNoteMap, setResolutionNoteMap] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadRows = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/risks`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载风险失败');
      }
      const nextRows: RiskItem[] = Array.isArray(payload.data) ? payload.data : [];
      setRows(nextRows);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载风险失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId]);

  const filteredRows = useMemo(() => {
    if (!keyword.trim()) return rows;
    const kw = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const text =
        `${row.title} ${row.detail} ${row.type} ${row.resolutionNote ?? ''}`.toLowerCase();
      return text.includes(kw);
    });
  }, [rows, keyword]);

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
      setRows((prev) =>
        prev.map((r) =>
          r.riskId === riskIdRaw ? { ...r, resolutionNote: payload.data.resolutionNote ?? null } : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存处置说明失败');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>风险工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标题/详情/类型"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
        <p className="text-xs text-muted-foreground">
          共 {filteredRows.length} 条（原始 {rows.length} 条）
        </p>
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div key={row.riskId} className="rounded border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    风险等级：{row.level} | 风险类型：{row.type} | 来源要求：
                    {row.sourceRequirementId ?? '-'} | 审阅：{row.reviewStatus}
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
              <div className="space-y-1">
                <Label htmlFor={`risk-resolution-note-${row.riskId}`} className="text-xs">
                  处置说明（resolution_note）
                </Label>
                <Textarea
                  id={`risk-resolution-note-${row.riskId}`}
                  className="min-h-[72px] text-sm"
                  value={resolutionNoteMap[row.riskId] ?? ''}
                  disabled={updatingId === row.riskId}
                  onChange={(e) =>
                    setResolutionNoteMap((prev) => ({ ...prev, [row.riskId]: e.target.value }))
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={updatingId === row.riskId}
                  onClick={() => void saveResolutionNote(row.riskId)}
                >
                  保存处置说明
                </Button>
              </div>
            </div>
          ))}
          {!loading && filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无风险数据。</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

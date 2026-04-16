'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ConflictItem = {
  conflictId: number;
  conflictType: string;
  fieldName: string | null;
  candidateA: string | null;
  candidateB: string | null;
  conflictLevel: string;
  reviewStatus: string;
  finalResolution: string | null;
};

export function ConflictsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [rows, setRows] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  const loadRows = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/conflicts`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载冲突项失败');
      }
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载冲突项失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId]);

  const filteredRows = keyword.trim()
    ? rows.filter((row) =>
        `${row.conflictType || ''} ${row.fieldName || ''} ${row.candidateA || ''} ${row.candidateB || ''}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      )
    : rows;

  const resolvedCount = filteredRows.filter((r) => r.reviewStatus === 'resolved').length;
  const pendingCount = filteredRows.filter((r) => r.reviewStatus !== 'resolved').length;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>冲突项工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索冲突类型/字段/候选值"
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

        <div className="flex flex-wrap gap-4 text-sm">
          <span>待处理：{pendingCount}</span>
          <span>已解决：{resolvedCount}</span>
          <span>总计：{filteredRows.length}</span>
        </div>

        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div key={row.conflictId} className="rounded border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">冲突 #{row.conflictId}</p>
                  <p className="text-xs text-muted-foreground">
                    类型：{row.conflictType} | 字段：{row.fieldName ?? '-'} | 级别：
                    {row.conflictLevel}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${row.reviewStatus === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                >
                  {row.reviewStatus}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-red-50 rounded">
                  <p className="text-xs text-red-600">候选A</p>
                  <p className="truncate">{row.candidateA || '-'}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded">
                  <p className="text-xs text-blue-600">候选B</p>
                  <p className="truncate">{row.candidateB || '-'}</p>
                </div>
              </div>
              {row.finalResolution && (
                <p className="text-sm text-green-600">解决：{row.finalResolution}</p>
              )}
            </div>
          ))}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无冲突数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

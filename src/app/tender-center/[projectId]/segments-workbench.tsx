'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type SourceSegment = {
  id: number;
  segmentType: string;
  sectionPath: string | null;
  rawText: string | null;
  normalizedText: string | null;
  isHeading: boolean;
  headingLevel: number | null;
  documentPageId: number | null;
};

export function SegmentsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [rows, setRows] = useState<SourceSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const loadRows = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/segments?pageNo=${page}&pageSize=${pageSize}`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载原文分段失败');
      }
      setRows(Array.isArray(payload.data?.items) ? payload.data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载原文分段失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId, page]);

  const filteredRows = keyword.trim()
    ? rows.filter((row) =>
        `${row.rawText || ''} ${row.sectionPath || ''} ${row.segmentType || ''}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      )
    : rows;

  const headingCount = filteredRows.filter((r) => r.isHeading).length;
  const paragraphCount = filteredRows.filter((r) => !r.isHeading).length;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>原文分片工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索分段内容/路径/类型"
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
          <span>标题：{headingCount}</span>
          <span>段落：{paragraphCount}</span>
          <span>总计：{filteredRows.length}</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <span className="flex items-center text-sm">第 {page} 页</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={filteredRows.length < pageSize}
          >
            下一页
          </Button>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {filteredRows.map((row) => (
            <div
              key={row.id}
              className={`rounded border p-3 space-y-1 ${row.isHeading ? 'bg-amber-50 border-amber-200' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {row.isHeading && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                    H{row.headingLevel || 0}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  类型: {row.segmentType} | ID: {row.id} | 页: {row.documentPageId ?? '-'}
                </span>
                {row.sectionPath && (
                  <span className="text-xs text-muted-foreground ml-auto">{row.sectionPath}</span>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">
                {row.rawText?.substring(0, 200) || '-'}
                {row.rawText && row.rawText.length > 200 ? '...' : ''}
              </p>
            </div>
          ))}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无原文分段数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

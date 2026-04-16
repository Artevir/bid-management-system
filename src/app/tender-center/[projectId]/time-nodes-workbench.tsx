'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type TimeNode = {
  id: number;
  nodeType: string;
  nodeName: string | null;
  timeText: string | null;
  timeValue: string | null;
  locationText: string | null;
  confidenceScore: string | null;
  reviewStatus: string;
};

export function TimeNodesWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [rows, setRows] = useState<TimeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  const loadRows = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/time-nodes`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载时间节点失败');
      }
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载时间节点失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId]);

  const filteredRows = keyword.trim()
    ? rows.filter((row) =>
        `${row.nodeName || ''} ${row.nodeType || ''} ${row.timeText || ''}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      )
    : rows;

  const nodeTypes = [...new Set(rows.map((r) => r.nodeType))];

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>时间节点工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索节点名称/类型/时间"
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

        <div className="flex flex-wrap gap-2 text-xs">
          {nodeTypes.map((type) => (
            <span key={type} className="px-2 py-1 bg-muted rounded">
              {type}: {rows.filter((r) => r.nodeType === type).length}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">共 {filteredRows.length} 个时间节点</p>
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div key={row.id} className="rounded border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.nodeName || `时间节点 #${row.id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    类型：{row.nodeType} | 审阅：{row.reviewStatus} | 置信度：
                    {row.confidenceScore ?? '-'}
                  </p>
                </div>
                {row.timeValue && (
                  <span className="text-sm font-medium text-blue-600">
                    {new Date(row.timeValue).toLocaleString('zh-CN')}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                时间文本：{row.timeText || '-'} | 地点：{row.locationText ?? '-'}
              </p>
            </div>
          ))}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无时间节点数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

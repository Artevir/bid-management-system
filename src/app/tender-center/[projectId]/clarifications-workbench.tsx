'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ClarificationCandidate = {
  id: number;
  questionTitle: string | null;
  questionContent: string | null;
  questionReason: string | null;
  urgencyLevel: string;
  reviewStatus: string;
};

export function ClarificationsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [rows, setRows] = useState<ClarificationCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  const loadRows = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/clarifications`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载澄清候选失败');
      }
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载澄清候选失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId]);

  const filteredRows = keyword.trim()
    ? rows.filter((row) =>
        `${row.questionTitle || ''} ${row.questionContent || ''}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      )
    : rows;

  const urgencyMap: Record<string, string> = {
    urgent: '紧急',
    high: '高',
    normal: '普通',
    low: '低',
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>澄清候选工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索问题标题/内容"
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

        <p className="text-xs text-muted-foreground">共 {filteredRows.length} 条澄清候选</p>

        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div key={row.id} className="rounded border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.questionTitle || `澄清候选 #${row.id}`}</p>
                  <p className="text-xs text-muted-foreground">审阅状态：{row.reviewStatus}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    row.urgencyLevel === 'urgent'
                      ? 'bg-red-100 text-red-800'
                      : row.urgencyLevel === 'high'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {urgencyMap[row.urgencyLevel] || row.urgencyLevel}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{row.questionContent || '-'}</p>
              {row.questionReason && (
                <p className="text-xs text-amber-600">生成原因：{row.questionReason}</p>
              )}
            </div>
          ))}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无澄清候选数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

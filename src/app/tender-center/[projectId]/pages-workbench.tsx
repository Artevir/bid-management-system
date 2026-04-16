'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type PageData = {
  pageNumber: number;
  segmentCount: number;
};

export function PagesWorkbench({ projectId, versionId }: { projectId: string; versionId: string }) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPages = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/pages`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载页码数据失败');
      }
      setPages(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载页码数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPages();
  }, [projectId, versionId]);

  const totalSegments = pages.reduce((sum, p) => sum + p.segmentCount, 0);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>页码管理</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadPages()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}

        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">总页数</Badge>
            <span className="font-medium">{pages.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">总分段数</Badge>
            <span className="font-medium">{totalSegments}</span>
          </div>
        </div>

        <div className="space-y-2">
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无页码数据</p>
          ) : (
            pages.map((page) => (
              <div
                key={page.pageNumber}
                className="rounded border p-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">第 {page.pageNumber} 页</p>
                  <p className="text-xs text-muted-foreground">包含 {page.segmentCount} 个分片</p>
                </div>
                <Badge variant="secondary">{page.segmentCount} 分片</Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

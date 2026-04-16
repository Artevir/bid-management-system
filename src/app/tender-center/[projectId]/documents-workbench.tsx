'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type SourceDocument = {
  id: number;
  fileName: string;
  fileExt: string | null;
  fileSize: number | null;
  pageCount: number | null;
  docCategory: string;
  parseStatus: string;
  textExtractStatus: string;
  structureExtractStatus: string;
  createdAt: string;
};

type ParseBatch = {
  id: number;
  batchNo: string;
  triggerSource: string;
  modelProfile: string | null;
  batchStatus: string;
  parseStartedAt: string | null;
  parseFinishedAt: string | null;
  createdAt: string;
};

type HubData = {
  documents: SourceDocument[];
  batches: ParseBatch[];
};

export function DocumentsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [data, setData] = useState<HubData>({ documents: [], batches: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/documents`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载文档数据失败');
      }
      setData(payload.data || { documents: [], batches: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文档数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId, versionId]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      not_started: 'secondary',
      in_progress: 'default',
      completed: 'outline',
      failed: 'destructive',
      parsed: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>文档与批次管理</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}

        <div className="space-y-3">
          <h3 className="text-sm font-medium">原始文件 ({data.documents.length})</h3>
          {data.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无原始文件</p>
          ) : (
            <div className="space-y-2">
              {data.documents.map((doc) => (
                <div key={doc.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        扩展名: {doc.fileExt || '-'} | 大小: {formatFileSize(doc.fileSize)} | 页数:{' '}
                        {doc.pageCount ?? '-'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(doc.parseStatus)}
                      <span className="text-xs text-muted-foreground">{doc.docCategory}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">解析批次 ({data.batches.length})</h3>
          {data.batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无解析批次</p>
          ) : (
            <div className="space-y-2">
              {data.batches.map((batch) => (
                <div key={batch.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">批次 #{batch.batchNo}</p>
                      <p className="text-xs text-muted-foreground">
                        触发源: {batch.triggerSource} | 模型: {batch.modelProfile || '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        开始:{' '}
                        {batch.parseStartedAt
                          ? new Date(batch.parseStartedAt).toLocaleString()
                          : '-'}{' '}
                        | 结束:{' '}
                        {batch.parseFinishedAt
                          ? new Date(batch.parseFinishedAt).toLocaleString()
                          : '-'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(batch.batchStatus)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

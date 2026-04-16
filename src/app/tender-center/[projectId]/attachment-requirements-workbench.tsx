'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type AttachmentRequirement = {
  attachmentNodeId: number;
  attachmentName: string;
  attachmentNo: string | null;
  attachmentType: string;
  requiredType: string;
  sourceDocumentId: number | null;
  sourceSegmentId: number | null;
};

export function AttachmentRequirementsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [attachments, setAttachments] = useState<AttachmentRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAttachments = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/attachment-requirements`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载附件要求失败');
      }
      setAttachments(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载附件要求数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAttachments();
  }, [projectId, versionId]);

  const getTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      form: 'default',
      drawing: 'secondary',
      document: 'outline',
      other: 'outline',
    };
    return <Badge variant={variants[type] || 'outline'}>{type}</Badge>;
  };

  const getRequiredBadge = (required: string) => {
    const variants: Record<string, 'destructive' | 'secondary' | 'outline'> = {
      required: 'destructive',
      optional: 'secondary',
    };
    return <Badge variant={variants[required] || 'outline'}>{required}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>附件要求工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadAttachments()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
        <p className="text-xs text-muted-foreground">共 {attachments.length} 个附件要求</p>
        <div className="space-y-3">
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无附件要求数据</p>
          ) : (
            attachments.map((att) => (
              <div key={att.attachmentNodeId} className="rounded border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{att.attachmentName}</p>
                    <p className="text-xs text-muted-foreground">
                      编号：{att.attachmentNo || '-'} | 来源文档：{att.sourceDocumentId ?? '-'} |
                      来源段落：{att.sourceSegmentId ?? '-'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getTypeBadge(att.attachmentType)}
                    {getRequiredBadge(att.requiredType)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

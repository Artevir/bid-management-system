'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type HubTemplate = {
  templateId: number;
  name: string | null;
  category: string | null;
  sourceNodeId: number | null;
  pageNumber: number | null;
};

export function TemplatesWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [templates, setTemplates] = useState<HubTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  const loadTemplates = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/templates`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载模板失败');
      }
      setTemplates(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载模板数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, [projectId, versionId]);

  const filteredTemplates = keyword.trim()
    ? templates.filter((t) =>
        `${t.name || ''} ${t.category || ''}`.toLowerCase().includes(keyword.trim().toLowerCase())
      )
    : templates;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>模板工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索模板名称/类别"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => void loadTemplates()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
        <p className="text-xs text-muted-foreground">共 {filteredTemplates.length} 个模板</p>
        <div className="space-y-3">
          {filteredTemplates.map((tpl) => (
            <div key={tpl.templateId} className="rounded border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{tpl.name || `模板 #${tpl.templateId}`}</p>
                  <p className="text-xs text-muted-foreground">
                    类别：{tpl.category || 'other_template'} | 来源段落：{tpl.sourceNodeId ?? '-'} |
                    页码：{tpl.pageNumber ?? '-'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {filteredTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无模板数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

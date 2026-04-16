'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type OverviewData = {
  projectId: number;
  versionId: number;
  status: string;
  parseProgress: number;
  extractAccuracy: number;
  metrics: {
    requirements: number;
    frameworkNodes: number;
    scoringItems: number;
    technicalItems: number;
    risks: number;
  };
};

export function OverviewWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOverview = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/overview`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载概览数据失败');
      }
      setData(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载概览数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, [projectId, versionId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground">暂无数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>项目概览</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded border p-4 text-center">
            <p className="text-2xl font-bold">{data.metrics.requirements}</p>
            <p className="text-xs text-muted-foreground">招标要求</p>
          </div>
          <div className="rounded border p-4 text-center">
            <p className="text-2xl font-bold">{data.metrics.frameworkNodes}</p>
            <p className="text-xs text-muted-foreground">框架节点</p>
          </div>
          <div className="rounded border p-4 text-center">
            <p className="text-2xl font-bold">{data.metrics.scoringItems}</p>
            <p className="text-xs text-muted-foreground">评分项</p>
          </div>
          <div className="rounded border p-4 text-center">
            <p className="text-2xl font-bold">{data.metrics.technicalItems}</p>
            <p className="text-xs text-muted-foreground">技术项</p>
          </div>
        </div>

        <div className="rounded border p-4">
          <h3 className="font-medium mb-2">风险统计</h3>
          <div className="flex items-center gap-2">
            <Badge variant="destructive">{data.metrics.risks}</Badge>
            <span className="text-sm text-muted-foreground">个风险项待处理</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>
            项目ID: {data.projectId} | 版本ID: {data.versionId}
          </p>
          <p>状态: {data.status || '未设置'}</p>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RequirementsWorkbench } from './requirements-workbench';
import { RisksWorkbench } from './risks-workbench';
import { ReviewWorkbench } from './review-workbench';

const moduleMap: Record<string, { title: string; endpoint: string; desc: string }> = {
  overview: { title: '概览', endpoint: 'overview', desc: '项目版本总览与指标统计' },
  requirements: { title: '要求', endpoint: 'requirements', desc: '招标要求主数据' },
  risks: { title: '风险', endpoint: 'risks', desc: '风险识别与处置状态' },
  scoring: { title: '评分', endpoint: 'scoring-schemes', desc: '评分方案与评分项' },
  technical: { title: '技术', endpoint: 'technical-groups', desc: '技术规格组与技术条目' },
  framework: { title: '框架', endpoint: 'framework', desc: '框架节点与绑定关系' },
  templates: { title: '模板', endpoint: 'templates', desc: '模板、变量与表格结构' },
  materials: { title: '材料', endpoint: 'materials', desc: '递交材料与响应任务' },
  review: { title: '复核', endpoint: 'reviews', desc: '复核任务与确认结果' },
};

export function TenderCenterHubModuleView({
  projectId,
  module,
}: {
  projectId: string;
  module: string;
}) {
  const searchParams = useSearchParams();
  const versionId = searchParams.get('versionId') || '';
  const config = moduleMap[module] ?? null;

  const navList = useMemo(
    () => Object.entries(moduleMap).map(([key, item]) => ({ key, title: item.title })),
    []
  );

  if (!config) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>未定义的模块</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">当前模块不在 000 文档主链路清单中。</p>
            <Link className="text-primary underline" href="/tender-center">
              返回中枢首页
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const apiUrl = versionId
    ? `/api/tender-center/projects/${projectId}/versions/${versionId}/${config.endpoint}`
    : '';

  const renderWorkbench = () => {
    if (!versionId) return null;
    if (module === 'requirements') {
      return <RequirementsWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'risks') {
      return <RisksWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'review') {
      return <ReviewWorkbench projectId={projectId} versionId={versionId} />;
    }
    return null;
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {navList.map((item) => (
          <Link
            key={item.key}
            href={`/tender-center/${projectId}/${item.key}?versionId=${versionId}`}
          >
            <Badge variant={item.key === module ? 'default' : 'secondary'}>{item.title}</Badge>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {config.title}模块（项目 {projectId} / 版本 {versionId || '未选择'}）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{config.desc}</p>
          {versionId ? (
            <p className="text-sm">
              对应接口：<code>{apiUrl}</code>
            </p>
          ) : (
            <p className="text-sm text-amber-600">
              请在 URL 中带上 `?versionId=xxx` 以加载版本数据。
            </p>
          )}
        </CardContent>
      </Card>

      {renderWorkbench()}
    </div>
  );
}

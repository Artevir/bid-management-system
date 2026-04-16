'use client';

import { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RequirementsWorkbench } from './requirements-workbench';
import { RisksWorkbench } from './risks-workbench';
import { ReviewWorkbench } from './review-workbench';
import { ScoringWorkbench } from './scoring-workbench';
import { TechnicalWorkbench } from './technical-workbench';
import { FrameworkWorkbench } from './framework-workbench';
import { TemplatesWorkbench } from './templates-workbench';
import { MaterialsWorkbench } from './materials-workbench';
import { TimeNodesWorkbench } from './time-nodes-workbench';
import { MoneyTermsWorkbench } from './money-terms-workbench';
import { SegmentsWorkbench } from './segments-workbench';
import { SectionsWorkbench } from './sections-workbench';
import { DocumentsWorkbench } from './documents-workbench';
import { PagesWorkbench } from './pages-workbench';
import { OverviewWorkbench } from './overview-workbench';
import { ConflictsWorkbench } from './conflicts-workbench';
import { ClarificationsWorkbench } from './clarifications-workbench';
import { RulesWorkbench } from './rules-workbench';
import { AttachmentRequirementsWorkbench } from './attachment-requirements-workbench';

type ProjectContext = {
  projectId: number;
  projectName: string;
  projectCode: string;
  versionId: number;
  versionLabel: string;
  parseStatus: string;
  reviewStatus: string;
  requirementCount: number;
  riskCount: number;
  conflictCount: number;
  pendingReviewCount: number;
  criticalRiskCount: number;
};

const moduleMap: Record<string, { title: string; endpoint: string; desc: string }> = {
  overview: { title: '概览', endpoint: 'overview', desc: '项目版本总览与指标统计' },
  documents: { title: '文档', endpoint: 'documents', desc: '原始文件与解析批次' },
  pages: { title: '页码', endpoint: 'pages', desc: '页级对象与元信息' },
  segments: { title: '分段', endpoint: 'segments', desc: '原文分片与溯源锚点' },
  sections: { title: '章节', endpoint: 'sections', desc: '正文章节树结构' },
  attachments: { title: '附件', endpoint: 'attachment-requirements', desc: '附件要求与表单' },
  requirements: { title: '要求', endpoint: 'requirements', desc: '招标要求主数据' },
  timeNodes: { title: '时间', endpoint: 'time-nodes', desc: '关键时间节点' },
  moneyTerms: { title: '金额', endpoint: 'money-terms', desc: '金额条款与费用' },
  conflicts: { title: '冲突', endpoint: 'conflicts', desc: '冲突检测与处理' },
  clarifications: { title: '澄清', endpoint: 'clarifications', desc: '澄清候选问题' },
  risks: { title: '风险', endpoint: 'risks', desc: '风险识别与处置状态' },
  rules: { title: '规则', endpoint: 'rule-definitions', desc: '规则定义与配置' },
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
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);

  const navList = useMemo(
    () => Object.entries(moduleMap).map(([key, item]) => ({ key, title: item.title })),
    []
  );

  useEffect(() => {
    if (!projectId) return;
    setLoadingProject(true);
    fetch(`/api/tender-center/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setProjectContext(data.data);
        }
      })
      .finally(() => setLoadingProject(false));
  }, [projectId]);

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
    if (module === 'overview') {
      return <OverviewWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'documents') {
      return <DocumentsWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'pages') {
      return <PagesWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'segments') {
      return <SegmentsWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'sections') {
      return <SectionsWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'attachments') {
      return <AttachmentRequirementsWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'requirements') {
      return <RequirementsWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'timeNodes') {
      return <TimeNodesWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'moneyTerms') {
      return <MoneyTermsWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'conflicts') {
      return <ConflictsWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'clarifications') {
      return <ClarificationsWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'risks') {
      return <RisksWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'rules') {
      return <RulesWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'review') {
      return <ReviewWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'scoring') {
      return <ScoringWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'technical') {
      return <TechnicalWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'framework') {
      return <FrameworkWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'templates') {
      return <TemplatesWorkbench projectId={projectId} versionId={versionId} />;
    }
    if (module === 'materials') {
      return <MaterialsWorkbench projectId={projectId} versionId={versionId} />;
    }
    return null;
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      {projectContext && (
        <Card className="bg-muted/50">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <span className="font-medium">{projectContext.projectName || '未命名项目'}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    ({projectContext.projectCode || '无编码'})
                  </span>
                </div>
                <Badge variant="outline">v{versionId || '?'}</Badge>
                <Badge
                  variant={projectContext.parseStatus === 'completed' ? 'default' : 'secondary'}
                >
                  解析: {projectContext.parseStatus || 'pending'}
                </Badge>
                <Badge
                  variant={projectContext.reviewStatus === 'confirmed' ? 'default' : 'outline'}
                >
                  复核: {projectContext.reviewStatus || 'pending'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>要求: {projectContext.requirementCount || 0}</span>
                <span>风险: {projectContext.riskCount || 0}</span>
                <span>冲突: {projectContext.conflictCount || 0}</span>
                <span>待复核: {projectContext.pendingReviewCount || 0}</span>
                {projectContext.criticalRiskCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    高风险: {projectContext.criticalRiskCount}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

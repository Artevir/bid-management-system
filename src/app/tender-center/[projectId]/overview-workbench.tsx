'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ProjectOverview = {
  projectId: number;
  versionId: number;
  projectName: string;
  projectCode: string | null;
  tendererName: string | null;
  tenderAgentName: string | null;
  parseStatus: string;
  reviewStatus: string;
  assetStatus: string;
  requirementCount: number;
  riskCount: number;
  conflictCount: number;
  scoringItemCount: number;
  technicalSpecCount: number;
  frameworkNodeCount: number;
  templateCount: number;
  materialCount: number;
  pendingReviewCount: number;
  criticalRiskCount: number;
};

type RiskItem = {
  id: number;
  riskType: string;
  riskTitle: string;
  riskDescription: string;
  riskLevel: string;
  reviewStatus: string;
};

type ConflictItem = {
  id: number;
  conflictType: string;
  fieldName: string;
  candidateA: string | null;
  candidateB: string | null;
  conflictLevel: string;
  reviewStatus: string;
};

type TimeNode = {
  id: number;
  nodeType: string;
  nodeName: string;
  timeText: string;
  timeValue: string | null;
};

type MoneyTerm = {
  id: number;
  moneyType: string;
  amountText: string;
  amountValue: string | null;
};

type OverviewData = {
  project: ProjectOverview;
  topRisks: RiskItem[];
  topConflicts: ConflictItem[];
  pendingReviews: number;
  keyTimeNodes: TimeNode[];
  keyMoneyTerms: MoneyTerm[];
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

  const { project, topRisks, topConflicts, pendingReviews, keyTimeNodes, keyMoneyTerms } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>项目头部总览区 (A1)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">项目名称</p>
            <p className="font-medium">{project.projectName || '-'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">项目编号</p>
            <p className="font-medium">{project.projectCode || '-'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">招标人</p>
            <p className="font-medium">{project.tendererName || '-'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">代理机构</p>
            <p className="font-medium">{project.tenderAgentName || '-'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">当前版本</p>
            <p className="font-medium">v{project.versionId}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">解析状态</p>
            <Badge variant={project.parseStatus === 'completed' ? 'default' : 'secondary'}>
              {project.parseStatus || 'pending'}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">复核状态</p>
            <Badge variant={project.reviewStatus === 'confirmed' ? 'default' : 'outline'}>
              {project.reviewStatus || 'pending'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>核心指标卡区 (B1)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded border p-4 text-center">
              <p className="text-2xl font-bold">{project.requirementCount}</p>
              <p className="text-xs text-muted-foreground">要求总数</p>
            </div>
            <div className="rounded border p-4 text-center">
              <p className="text-2xl font-bold">{project.riskCount}</p>
              <p className="text-xs text-muted-foreground">风险总数</p>
            </div>
            <div className="rounded border p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{project.criticalRiskCount}</p>
              <p className="text-xs text-muted-foreground">高风险数</p>
            </div>
            <div className="rounded border p-4 text-center">
              <p className="text-2xl font-bold">{project.conflictCount}</p>
              <p className="text-xs text-muted-foreground">冲突数</p>
            </div>
            <div className="rounded border p-4 text-center">
              <p className="text-2xl font-bold">{project.templateCount}</p>
              <p className="text-xs text-muted-foreground">模板数</p>
            </div>
            <div className="rounded border p-4 text-center">
              <p className="text-2xl font-bold">{project.materialCount}</p>
              <p className="text-xs text-muted-foreground">材料数</p>
            </div>
            <div className="rounded border p-4 text-center">
              <p className="text-2xl font-bold">{pendingReviews}</p>
              <p className="text-xs text-muted-foreground">待复核数</p>
            </div>
            <div className="rounded border p-4 text-center">
              <p className="text-2xl font-bold">{project.scoringItemCount}</p>
              <p className="text-xs text-muted-foreground">评分项</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {topRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>关键提醒区 (C1) - 最近高风险</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topRisks.slice(0, 3).map((risk) => (
              <div key={risk.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <p className="font-medium">{risk.riskTitle}</p>
                  <p className="text-sm text-muted-foreground">{risk.riskDescription}</p>
                </div>
                <Badge variant="destructive">{risk.riskLevel}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {topConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>关键提醒区 (C1) - 最近冲突</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topConflicts.slice(0, 3).map((conflict) => (
              <div
                key={conflict.id}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div>
                  <p className="font-medium">{conflict.fieldName}</p>
                  <p className="text-sm text-muted-foreground">
                    {conflict.candidateA} vs {conflict.candidateB}
                  </p>
                </div>
                <Badge variant="outline">{conflict.conflictLevel}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>快速导航区 (D1)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href={`/tender-center/${projectId}/scoring?versionId=${versionId}`}>
            <Button variant="outline" size="sm">
              评分办法
            </Button>
          </Link>
          <Link href={`/tender-center/${projectId}/technical?versionId=${versionId}`}>
            <Button variant="outline" size="sm">
              技术参数
            </Button>
          </Link>
          <Link href={`/tender-center/${projectId}/framework?versionId=${versionId}`}>
            <Button variant="outline" size="sm">
              框架
            </Button>
          </Link>
          <Link href={`/tender-center/${projectId}/templates?versionId=${versionId}`}>
            <Button variant="outline" size="sm">
              模板
            </Button>
          </Link>
          <Link href={`/tender-center/${projectId}/materials?versionId=${versionId}`}>
            <Button variant="outline" size="sm">
              材料
            </Button>
          </Link>
          <Link href={`/tender-center/${projectId}/review?versionId=${versionId}`}>
            <Button variant="outline" size="sm">
              复核
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>关键时间节点</CardTitle>
          </CardHeader>
          <CardContent>
            {keyTimeNodes.length > 0 ? (
              <ul className="space-y-2">
                {keyTimeNodes.slice(0, 5).map((node) => (
                  <li key={node.id} className="text-sm">
                    <span className="font-medium">{node.nodeName}</span>
                    <span className="text-muted-foreground ml-2">{node.timeText}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">暂无时间节点</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>关键金额条款</CardTitle>
          </CardHeader>
          <CardContent>
            {keyMoneyTerms.length > 0 ? (
              <ul className="space-y-2">
                {keyMoneyTerms.slice(0, 5).map((term) => (
                  <li key={term.id} className="text-sm">
                    <span className="font-medium">{term.moneyType}</span>
                    <span className="text-muted-foreground ml-2">{term.amountText}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">暂无金额条款</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>页面关键动作</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href={`/tender-center/${projectId}/risks?versionId=${versionId}`}>
            <Button variant="default" size="sm">
              跳转风险页
            </Button>
          </Link>
          <Link href={`/tender-center/${projectId}/review?versionId=${versionId}`}>
            <Button variant="default" size="sm">
              跳转复核页
            </Button>
          </Link>
          <Link href={`/tender-center/${projectId}/framework?versionId=${versionId}`}>
            <Button variant="default" size="sm">
              跳转框架页
            </Button>
          </Link>
          <Link href={`/tender-center/${projectId}/templates?versionId=${versionId}`}>
            <Button variant="default" size="sm">
              跳转模板页
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

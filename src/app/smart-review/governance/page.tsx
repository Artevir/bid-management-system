'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableListStateRow } from '@/components/ui/list-states';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

type ProjectOption = {
  projectId: number;
  projectName: string;
  projectCode: string;
  status: string;
};

type VersionOption = {
  versionId: string;
  versionNo: string;
  status: string;
};

type RiskItem = {
  riskId: string;
  level: 'high' | 'medium' | 'low';
  type: 'parse_error' | 'requirement_gap';
  title: string;
  detail: string;
  status?: string;
};

type ConflictItem = {
  conflictId: string;
  requirementId: number;
  title: string;
  category: string;
  status: string;
  detail: string;
};

type ApiErrorPayload = {
  success?: boolean;
  error?: string;
  message?: string;
};

async function unwrapResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload & {
    data?: T;
  };

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || '请求失败');
  }

  return (payload.data ?? (payload as unknown as T)) as T;
}

export default function SmartReviewGovernancePage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');

  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const projectSelectOptions = useMemo(() => {
    if (projects.length === 0) {
      return (
        <option value="" key="empty-project">
          暂无项目
        </option>
      );
    }
    return projects.map((project) => (
      <option key={project.projectId} value={project.projectId}>
        {project.projectName}（{project.projectCode}）
      </option>
    ));
  }, [projects]);

  const versionSelectOptions = useMemo(() => {
    if (versions.length === 0) {
      return (
        <option value="" key="empty-version">
          暂无版本
        </option>
      );
    }
    return versions.map((version) => (
      <option key={version.versionId} value={version.versionId}>
        {version.versionNo}（{version.status}）
      </option>
    ));
  }, [versions]);

  const riskStats = useMemo(() => {
    const high = risks.filter((risk) => risk.level === 'high').length;
    const medium = risks.filter((risk) => risk.level === 'medium').length;
    return { total: risks.length, high, medium };
  }, [risks]);

  const conflictStats = useMemo(() => {
    const nonCompliant = conflicts.filter((item) => item.status === 'non_compliant').length;
    return { total: conflicts.length, nonCompliant };
  }, [conflicts]);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      const response = await fetch(`/api/tender-center/projects?${params.toString()}`);
      const data = await unwrapResponse<ProjectOption[]>(response);
      setProjects(data);
      if (data.length > 0) {
        setSelectedProjectId((current) => current ?? data[0].projectId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const fetchVersions = useCallback(async (projectId: number) => {
    const response = await fetch(`/api/tender-center/projects/${projectId}/versions`);
    const data = await unwrapResponse<VersionOption[]>(response);
    setVersions(data);
    setSelectedVersionId((current) => current || data[0]?.versionId || '');
  }, []);

  const fetchGovernanceData = useCallback(
    async (projectId: number, versionId: string, silent = false) => {
      if (!silent) {
        setLoadingData(true);
        setError('');
      }
      try {
        const [risksResponse, conflictsResponse] = await Promise.all([
          fetch(
            `/api/tender-center/projects/${projectId}/versions/${encodeURIComponent(versionId)}/risks`
          ),
          fetch(
            `/api/tender-center/projects/${projectId}/versions/${encodeURIComponent(versionId)}/conflicts`
          ),
        ]);

        const risksData = await unwrapResponse<RiskItem[]>(risksResponse);
        const conflictsData = await unwrapResponse<ConflictItem[]>(conflictsResponse);

        setRisks(risksData);
        setConflicts(conflictsData);
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : '加载治理数据失败');
        }
      } finally {
        if (!silent) {
          setLoadingData(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }
    void fetchVersions(selectedProjectId).catch((err) => {
      setError(err instanceof Error ? err.message : '加载版本失败');
      setVersions([]);
      setSelectedVersionId('');
    });
  }, [selectedProjectId, fetchVersions]);

  useEffect(() => {
    if (!selectedProjectId || !selectedVersionId) {
      setRisks([]);
      setConflicts([]);
      return;
    }
    void fetchGovernanceData(selectedProjectId, selectedVersionId);
  }, [selectedProjectId, selectedVersionId, fetchGovernanceData]);

  useEffect(() => {
    if (!selectedProjectId || !selectedVersionId) {
      return;
    }
    const timer = setInterval(() => {
      void fetchGovernanceData(selectedProjectId, selectedVersionId, true);
    }, 15000);
    return () => clearInterval(timer);
  }, [selectedProjectId, selectedVersionId, fetchGovernanceData]);

  const handleCloseRisk = async (riskId: string) => {
    setActionBusyId(`risk:${riskId}`);
    setActionError('');
    try {
      const response = await fetch(`/api/tender-center/risks/${riskId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      await unwrapResponse(response);
      if (selectedProjectId && selectedVersionId) {
        await fetchGovernanceData(selectedProjectId, selectedVersionId, true);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '风险关闭失败');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleResolveConflict = async (
    conflictId: string,
    resolutionType: 'accept_requirement' | 'accept_actual' | 'manual_override'
  ) => {
    const note =
      resolutionType === 'manual_override'
        ? (window.prompt('请输入人工处理说明（可选）', '人工确认处理') ?? '')
        : '';
    setActionBusyId(`conflict:${conflictId}`);
    setActionError('');
    try {
      const response = await fetch(`/api/tender-center/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionType, note }),
      });
      await unwrapResponse(response);
      if (selectedProjectId && selectedVersionId) {
        await fetchGovernanceData(selectedProjectId, selectedVersionId, true);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '冲突处理失败');
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">风险与冲突处置台</h1>
          <p className="text-muted-foreground">
            对招标文件智能审阅结果进行项目级风险关闭与冲突处理（15 秒自动刷新）
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选范围</CardTitle>
          <CardDescription>先选择项目和版本，再执行处置动作</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">项目</label>
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={selectedProjectId ?? ''}
              disabled={loadingProjects || projects.length === 0}
              onChange={(event) => setSelectedProjectId(Number(event.target.value))}
            >
              {projectSelectOptions}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">版本</label>
            <select
              className="w-full px-3 py-2 border rounded-md bg-background"
              value={selectedVersionId}
              disabled={!selectedProjectId || versions.length === 0}
              onChange={(event) => setSelectedVersionId(event.target.value)}
            >
              {versionSelectOptions}
            </select>
          </div>
        </CardContent>
      </Card>

      {actionError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          操作失败：{actionError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">风险总数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{riskStats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">高风险</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">{riskStats.high}</CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">中风险</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-yellow-600">
            {riskStats.medium}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">冲突项</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-orange-600">
            {conflictStats.total}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>风险处置</CardTitle>
          <CardDescription>支持按风险项逐条关闭，闭环写入审计日志</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>风险 ID</TableHead>
                <TableHead>等级</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingData || error || risks.length === 0 ? (
                <TableListStateRow
                  state={loadingData ? 'loading' : error ? 'error' : 'empty'}
                  colSpan={6}
                  error={error}
                  onRetry={() => {
                    if (selectedProjectId && selectedVersionId) {
                      void fetchGovernanceData(selectedProjectId, selectedVersionId);
                    }
                  }}
                  emptyText="当前版本暂无待处置风险"
                />
              ) : (
                risks.map((risk) => (
                  <TableRow key={risk.riskId}>
                    <TableCell className="font-mono text-xs">{risk.riskId}</TableCell>
                    <TableCell>
                      <Badge variant={risk.level === 'high' ? 'destructive' : 'secondary'}>
                        {risk.level === 'high' ? '高' : risk.level === 'medium' ? '中' : '低'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        {risk.type === 'parse_error' ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-yellow-500" />
                        )}
                        {risk.type === 'parse_error' ? '解析异常' : '必达项缺口'}
                      </div>
                    </TableCell>
                    <TableCell>{risk.title}</TableCell>
                    <TableCell className="max-w-[420px] truncate" title={risk.detail}>
                      {risk.detail}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => void handleCloseRisk(risk.riskId)}
                        disabled={actionBusyId === `risk:${risk.riskId}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        关闭风险
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>冲突处置</CardTitle>
          <CardDescription>支持按“采纳要求 / 采纳实际 / 人工覆盖”三种策略处理冲突</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>冲突 ID</TableHead>
                <TableHead>类别</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingData || error || conflicts.length === 0 ? (
                <TableListStateRow
                  state={loadingData ? 'loading' : error ? 'error' : 'empty'}
                  colSpan={6}
                  error={error}
                  onRetry={() => {
                    if (selectedProjectId && selectedVersionId) {
                      void fetchGovernanceData(selectedProjectId, selectedVersionId);
                    }
                  }}
                  emptyText="当前版本暂无待处置冲突"
                />
              ) : (
                conflicts.map((conflict) => (
                  <TableRow key={conflict.conflictId}>
                    <TableCell className="font-mono text-xs">{conflict.conflictId}</TableCell>
                    <TableCell>{conflict.category || '-'}</TableCell>
                    <TableCell>{conflict.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant={conflict.status === 'non_compliant' ? 'destructive' : 'secondary'}
                      >
                        {conflict.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate" title={conflict.detail}>
                      {conflict.detail}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void handleResolveConflict(conflict.conflictId, 'accept_requirement')
                          }
                          disabled={actionBusyId === `conflict:${conflict.conflictId}`}
                        >
                          采纳要求
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void handleResolveConflict(conflict.conflictId, 'accept_actual')
                          }
                          disabled={actionBusyId === `conflict:${conflict.conflictId}`}
                        >
                          采纳实际
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            void handleResolveConflict(conflict.conflictId, 'manual_override')
                          }
                          disabled={actionBusyId === `conflict:${conflict.conflictId}`}
                        >
                          人工覆盖
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

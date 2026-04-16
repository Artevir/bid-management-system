'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type RequirementItem = {
  requirementId: number;
  category: string | null;
  title: string | null;
  description: string | null;
  mandatory: boolean;
  checkStatus: string;
  pageNumber: number | null;
  riskLevel?: string | null;
  conflictFlag?: boolean;
  templateBoundFlag?: boolean;
  importanceLevel?: string | null;
};

type QualificationRequirement = {
  id: number;
  requirementId: number;
  qualificationType: string;
  subjectScope: string | null;
  yearRange: string | null;
  amountRequirement: string | null;
  countRequirement: string | null;
  hardConstraintFlag: boolean;
};

type CommercialRequirement = {
  id: number;
  requirementId: number;
  commercialType: string;
  amountText: string | null;
  amountValue: number | null;
  currency: string | null;
  deadlineText: string | null;
  deadlineTime: string | null;
  methodText: string | null;
  penaltyClause: string | null;
};

type TechnicalRequirement = {
  id: number;
  requirementId: number;
  technicalType: string;
  categoryName: string | null;
  requirementName: string | null;
  requirementValue: string | null;
  valueType: string | null;
  unit: string | null;
  starFlag: boolean;
  hardConstraintFlag: boolean;
};

type SubmissionRequirement = {
  id: number;
  requirementId: number;
  submissionType: string;
  requirementText: string | null;
  copiesText: string | null;
  submissionLocation: string | null;
  signatureRequiredFlag: boolean;
  sealRequiredFlag: boolean;
};

const CHECK_STATUS_OPTIONS = [
  'draft',
  'pending_review',
  'reviewing',
  'confirmed',
  'modified',
  'rejected',
  'closed',
];

const CATEGORY_OPTIONS = ['qualification', 'commercial', 'technical', 'submission', 'other'];
const RISK_LEVEL_OPTIONS = ['high', 'medium', 'low', 'none'];
const IMPORTANCE_OPTIONS = ['critical', 'high', 'normal', 'low'];

type TabType = 'main' | 'qualification' | 'commercial' | 'technical' | 'submission';

type FilterState = {
  category: string;
  checkStatus: string;
  riskLevel: string;
  conflictFlag: string;
  templateBound: string;
  importance: string;
};

export function RequirementsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [rows, setRows] = useState<RequirementItem[]>([]);
  const [qualifications, setQualifications] = useState<QualificationRequirement[]>([]);
  const [commercials, setCommercials] = useState<CommercialRequirement[]>([]);
  const [technicalRequirements, setTechnicalRequirements] = useState<TechnicalRequirement[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [parsing, setParsing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('main');
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    checkStatus: '',
    riskLevel: '',
    conflictFlag: '',
    templateBound: '',
    importance: '',
  });

  const loadRows = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const [mainRes, qualRes, commRes, techRes, subRes] = await Promise.all([
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/requirements`),
        fetch(
          `/api/tender-center/projects/${projectId}/versions/${versionId}/qualification-requirements`
        ),
        fetch(
          `/api/tender-center/projects/${projectId}/versions/${versionId}/commercial-requirements`
        ),
        fetch(
          `/api/tender-center/projects/${projectId}/versions/${versionId}/technical-requirements`
        ),
        fetch(
          `/api/tender-center/projects/${projectId}/versions/${versionId}/submission-requirements`
        ),
      ]);
      const [mainPayload, qualPayload, commPayload, techPayload, subPayload] = await Promise.all([
        mainRes.json(),
        qualRes.json(),
        commRes.json(),
        techRes.json(),
        subRes.json(),
      ]);
      if (mainRes.ok && mainPayload.success)
        setRows(Array.isArray(mainPayload.data) ? mainPayload.data : []);
      if (qualRes.ok && qualPayload.success)
        setQualifications(Array.isArray(qualPayload.data) ? qualPayload.data : []);
      if (commRes.ok && commPayload.success)
        setCommercials(Array.isArray(commPayload.data) ? commPayload.data : []);
      if (techRes.ok && techPayload.success)
        setTechnicalRequirements(Array.isArray(techPayload.data) ? techPayload.data : []);
      if (subRes.ok && subPayload.success)
        setSubmissions(Array.isArray(subPayload.data) ? subPayload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载要求失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pendingReview = rows.filter(
      (r) => r.checkStatus === 'pending_review' || r.checkStatus === 'reviewing'
    ).length;
    const highRisk = rows.filter((r) => r.riskLevel === 'high').length;
    const conflicts = rows.filter((r) => r.conflictFlag === true).length;
    return { total, pendingReview, highRisk, conflicts };
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((row) => {
        const text =
          `${row.title || ''} ${row.description || ''} ${row.category || ''}`.toLowerCase();
        return text.includes(kw);
      });
    }
    if (filters.category) {
      result = result.filter((r) => r.category === filters.category);
    }
    if (filters.checkStatus) {
      result = result.filter((r) => r.checkStatus === filters.checkStatus);
    }
    if (filters.riskLevel) {
      result = result.filter((r) => r.riskLevel === filters.riskLevel);
    }
    if (filters.conflictFlag === 'yes') {
      result = result.filter((r) => r.conflictFlag === true);
    } else if (filters.conflictFlag === 'no') {
      result = result.filter((r) => r.conflictFlag !== true);
    }
    if (filters.templateBound === 'yes') {
      result = result.filter((r) => r.templateBoundFlag === true);
    } else if (filters.templateBound === 'no') {
      result = result.filter((r) => r.templateBoundFlag !== true);
    }
    if (filters.importance) {
      result = result.filter((r) => r.importanceLevel === filters.importance);
    }
    return result;
  }, [rows, keyword, filters]);

  const selectedRequirement = useMemo(() => {
    if (activeTab !== 'main' || selectedReqId === null) return null;
    return rows.find((r) => r.requirementId === selectedReqId) ?? null;
  }, [rows, activeTab, selectedReqId]);

  const triggerParse = async () => {
    setParsing(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/parse`,
        { method: 'POST' }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '触发解析失败');
      }
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : '触发解析失败');
    } finally {
      setParsing(false);
    }
  };

  const updateStatus = async (requirementId: number, checkStatus: string) => {
    setUpdatingId(requirementId);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/requirements/${requirementId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkStatus }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '更新状态失败');
      setRows((prev) =>
        prev.map((row) =>
          row.requirementId === requirementId
            ? { ...row, checkStatus: payload.data.checkStatus }
            : row
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新状态失败');
    } finally {
      setUpdatingId(null);
    }
  };

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'main', label: '主要求', count: rows.length },
    { key: 'qualification', label: '资格条件', count: qualifications.length },
    { key: 'commercial', label: '商务条款', count: commercials.length },
    { key: 'technical', label: '技术要求', count: technicalRequirements.length },
    { key: 'submission', label: '递交要求', count: submissions.length },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'main':
        return (
          <div className="space-y-3">
            {filteredRows.map((row) => (
              <div
                key={row.requirementId}
                className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                  selectedReqId === row.requirementId
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/30'
                }`}
                onClick={() => setSelectedReqId(row.requirementId)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.title || `要求 #${row.requirementId}`}</p>
                    <p className="text-xs text-muted-foreground">
                      类别：{row.category || 'other'} | 页码：{row.pageNumber ?? '-'} | 必填：
                      {row.mandatory ? '是' : '否'}
                    </p>
                  </div>
                  <div className="min-w-[170px] space-y-1">
                    <Label htmlFor={`req-status-${row.requirementId}`} className="text-xs">
                      审阅状态
                    </Label>
                    <select
                      id={`req-status-${row.requirementId}`}
                      className="w-full rounded border px-2 py-1 text-sm bg-background"
                      value={row.checkStatus}
                      disabled={updatingId === row.requirementId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => void updateStatus(row.requirementId, e.target.value)}
                    >
                      {CHECK_STATUS_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.riskLevel && row.riskLevel !== 'none' && (
                    <Badge variant={row.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                      {row.riskLevel}
                    </Badge>
                  )}
                  {row.conflictFlag && <Badge variant="outline">冲突</Badge>}
                  {row.templateBoundFlag && <Badge variant="outline">已绑定模板</Badge>}
                  {row.importanceLevel && row.importanceLevel === 'critical' && (
                    <Badge variant="destructive">重要</Badge>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{row.description || '-'}</p>
              </div>
            ))}
            {!loading && filteredRows.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无要求数据</p>
            )}
          </div>
        );
      case 'qualification':
        return (
          <div className="space-y-3">
            {qualifications.map((q) => (
              <div key={q.id} className="rounded border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{q.qualificationType}</p>
                    <p className="text-xs text-muted-foreground">
                      主体范围：{q.subjectScope || '-'} | 年份：{q.yearRange || '-'}
                    </p>
                  </div>
                  {q.hardConstraintFlag && <Badge variant="destructive">硬性约束</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  金额要求：{q.amountRequirement || '-'} | 数量要求：{q.countRequirement || '-'}
                </p>
              </div>
            ))}
            {qualifications.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无资格条件数据</p>
            )}
          </div>
        );
      case 'commercial':
        return (
          <div className="space-y-3">
            {commercials.map((c) => (
              <div key={c.id} className="rounded border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.commercialType}</p>
                    <p className="text-xs text-muted-foreground">
                      金额：
                      {c.amountText || c.amountValue
                        ? `${c.amountValue || ''} ${c.currency || ''}`
                        : '-'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  截止时间：{c.deadlineText || c.deadlineTime || '-'} | 方式：{c.methodText || '-'}
                </p>
                {c.penaltyClause && <p className="text-xs">违约条款：{c.penaltyClause}</p>}
              </div>
            ))}
            {commercials.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无商务条款数据</p>
            )}
          </div>
        );
      case 'technical':
        return (
          <div className="space-y-3">
            {technicalRequirements.map((t) => (
              <div key={t.id} className="rounded border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.requirementName || t.technicalType}</p>
                    <p className="text-xs text-muted-foreground">
                      类别：{t.categoryName || '-'} | 要求值：{t.requirementValue || '-'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {t.starFlag && <Badge variant="destructive">关键</Badge>}
                    {t.hardConstraintFlag && <Badge variant="outline">硬约束</Badge>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  单位：{t.unit || '-'} | 类型：{t.valueType || '-'}
                </p>
              </div>
            ))}
            {technicalRequirements.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无技术要求数据</p>
            )}
          </div>
        );
      case 'submission':
        return (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="rounded border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.submissionType}</p>
                    <p className="text-xs text-muted-foreground">
                      递交地点：{s.submissionLocation || '-'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {s.signatureRequiredFlag && <Badge variant="outline">需签字</Badge>}
                    {s.sealRequiredFlag && <Badge variant="outline">需盖章</Badge>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">份数：{s.copiesText || '-'}</p>
                {s.requirementText && <p className="text-sm">{s.requirementText}</p>}
              </div>
            ))}
            {submissions.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无递交要求数据</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const renderDetailPanel = () => {
    if (!selectedRequirement) return null;
    return (
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">要求详情</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Label className="text-muted-foreground">要求ID</Label>
            <p>{selectedRequirement.requirementId}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">标题</Label>
            <p className="font-medium">{selectedRequirement.title || '-'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">要求类别</Label>
            <p>{selectedRequirement.category || 'other'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">必填</Label>
            <p>{selectedRequirement.mandatory ? '是' : '否'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">来源页码</Label>
            <p>{selectedRequirement.pageNumber ?? '-'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">风险等级</Label>
            <p>{selectedRequirement.riskLevel || '未评估'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">复核状态</Label>
            <p>{selectedRequirement.checkStatus}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">完整内容</Label>
            <p className="whitespace-pre-wrap text-xs">{selectedRequirement.description || '-'}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedReqId(null)}>
              关闭
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">招标要求</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
                  刷新
                </Button>
                <Button onClick={() => void triggerParse()} disabled={parsing}>
                  {parsing ? '解析中...' : '触发解析'}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="text-sm bg-muted px-3 py-1 rounded">
                要求总数: <strong>{stats.total}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                待复核: <strong>{stats.pendingReview}</strong>
              </div>
              <div className="text-sm bg-destructive/10 text-destructive px-3 py-1 rounded">
                高风险: <strong>{stats.highRisk}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                冲突: <strong>{stats.conflicts}</strong>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && <p className="text-sm text-muted-foreground">加载中...</p>}

            <div className="flex flex-wrap gap-2 items-center border-b pb-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="关键词搜索"
                className="max-w-[200px]"
              />
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">全部类别</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.checkStatus}
                onChange={(e) => setFilters((f) => ({ ...f, checkStatus: e.target.value }))}
              >
                <option value="">全部状态</option>
                {CHECK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.riskLevel}
                onChange={(e) => setFilters((f) => ({ ...f, riskLevel: e.target.value }))}
              >
                <option value="">全部风险</option>
                {RISK_LEVEL_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.conflictFlag}
                onChange={(e) => setFilters((f) => ({ ...f, conflictFlag: e.target.value }))}
              >
                <option value="">冲突筛选</option>
                <option value="yes">有冲突</option>
                <option value="no">无冲突</option>
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.templateBound}
                onChange={(e) => setFilters((f) => ({ ...f, templateBound: e.target.value }))}
              >
                <option value="">模板绑定</option>
                <option value="yes">已绑定</option>
                <option value="no">未绑定</option>
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.importance}
                onChange={(e) => setFilters((f) => ({ ...f, importance: e.target.value }))}
              >
                <option value="">重要度</option>
                {IMPORTANCE_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-1 border-b">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSelectedReqId(null);
                  }}
                  className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {activeTab === 'main'
                ? `显示 ${filteredRows.length} 条（总计 ${rows.length} 条）`
                : `共 ${tabs.find((t) => t.key === activeTab)?.count || 0} 条`}
            </p>
            {renderTabContent()}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {selectedRequirement ? (
          renderDetailPanel()
        ) : (
          <Card className="h-fit">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>点击左侧要求查看详情</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

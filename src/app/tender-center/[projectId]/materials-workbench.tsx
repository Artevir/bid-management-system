'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Material = {
  type: 'material';
  id: number;
  name: string | null;
  subType: string | null;
  required: boolean;
  needSignature: boolean;
  needSeal: boolean;
  status: string;
  note: string | null;
  sourceReason: string | null;
  sourceType?: string | null;
  relatedScoringItemId?: number | null;
  relatedTemplateId?: number | null;
};

type Task = {
  type: 'task';
  id: number;
  name: string | null;
  subType: string | null;
  priority: string | null;
  status: string;
  deadline: string | null;
  responsibilityRole: string | null;
};

type Clarification = {
  type: 'clarification';
  id: number;
  name: string | null;
  content: string | null;
  reason: string | null;
  urgency: string | null;
  status: string;
};

type PreparationData = {
  materials: Material[];
  tasks: Task[];
  clarifications: Clarification[];
  summary: {
    materialCount: number;
    requiredMaterialCount: number;
    taskCount: number;
    pendingTaskCount: number;
    clarificationCount: number;
    urgentClarificationCount: number;
  };
};

type TabType = 'materials' | 'tasks' | 'clarifications';

type FilterState = {
  materialType: string;
  required: string;
  signature: string;
  seal: string;
  sourceType: string;
  reviewStatus: string;
  taskStatus: string;
  taskPriority: string;
  clarStatus: string;
  clarUrgency: string;
};

export function MaterialsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [data, setData] = useState<PreparationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedClarId, setSelectedClarId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    materialType: '',
    required: '',
    signature: '',
    seal: '',
    sourceType: '',
    reviewStatus: '',
    taskStatus: '',
    taskPriority: '',
    clarStatus: '',
    clarUrgency: '',
  });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/preparation-detail`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载数据失败');
      }
      setData(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId, versionId]);

  const stats = useMemo(() => {
    if (!data?.summary) return null;
    const materialCount = data.materials.length;
    const requiredCount = data.materials.filter((m) => m.required).length;
    const signatureCount = data.materials.filter((m) => m.needSignature).length;
    const sealCount = data.materials.filter((m) => m.needSeal).length;
    const scoringRelatedCount = data.materials.filter((m) => m.relatedScoringItemId).length;
    const templateRelatedCount = data.materials.filter((m) => m.relatedTemplateId).length;
    return {
      materialCount,
      requiredCount,
      signatureCount,
      sealCount,
      scoringRelatedCount,
      templateRelatedCount,
      taskCount: data.tasks.length,
      pendingTaskCount: data.tasks.filter((t) => t.status !== 'completed').length,
      clarCount: data.clarifications.length,
      urgentClarCount: data.clarifications.filter((c) => c.urgency === 'high').length,
    };
  }, [data]);

  const filteredMaterials = useMemo(() => {
    if (!data?.materials) return [];
    let result = data.materials;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((m) =>
        `${m.name || ''} ${m.subType || ''}`.toLowerCase().includes(kw)
      );
    }
    if (filters.materialType) result = result.filter((m) => m.subType === filters.materialType);
    if (filters.required === 'yes') result = result.filter((m) => m.required);
    if (filters.required === 'no') result = result.filter((m) => !m.required);
    if (filters.signature === 'yes') result = result.filter((m) => m.needSignature);
    if (filters.signature === 'no') result = result.filter((m) => !m.needSignature);
    if (filters.seal === 'yes') result = result.filter((m) => m.needSeal);
    if (filters.seal === 'no') result = result.filter((m) => !m.needSeal);
    if (filters.sourceType) result = result.filter((m) => m.sourceType === filters.sourceType);
    if (filters.reviewStatus) result = result.filter((m) => m.status === filters.reviewStatus);
    return result;
  }, [data?.materials, keyword, filters]);

  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    let result = data.tasks;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((t) =>
        `${t.name || ''} ${t.subType || ''}`.toLowerCase().includes(kw)
      );
    }
    if (filters.taskStatus) result = result.filter((t) => t.status === filters.taskStatus);
    if (filters.taskPriority) result = result.filter((t) => t.priority === filters.taskPriority);
    return result;
  }, [data?.tasks, keyword, filters]);

  const filteredClarifications = useMemo(() => {
    if (!data?.clarifications) return [];
    let result = data.clarifications;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((c) =>
        `${c.name || ''} ${c.content || ''}`.toLowerCase().includes(kw)
      );
    }
    if (filters.clarStatus) result = result.filter((c) => c.status === filters.clarStatus);
    if (filters.clarUrgency) result = result.filter((c) => c.urgency === filters.clarUrgency);
    return result;
  }, [data?.clarifications, keyword, filters]);

  const selectedMaterial = useMemo(() => {
    if (selectedMaterialId === null || !data?.materials) return null;
    return data.materials.find((m) => m.id === selectedMaterialId) ?? null;
  }, [data?.materials, selectedMaterialId]);

  const selectedTask = useMemo(() => {
    if (selectedTaskId === null || !data?.tasks) return null;
    return data.tasks.find((t) => t.id === selectedTaskId) ?? null;
  }, [data?.tasks, selectedTaskId]);

  const selectedClar = useMemo(() => {
    if (selectedClarId === null || !data?.clarifications) return null;
    return data.clarifications.find((c) => c.id === selectedClarId) ?? null;
  }, [data?.clarifications, selectedClarId]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      pending: 'outline',
      in_progress: 'default',
      completed: 'outline',
      confirmed: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const handleConfirmObject = async (materialId: number) => {
    const key = `confirm_object-${materialId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/materials/${materialId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewStatus: 'confirmed' }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '确认对象失败');
      setData((prev) =>
        prev
          ? {
              ...prev,
              materials: prev.materials.map((m) =>
                m.id === materialId ? { ...m, status: 'confirmed' } : m
              ),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认对象失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleCreateResponseTask = async (materialId: number, materialName: string) => {
    const key = `create_response_task-${materialId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/response-tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceType: 'material', sourceId: materialId }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '转响应任务失败');
    } catch (err) {
      setError(err instanceof Error ? err.message : '转响应任务失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const renderDetailPanel = () => {
    if (activeTab === 'materials' && selectedMaterial) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">材料详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">材料名称</Label>
              <p className="font-medium">{selectedMaterial.name ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">材料类型</Label>
              <p>{selectedMaterial.subType ?? 'other'}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedMaterial.required && <Badge variant="destructive">必须</Badge>}
              {selectedMaterial.needSignature && <Badge variant="outline">需签字</Badge>}
              {selectedMaterial.needSeal && <Badge variant="outline">需盖章</Badge>}
            </div>
            <div>
              <Label className="text-muted-foreground">复核状态</Label>
              <div className="mt-1">{getStatusBadge(selectedMaterial.status)}</div>
            </div>
            {selectedMaterial.sourceReason && (
              <div>
                <Label className="text-muted-foreground">来源原因</Label>
                <p>{selectedMaterial.sourceReason}</p>
              </div>
            )}
            {selectedMaterial.sourceType && (
              <div>
                <Label className="text-muted-foreground">来源对象类型</Label>
                <p>{selectedMaterial.sourceType}</p>
              </div>
            )}
            {selectedMaterial.relatedScoringItemId && (
              <div>
                <Label className="text-muted-foreground">关联评分项</Label>
                <p>ID: {selectedMaterial.relatedScoringItemId}</p>
              </div>
            )}
            {selectedMaterial.relatedTemplateId && (
              <div>
                <Label className="text-muted-foreground">关联模板</Label>
                <p>ID: {selectedMaterial.relatedTemplateId}</p>
              </div>
            )}
            {selectedMaterial.note && (
              <div>
                <Label className="text-muted-foreground">备注</Label>
                <p>{selectedMaterial.note}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`confirm_object-${selectedMaterial.id}`]}
                onClick={() => handleConfirmObject(selectedMaterial.id)}
              >
                确认对象 (confirm_object)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`create_response_task-${selectedMaterial.id}`]}
                onClick={() =>
                  handleCreateResponseTask(selectedMaterial.id, selectedMaterial.name || '')
                }
              >
                转响应任务 (create_response_task)
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedMaterialId(null)}>
                关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (activeTab === 'tasks' && selectedTask) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">任务详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">任务名称</Label>
              <p className="font-medium">{selectedTask.name ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">任务类型</Label>
              <p>{selectedTask.subType ?? 'other'}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">状态</Label>
                <div className="mt-1">{getStatusBadge(selectedTask.status)}</div>
              </div>
              {selectedTask.priority && (
                <div>
                  <Label className="text-muted-foreground">优先级</Label>
                  <Badge variant={selectedTask.priority === 'high' ? 'destructive' : 'secondary'}>
                    {selectedTask.priority}
                  </Badge>
                </div>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">责任角色</Label>
              <p>{selectedTask.responsibilityRole ?? '-'}</p>
            </div>
            {selectedTask.deadline && (
              <div>
                <Label className="text-muted-foreground">截止时间</Label>
                <p>{new Date(selectedTask.deadline).toLocaleString()}</p>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setSelectedTaskId(null)}>
              关闭
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (activeTab === 'clarifications' && selectedClar) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">澄清详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">澄清名称</Label>
              <p className="font-medium">{selectedClar.name ?? '-'}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">状态</Label>
                <div className="mt-1">{getStatusBadge(selectedClar.status)}</div>
              </div>
              {selectedClar.urgency && (
                <div>
                  <Label className="text-muted-foreground">紧急程度</Label>
                  <Badge variant={selectedClar.urgency === 'high' ? 'destructive' : 'outline'}>
                    {selectedClar.urgency}
                  </Badge>
                </div>
              )}
            </div>
            {selectedClar.content && (
              <div>
                <Label className="text-muted-foreground">澄清内容</Label>
                <p className="whitespace-pre-wrap">{selectedClar.content}</p>
              </div>
            )}
            {selectedClar.reason && (
              <div>
                <Label className="text-muted-foreground">原因</Label>
                <p>{selectedClar.reason}</p>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setSelectedClarId(null)}>
              关闭
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="h-fit">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>点击左侧项查看详情</p>
        </CardContent>
      </Card>
    );
  };

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'materials', label: '材料清单', count: filteredMaterials.length },
    { key: 'tasks', label: '响应任务', count: filteredTasks.length },
    { key: 'clarifications', label: '澄清候选', count: filteredClarifications.length },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'materials':
        return (
          <div className="space-y-3">
            {filteredMaterials.map((mat) => (
              <div
                key={mat.id}
                className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                  selectedMaterialId === mat.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/30'
                }`}
                onClick={() => setSelectedMaterialId(mat.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {mat.name || `材料 #${mat.id}`}
                      {mat.required && <span className="text-red-500 ml-1">*必填</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">类型：{mat.subType || 'other'}</p>
                  </div>
                  {getStatusBadge(mat.status)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {mat.needSignature && (
                    <Badge variant="outline" className="text-[10px]">
                      需签名
                    </Badge>
                  )}
                  {mat.needSeal && (
                    <Badge variant="outline" className="text-[10px]">
                      需盖章
                    </Badge>
                  )}
                  {mat.relatedScoringItemId && (
                    <Badge variant="secondary" className="text-[10px]">
                      关联评分
                    </Badge>
                  )}
                  {mat.relatedTemplateId && (
                    <Badge variant="secondary" className="text-[10px]">
                      关联模板
                    </Badge>
                  )}
                </div>
                {mat.note && <p className="text-sm text-muted-foreground">备注：{mat.note}</p>}
              </div>
            ))}
            {filteredMaterials.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无材料数据</p>
            )}
          </div>
        );
      case 'tasks':
        return (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                  selectedTaskId === task.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
                }`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{task.name || `任务 #${task.id}`}</p>
                    <p className="text-xs text-muted-foreground">
                      类型：{task.subType || 'other'} | 角色：{task.responsibilityRole || '-'}
                    </p>
                    {task.deadline && (
                      <p className="text-xs text-muted-foreground">
                        截止：{new Date(task.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(task.status)}
                    {task.priority && (
                      <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>
                        {task.priority}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无任务数据</p>
            )}
          </div>
        );
      case 'clarifications':
        return (
          <div className="space-y-3">
            {filteredClarifications.map((clar) => (
              <div
                key={clar.id}
                className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                  selectedClarId === clar.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
                }`}
                onClick={() => setSelectedClarId(clar.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{clar.name || `澄清 #${clar.id}`}</p>
                    {clar.content && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{clar.content}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(clar.status)}
                    {clar.urgency && (
                      <Badge variant={clar.urgency === 'high' ? 'destructive' : 'outline'}>
                        {clar.urgency}
                      </Badge>
                    )}
                  </div>
                </div>
                {clar.reason && (
                  <p className="text-xs text-muted-foreground">原因：{clar.reason}</p>
                )}
              </div>
            ))}
            {filteredClarifications.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无澄清候选数据</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">材料清单</CardTitle>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                刷新
              </Button>
            </div>
            {stats && (
              <div className="flex flex-wrap gap-2">
                <div className="text-sm bg-muted px-3 py-1 rounded">
                  材料: <strong>{stats.materialCount}</strong>
                </div>
                <div className="text-sm bg-destructive/10 text-destructive px-3 py-1 rounded">
                  必须: <strong>{stats.requiredCount}</strong>
                </div>
                <div className="text-sm bg-muted px-3 py-1 rounded">
                  需签字: <strong>{stats.signatureCount}</strong>
                </div>
                <div className="text-sm bg-muted px-3 py-1 rounded">
                  需盖章: <strong>{stats.sealCount}</strong>
                </div>
                <div className="text-sm bg-muted px-3 py-1 rounded">
                  关联评分: <strong>{stats.scoringRelatedCount}</strong>
                </div>
                <div className="text-sm bg-muted px-3 py-1 rounded">
                  关联模板: <strong>{stats.templateRelatedCount}</strong>
                </div>
                <div className="text-sm bg-muted px-3 py-1 rounded">
                  任务: <strong>{stats.taskCount}</strong>
                </div>
                <div className="text-sm bg-muted px-3 py-1 rounded">
                  待处理: <strong>{stats.pendingTaskCount}</strong>
                </div>
                <div className="text-sm bg-muted px-3 py-1 rounded">
                  澄清: <strong>{stats.clarCount}</strong>
                </div>
                <div className="text-sm bg-destructive/10 text-destructive px-3 py-1 rounded">
                  紧急: <strong>{stats.urgentClarCount}</strong>
                </div>
              </div>
            )}
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
              {activeTab === 'materials' && (
                <>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.materialType}
                    onChange={(e) => setFilters((f) => ({ ...f, materialType: e.target.value }))}
                  >
                    <option value="">材料类型</option>
                    <option value="certificate">资质证书</option>
                    <option value="declaration">声明文件</option>
                    <option value="form">表单</option>
                    <option value="other">其他</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.required}
                    onChange={(e) => setFilters((f) => ({ ...f, required: e.target.value }))}
                  >
                    <option value="">必须</option>
                    <option value="yes">是</option>
                    <option value="no">否</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.signature}
                    onChange={(e) => setFilters((f) => ({ ...f, signature: e.target.value }))}
                  >
                    <option value="">需签字</option>
                    <option value="yes">是</option>
                    <option value="no">否</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.seal}
                    onChange={(e) => setFilters((f) => ({ ...f, seal: e.target.value }))}
                  >
                    <option value="">需盖章</option>
                    <option value="yes">是</option>
                    <option value="no">否</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.reviewStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, reviewStatus: e.target.value }))}
                  >
                    <option value="">状态</option>
                    <option value="draft">draft</option>
                    <option value="pending">pending</option>
                    <option value="confirmed">confirmed</option>
                  </select>
                </>
              )}
              {activeTab === 'tasks' && (
                <>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.taskStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, taskStatus: e.target.value }))}
                  >
                    <option value="">任务状态</option>
                    <option value="pending">pending</option>
                    <option value="in_progress">in_progress</option>
                    <option value="completed">completed</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.taskPriority}
                    onChange={(e) => setFilters((f) => ({ ...f, taskPriority: e.target.value }))}
                  >
                    <option value="">优先级</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </>
              )}
              {activeTab === 'clarifications' && (
                <>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.clarStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, clarStatus: e.target.value }))}
                  >
                    <option value="">状态</option>
                    <option value="draft">draft</option>
                    <option value="pending">pending</option>
                    <option value="resolved">resolved</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.clarUrgency}
                    onChange={(e) => setFilters((f) => ({ ...f, clarUrgency: e.target.value }))}
                  >
                    <option value="">紧急程度</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-1 border-b">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSelectedMaterialId(null);
                    setSelectedTaskId(null);
                    setSelectedClarId(null);
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
              共 {tabs.find((t) => t.key === activeTab)?.count || 0} 条
            </p>
            {renderTabContent()}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">{renderDetailPanel()}</div>
    </div>
  );
}

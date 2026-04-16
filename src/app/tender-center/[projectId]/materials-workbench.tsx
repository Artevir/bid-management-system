'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

  const filteredMaterials =
    data?.materials.filter((m) =>
      keyword.trim()
        ? `${m.name || ''} ${m.subType || ''}`.toLowerCase().includes(keyword.trim().toLowerCase())
        : true
    ) ?? [];

  const filteredTasks =
    data?.tasks.filter((t) =>
      keyword.trim()
        ? `${t.name || ''} ${t.subType || ''}`.toLowerCase().includes(keyword.trim().toLowerCase())
        : true
    ) ?? [];

  const filteredClarifications =
    data?.clarifications.filter((c) =>
      keyword.trim()
        ? `${c.name || ''} ${c.content || ''}`.toLowerCase().includes(keyword.trim().toLowerCase())
        : true
    ) ?? [];

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'materials', label: '材料清单', count: filteredMaterials.length },
    { key: 'tasks', label: '响应任务', count: filteredTasks.length },
    { key: 'clarifications', label: '澄清候选', count: filteredClarifications.length },
  ];

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'materials':
        return (
          <div className="space-y-3">
            {filteredMaterials.map((mat) => (
              <div key={mat.id} className="rounded border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {mat.name || `材料 #${mat.id}`}
                      {mat.required && <span className="text-red-500 ml-1">*必填</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      类型：{mat.subType || 'other_material'}
                    </p>
                  </div>
                  {getStatusBadge(mat.status)}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {mat.needSignature && <Badge variant="outline">需签名</Badge>}
                  {mat.needSeal && <Badge variant="outline">需盖章</Badge>}
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
              <div key={task.id} className="rounded border p-3 space-y-2">
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
              <div key={clar.id} className="rounded border p-3 space-y-2">
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
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>投标准备工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索材料/任务/澄清"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-muted-foreground">加载中...</p>}

        {data?.summary && (
          <div className="flex flex-wrap gap-4 text-sm">
            <Badge variant="outline">
              材料 {data.summary.materialCount} (必填{data.summary.requiredMaterialCount})
            </Badge>
            <Badge variant="outline">
              任务 {data.summary.taskCount} (待处理{data.summary.pendingTaskCount})
            </Badge>
            <Badge variant="outline">
              澄清 {data.summary.clarificationCount} (紧急{data.summary.urgentClarificationCount})
            </Badge>
          </div>
        )}

        <div className="flex flex-wrap gap-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
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
  );
}

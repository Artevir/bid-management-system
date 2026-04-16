'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Users,
  FileText,
  ArrowRight,
  Save,
  Loader2,
} from 'lucide-react';

interface ApprovalLevel {
  level: string;
  name: string;
  assigneeType: 'role' | 'user';
  assigneeId: number | null;
  required: boolean;
  dueDays: number;
}

interface ApprovalFlow {
  id: number;
  projectId: number;
  projectName: string;
  levels: ApprovalLevel[];
  isActive: boolean;
  createdAt: string;
}

interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  name: string;
}

const DEFAULT_LEVELS: ApprovalLevel[] = [
  {
    level: 'first',
    name: '一级审核',
    assigneeType: 'role',
    assigneeId: null,
    required: true,
    dueDays: 2,
  },
  {
    level: 'second',
    name: '二级审核',
    assigneeType: 'role',
    assigneeId: null,
    required: true,
    dueDays: 2,
  },
  {
    level: 'third',
    name: '三级审核',
    assigneeType: 'role',
    assigneeId: null,
    required: false,
    dueDays: 3,
  },
  {
    level: 'final',
    name: '终审',
    assigneeType: 'user',
    assigneeId: null,
    required: true,
    dueDays: 1,
  },
];

export default function ApprovalConfigPage() {
  const [flows, setFlows] = useState<ApprovalFlow[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<ApprovalFlow | null>(null);
  const [formData, setFormData] = useState({
    projectId: '',
    isActive: true,
    levels: DEFAULT_LEVELS,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [flowsRes, projectsRes, rolesRes, usersRes] = await Promise.all([
        fetch('/api/bid/approvals/flows'),
        fetch('/api/projects?pageSize=1000'),
        fetch('/api/admin/roles'),
        fetch('/api/admin/users'),
      ]);

      const flowsData = await flowsRes.json();
      const projectsData = await projectsRes.json();
      const rolesData = await rolesRes.json();
      const usersData = await usersRes.json();

      if (flowsData.success) setFlows(flowsData.flows || []);
      if (projectsData.success) {
        const projectItems = projectsData?.data?.items || projectsData?.items || [];
        setProjects(projectItems);
      }
      if (rolesData.success) setRoles(rolesData.roles || []);
      if (usersData.success) setUsers(usersData.users || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setSelectedFlow(null);
    setFormData({
      projectId: '',
      isActive: true,
      levels: [...DEFAULT_LEVELS],
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (flow: ApprovalFlow) => {
    setSelectedFlow(flow);
    setFormData({
      projectId: flow.projectId.toString(),
      isActive: flow.isActive,
      levels: [...flow.levels],
    });
    setEditDialogOpen(true);
  };

  const handleDelete = async (flowId: number) => {
    if (!confirm('确定要删除这个审核流程吗？')) return;

    try {
      const res = await fetch(`/api/bid/approvals/flows?id=${flowId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete flow:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    }
  };

  const handleSave = async () => {
    if (!formData.projectId) {
      alert('请选择项目');
      return;
    }

    setSaving(true);
    try {
      const url = selectedFlow
        ? `/api/bid/approvals/flows?id=${selectedFlow.id}`
        : '/api/bid/approvals/flows';

      const method = selectedFlow ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: parseInt(formData.projectId),
          isActive: formData.isActive,
          levels: formData.levels,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEditDialogOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to save flow:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const updateLevel = (index: number, field: string, value: any) => {
    const newLevels = [...formData.levels];
    (newLevels[index] as any)[field] = value;
    setFormData({ ...formData, levels: newLevels });
  };

  if (error) {
    return <ListStateBlock state="error" error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">审核流程配置</h1>
          <p className="text-muted-foreground">配置项目的多级审核流程</p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="w-4 h-4 mr-2" />
          新建审核流程
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已配置流程</p>
                <p className="text-2xl font-bold">{flows.length}</p>
              </div>
              <Settings className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已启用</p>
                <p className="text-2xl font-bold">{flows.filter((f) => f.isActive).length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">未启用</p>
                <p className="text-2xl font-bold">{flows.filter((f) => !f.isActive).length}</p>
              </div>
              <Users className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flow List */}
      <Card>
        <CardHeader>
          <CardTitle>审核流程列表</CardTitle>
          <CardDescription>管理各项目的审核流程配置</CardDescription>
        </CardHeader>
        <CardContent>
          {flows.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无审核流程配置" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead>审核级别</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flows.map((flow) => (
                  <TableRow key={flow.id}>
                    <TableCell className="font-medium">{flow.projectName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {flow.levels
                          .filter((l) => l.required)
                          .map((level, idx) => (
                            <Badge key={level.level} variant="outline" className="text-xs">
                              {level.name}
                            </Badge>
                          ))}
                        <ArrowRight className="w-3 h-3 text-muted-foreground mx-1" />
                        <span className="text-xs text-muted-foreground">
                          共{flow.levels.length}级
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={flow.isActive ? 'default' : 'secondary'}>
                        {flow.isActive ? '已启用' : '已禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(flow.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(flow)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(flow.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFlow ? '编辑审核流程' : '新建审核流程'}</DialogTitle>
            <DialogDescription>配置项目的多级审核流程</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>选择项目</Label>
              <Select
                value={formData.projectId}
                onValueChange={(v) => setFormData({ ...formData, projectId: v })}
                disabled={!!selectedFlow}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>启用状态</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <div>
              <Label className="mb-2 block">审核级别配置</Label>
              <div className="space-y-3">
                {formData.levels.map((level, index) => (
                  <div key={level.level} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-20 font-medium">{level.name}</div>
                    <Select
                      value={level.assigneeType}
                      onValueChange={(v) => updateLevel(index, 'assigneeType', v)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="role">角色</SelectItem>
                        <SelectItem value="user">用户</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={level.assigneeId?.toString() || ''}
                      onValueChange={(v) => updateLevel(index, 'assigneeId', parseInt(v))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="选择..." />
                      </SelectTrigger>
                      <SelectContent>
                        {level.assigneeType === 'role'
                          ? roles.map((r) => (
                              <SelectItem key={r.id} value={r.id.toString()}>
                                {r.name}
                              </SelectItem>
                            ))
                          : users.map((u) => (
                              <SelectItem key={u.id} value={u.id.toString()}>
                                {u.name}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">必审</Label>
                      <Switch
                        checked={level.required}
                        onCheckedChange={(v) => updateLevel(index, 'required', v)}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs w-12">时限(天)</Label>
                      <Input
                        type="number"
                        className="w-16"
                        value={level.dueDays}
                        onChange={(e) =>
                          updateLevel(index, 'dueDays', parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

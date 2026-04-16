'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Search,
  Edit as _Edit,
  Trash2,
  Play,
  Settings,
  FileText as _FileText,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowDefinition {
  id: number;
  name: string;
  code: string;
  description: string | null;
  category: string | null;
  businessType: string | null;
  status: string;
  version: number;
  instanceCount: number;
  createdAt: string;
  creatorName: string | null;
}

interface WorkflowListResponse {
  data: WorkflowDefinition[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function WorkflowListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workflows, setWorkflows] = useState<WorkflowListResponse>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    category: '',
    status: '',
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    description: '',
    category: '',
    businessType: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // 获取工作流列表
  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (searchParams.keyword) params.append('keyword', searchParams.keyword);
      if (searchParams.category) params.append('category', searchParams.category);
      if (searchParams.status) params.append('status', searchParams.status);
      params.append('page', workflows.page.toString());
      params.append('pageSize', workflows.pageSize.toString());

      const response = await fetch(`/api/workflows?${params.toString()}`);
      if (!response.ok) throw new Error('获取列表失败');

      const data = await response.json();
      setWorkflows(data);
    } catch (error) {
      console.error('获取工作流列表失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
      toast.error('获取工作流列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [workflows.page, workflows.pageSize]);

  // 创建工作流
  const handleCreate = async () => {
    if (!createForm.name || !createForm.code) {
      toast.error('请填写名称和编码');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建失败');
      }

      const result = await response.json();
      toast.success('创建成功');
      setCreateDialogOpen(false);
      setCreateForm({
        name: '',
        code: '',
        description: '',
        category: '',
        businessType: '',
      });

      // 跳转到设计器页面
      router.push(`/workflows/${result.id}/design`);
    } catch (error: any) {
      console.error('创建工作流失败:', error);
      toast.error(error.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除工作流
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除工作流「${name}」吗？`)) return;

    try {
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      toast.success('删除成功');
      fetchWorkflows();
    } catch (error: any) {
      console.error('删除工作流失败:', error);
      toast.error(error.message || '删除失败');
    }
  };

  // 启用/停用工作流
  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const actionText = newStatus === 'active' ? '启用' : '停用';

    if (!confirm(`确定要${actionText}此工作流吗？`)) return;

    try {
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('操作失败');

      toast.success(`${actionText}成功`);
      fetchWorkflows();
    } catch (error) {
      console.error('更新状态失败:', error);
      toast.error('操作失败');
    }
  };

  // 状态显示
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">已启用</Badge>;
      case 'inactive':
        return <Badge variant="secondary">已停用</Badge>;
      case 'draft':
        return <Badge variant="outline">草稿</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 分类显示
  const getCategoryLabel = (category: string | null) => {
    const categoryMap: Record<string, string> = {
      approval: '审批流程',
      review: '审核流程',
      publish: '发布流程',
    };
    return category ? categoryMap[category] || category : '-';
  };

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">工作流管理</h1>
            <p className="text-gray-500 text-sm">管理企业审批流程配置</p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新建工作流
        </Button>
      </div>

      {/* 搜索筛选栏 */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="搜索工作流名称或编码..."
            value={searchParams.keyword}
            onChange={(e) => setSearchParams({ ...searchParams, keyword: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && fetchWorkflows()}
          />
        </div>
        <Select
          value={searchParams.category || 'all'}
          onValueChange={(value) =>
            setSearchParams({ ...searchParams, category: value === 'all' ? '' : value })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="approval">审批流程</SelectItem>
            <SelectItem value="review">审核流程</SelectItem>
            <SelectItem value="publish">发布流程</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={searchParams.status || 'all'}
          onValueChange={(value) =>
            setSearchParams({ ...searchParams, status: value === 'all' ? '' : value })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="active">已启用</SelectItem>
            <SelectItem value="inactive">已停用</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={fetchWorkflows}>
          <Search className="h-4 w-4 mr-2" />
          搜索
        </Button>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>工作流名称</TableHead>
              <TableHead>编码</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>版本</TableHead>
              <TableHead>实例数</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建人</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <ListStateBlock state="error" error={error} onRetry={fetchWorkflows} />
            ) : loading ? (
              <ListStateBlock state="loading" />
            ) : workflows.data.length === 0 ? (
              <ListStateBlock state="empty" emptyText="暂无数据" />
            ) : (
              workflows.data.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{workflow.name}</div>
                      {workflow.description && (
                        <div className="text-xs text-gray-500 mt-1">{workflow.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{workflow.code}</code>
                  </TableCell>
                  <TableCell>{getCategoryLabel(workflow.category)}</TableCell>
                  <TableCell>v{workflow.version}</TableCell>
                  <TableCell>{workflow.instanceCount}</TableCell>
                  <TableCell>{getStatusBadge(workflow.status)}</TableCell>
                  <TableCell>{workflow.creatorName || '-'}</TableCell>
                  <TableCell>{new Date(workflow.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/workflows/${workflow.id}/design`}>
                        <Button variant="ghost" size="icon" title="设计流程">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={workflow.status === 'active' ? '停用' : '启用'}
                        onClick={() => handleToggleStatus(workflow.id, workflow.status)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="删除"
                        onClick={() => handleDelete(workflow.id, workflow.name)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {workflows.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">共 {workflows.total} 条记录</div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={workflows.page === 1}
              onClick={() => setWorkflows({ ...workflows, page: workflows.page - 1 })}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={workflows.page === workflows.totalPages}
              onClick={() => setWorkflows({ ...workflows, page: workflows.page + 1 })}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* 创建工作流对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>新建工作流</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">工作流名称 *</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="请输入工作流名称"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">工作流编码 *</Label>
              <Input
                id="code"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                placeholder="唯一标识，如：doc-approval"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">流程分类</Label>
              <Select
                value={createForm.category}
                onValueChange={(value) => setCreateForm({ ...createForm, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approval">审批流程</SelectItem>
                  <SelectItem value="review">审核流程</SelectItem>
                  <SelectItem value="publish">发布流程</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="businessType">业务类型</Label>
              <Select
                value={createForm.businessType}
                onValueChange={(value) => setCreateForm({ ...createForm, businessType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择业务类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">文档</SelectItem>
                  <SelectItem value="project">项目</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="请输入工作流描述"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

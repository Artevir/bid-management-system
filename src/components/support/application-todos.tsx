/**
 * 待办事项组件
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, ClipboardList, Loader2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Todo {
  id: number;
  title: string;
  assigneeId: number;
  assigneeName: string;
  deadline: string | null;
  status: string;
  notes: string | null;
  type: string;
  createdAt: string;
}

interface ApplicationTodosProps {
  applicationId: number;
  todos: Todo[];
  onUpdate: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  overdue: '逾期',
};

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

const TYPE_LABELS: Record<string, string> = {
  material_submit: '材料提交',
  material_receive: '材料接收',
  review: '审核推进',
  sync: '结果同步',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  not_started: <Clock className="h-4 w-4 text-gray-400" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  overdue: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

export function ApplicationTodos({
  applicationId,
  todos,
  onUpdate,
}: ApplicationTodosProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    deadline: '',
    notes: '',
    type: 'material_submit',
  });

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('请输入待办事项');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/preparation/authorizations/${applicationId}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          deadline: formData.deadline || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '创建失败');
      }

      toast.success('待办事项已创建');
      setDialogOpen(false);
      setFormData({
        title: '',
        deadline: '',
        notes: '',
        type: 'material_submit',
      });
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (todoId: number, status: string) => {
    try {
      const res = await fetch(`/api/preparation/authorizations/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新失败');
      }

      toast.success('状态已更新');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleDelete = async (todoId: number) => {
    if (!confirm('确定要删除该待办事项吗？')) return;

    try {
      const res = await fetch(`/api/preparation/authorizations/todos/${todoId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '删除失败');
      }

      toast.success('待办事项已删除');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>待办事宜追踪</CardTitle>
              <CardDescription>跟踪授权申请相关待办事项</CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              添加待办
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {todos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="mx-auto h-12 w-12 mb-4" />
              <p>暂无待办事项</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>状态</TableHead>
                  <TableHead>待办事项</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>责任人</TableHead>
                  <TableHead>截止时间</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="w-16">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.map((todo) => (
                  <TableRow key={todo.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {STATUS_ICONS[todo.status]}
                        <Badge className={STATUS_COLORS[todo.status]}>
                          {STATUS_LABELS[todo.status]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{todo.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TYPE_LABELS[todo.type] || todo.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{todo.assigneeName}</TableCell>
                    <TableCell>
                      {todo.deadline
                        ? format(new Date(todo.deadline), 'yyyy-MM-dd', { locale: zhCN })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {todo.notes || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {todo.status !== 'completed' && (
                          <>
                            {todo.status !== 'in_progress' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(todo.id, 'in_progress')}
                                title="标记为进行中"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusChange(todo.id, 'completed')}
                              title="标记为完成"
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDelete(todo.id)}
                          title="删除"
                        >
                          ×
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

      {/* 添加待办事项对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加待办事项</DialogTitle>
            <DialogDescription>创建新的待办追踪事项</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>待办事项 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="输入待办事项"
              />
            </div>

            <div className="space-y-2">
              <Label>类型</Label>
              <Input
                value={TYPE_LABELS[formData.type] || formData.type}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>截止时间</Label>
              <Input
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="备注说明"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

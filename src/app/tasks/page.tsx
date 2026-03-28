'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  FileText,
  Calendar,
  User,
  ArrowRight,
  Send,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface Task {
  id: number;
  instanceId: number;
  title: string;
  nodeName: string;
  status: string;
  priority: number;
  dueTime: string | null;
  createdAt: string;
  completedAt?: string;
  result?: string;
  comment?: string;
  businessType: string;
  businessId: number;
  businessTitle: string | null;
  instanceStatus: string;
  creatorName?: string;
}

interface TaskStats {
  todoCount: number;
  doneCount: number;
  overdueCount: number;
  myInstanceCount: number;
}

interface TaskListResponse {
  data: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function TaskCenterPage() {
  const [activeTab, setActiveTab] = useState('todo');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskListResponse>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  const [stats, setStats] = useState<TaskStats>({
    todoCount: 0,
    doneCount: 0,
    overdueCount: 0,
    myInstanceCount: 0,
  });

  // 任务处理对话框
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'transfer'>('approve');
  const [comment, setComment] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [processing, setProcessing] = useState(false);

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/workflow-tasks?type=stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const type = activeTab === 'done' ? 'done' : 'todo';
      const params = new URLSearchParams();
      params.append('type', type);
      params.append('page', tasks.page.toString());
      params.append('pageSize', tasks.pageSize.toString());

      const response = await fetch(`/api/workflow-tasks?${params.toString()}`);
      if (!response.ok) throw new Error('获取失败');

      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('获取任务列表失败:', error);
      toast.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [activeTab, tasks.page]);

  // 处理任务
  const handleProcessTask = async () => {
    if (!selectedTask) return;

    try {
      setProcessing(true);
      const response = await fetch(`/api/workflow-tasks/${selectedTask.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          comment,
          transferTo: actionType === 'transfer' ? parseInt(transferTo) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '处理失败');
      }

      toast.success('处理成功');
      setProcessDialogOpen(false);
      setSelectedTask(null);
      setComment('');
      setTransferTo('');
      fetchTasks();
      fetchStats();
    } catch (error: any) {
      console.error('处理任务失败:', error);
      toast.error(error.message || '处理失败');
    } finally {
      setProcessing(false);
    }
  };

  // 打开处理对话框
  const openProcessDialog = (task: Task, action: 'approve' | 'reject' | 'transfer') => {
    setSelectedTask(task);
    setActionType(action);
    setComment('');
    setTransferTo('');
    setProcessDialogOpen(true);
  };

  // 判断是否超时
  const isOverdue = (dueTime: string | null) => {
    if (!dueTime) return false;
    return new Date(dueTime) < new Date();
  };

  // 优先级显示
  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 2:
        return <Badge className="bg-red-500">紧急</Badge>;
      case 1:
        return <Badge className="bg-orange-500">重要</Badge>;
      default:
        return <Badge variant="outline">普通</Badge>;
    }
  };

  // 状态显示
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-blue-500">待处理</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">已完成</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">已拒绝</Badge>;
      case 'transferred':
        return <Badge className="bg-purple-500">已转办</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 业务类型显示
  const getBusinessTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      document: '文档',
      project: '项目',
    };
    return typeMap[type] || type;
  };

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 页面头部 */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">任务中心</h1>
          <p className="text-gray-500 text-sm">处理待办任务，查看已办记录</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">待办任务</p>
                <p className="text-2xl font-bold">{stats.todoCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">已办任务</p>
                <p className="text-2xl font-bold">{stats.doneCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">超时任务</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.overdueCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">我发起的</p>
                <p className="text-2xl font-bold">{stats.myInstanceCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务列表 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="todo">
            待办任务
            {stats.todoCount > 0 && (
              <Badge className="ml-2 bg-blue-500">{stats.todoCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="done">已办任务</TabsTrigger>
          <TabsTrigger value="my">我发起的</TabsTrigger>
        </TabsList>

        <TabsContent value="todo">
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">加载中...</div>
            ) : tasks.data.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无待办任务
              </div>
            ) : (
              tasks.data.map((task) => (
                <Card
                  key={task.id}
                  className={`hover:shadow-md transition-shadow ${
                    isOverdue(task.dueTime) ? 'border-red-300 bg-red-50' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getPriorityBadge(task.priority)}
                          {isOverdue(task.dueTime) && (
                            <Badge className="bg-red-500">超时</Badge>
                          )}
                          {getStatusBadge(task.status)}
                        </div>
                        <h3 className="font-medium mb-1">{task.title}</h3>
                        <p className="text-sm text-gray-500 mb-2">
                          节点: {task.nodeName}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {getBusinessTypeLabel(task.businessType)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.creatorName || '未知'}
                          </span>
                          {task.dueTime && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              截止: {new Date(task.dueTime).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProcessDialog(task, 'transfer')}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          转办
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-500 hover:bg-red-50"
                          onClick={() => openProcessDialog(task, 'reject')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          驳回
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openProcessDialog(task, 'approve')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          通过
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="done">
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">加载中...</div>
            ) : tasks.data.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无已办任务
              </div>
            ) : (
              tasks.data.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(task.status)}
                          {task.result && (
                            <Badge
                              className={
                                task.result === 'approved'
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                              }
                            >
                              {task.result === 'approved' ? '通过' : '驳回'}
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-medium mb-1">{task.title}</h3>
                        <p className="text-sm text-gray-500 mb-2">
                          节点: {task.nodeName}
                        </p>
                        {task.comment && (
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            审批意见: {task.comment}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          <span>
                            处理时间:{' '}
                            {task.completedAt
                              ? new Date(task.completedAt).toLocaleString()
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="my">
          <div className="text-center py-8 text-gray-500">
            功能开发中，敬请期待...
          </div>
        </TabsContent>
      </Tabs>

      {/* 分页 */}
      {tasks.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            共 {tasks.total} 条记录
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={tasks.page === 1}
              onClick={() => setTasks({ ...tasks, page: tasks.page - 1 })}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={tasks.page === tasks.totalPages}
              onClick={() => setTasks({ ...tasks, page: tasks.page + 1 })}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* 任务处理对话框 */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && '审批通过'}
              {actionType === 'reject' && '驳回任务'}
              {actionType === 'transfer' && '转办任务'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {actionType === 'transfer' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">转办给</label>
                <Input
                  placeholder="输入目标用户ID"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                {actionType === 'transfer' ? '转办原因' : '审批意见'}
              </label>
              <Textarea
                placeholder="请输入..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProcessDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleProcessTask}
              disabled={processing}
              className={
                actionType === 'reject'
                  ? 'bg-red-500 hover:bg-red-600'
                  : ''
              }
            >
              {processing ? '处理中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

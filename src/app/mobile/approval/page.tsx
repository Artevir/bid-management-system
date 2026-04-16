'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import {
  Card,
  CardContent,
  CardDescription as _CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle as _XCircle,
  FileText,
  User,
  Calendar as _Calendar,
  Building2,
  AlertCircle,
  Loader2,
  ChevronRight,
  MessageSquare as _MessageSquare,
  Send as _Send,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  History,
  UserCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/error-message';

// 审批状态
const APPROVAL_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'yellow' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  transferred: { label: '已转办', color: 'blue' },
};

// 审批动作类型
type ApprovalAction = 'approve' | 'reject' | 'transfer';

interface ApprovalTask {
  id: number;
  workflowInstanceId: number;
  workflowName: string;
  nodeId: number;
  nodeName: string;
  projectId: number;
  projectName: string;
  documentId: number;
  documentName: string;
  status: string;
  priority: string;
  assigneeId: number;
  assigneeName: string;
  submitterId: number;
  submitterName: string;
  submitterDept: string;
  createdAt: string;
  dueDate: string | null;
  description: string;
  history: ApprovalHistory[];
}

interface ApprovalHistory {
  id: number;
  nodeName: string;
  handlerName: string;
  action: string;
  comment: string;
  handledAt: string;
}

export default function MobileApprovalPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState<ApprovalTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<ApprovalAction>('approve');
  const [comment, setComment] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<{ id: number; realName: string }[]>([]);

  // 筛选
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, [filter]);

  const fetchTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.set('status', filter);
      }

      const res = await fetch(`/api/workflow/tasks?${params}`);
      if (!res.ok) throw new Error('获取任务失败');

      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取任务失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users?pageSize=100');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('获取用户失败:', err);
    }
  };

  const handleAction = async () => {
    if (!selectedTask) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/workflow/tasks/handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: selectedTask.id,
          action: actionType,
          comment,
          transferTo: actionType === 'transfer' ? parseInt(transferTo) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '操作失败'));
      }

      toast.success(
        actionType === 'approve' ? '审批通过' : actionType === 'reject' ? '已驳回' : '已转办'
      );

      setActionDialogOpen(false);
      setDetailOpen(false);
      setSelectedTask(null);
      setComment('');
      setTransferTo('');
      fetchTasks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openActionDialog = (type: ApprovalAction) => {
    setActionType(type);
    setActionDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = APPROVAL_STATUS[status];
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      blue: 'bg-blue-100 text-blue-800',
    };
    return (
      <Badge className={colorMap[statusInfo?.color || 'yellow']}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'text-red-600',
      high: 'text-orange-600',
      normal: 'text-gray-600',
      low: 'text-gray-400',
    };
    return colors[priority] || colors.normal;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      approve: '通过',
      reject: '驳回',
      transfer: '转办',
      submit: '提交',
    };
    return labels[action] || action;
  };

  // 统计
  const stats = {
    pending: tasks.filter((t) => t.status === 'pending').length,
    approved: tasks.filter((t) => t.status === 'approved').length,
    rejected: tasks.filter((t) => t.status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">移动审批</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{stats.pending} 待处理</Badge>
          </div>
        </div>

        {/* 筛选标签 */}
        <div className="flex border-t px-4 py-2 gap-2 overflow-x-auto">
          <Button
            variant={filter === 'pending' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            待处理 ({stats.pending})
          </Button>
          <Button
            variant={filter === 'done' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('done')}
          >
            已处理
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            全部
          </Button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-20">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{String(error)}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <ListStateBlock state="loading" />
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <ListStateBlock
                state="empty"
                emptyText={filter === 'pending' ? '暂无待处理任务' : '暂无任务记录'}
              />
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className="cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => {
                setSelectedTask(task);
                setDetailOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{task.documentName}</span>
                  </div>
                  {getStatusBadge(task.status)}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{task.projectName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>
                      {task.submitterName} · {task.submitterDept}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{formatDate(task.createdAt)}</span>
                    {task.dueDate && (
                      <span className={getPriorityColor(task.priority)}>
                        截止 {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    {task.workflowName} · {task.nodeName}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>

      {/* 任务详情抽屉 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>审批详情</DialogTitle>
            <DialogDescription>查看任务详情并执行审批操作</DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{selectedTask.documentName}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedTask.projectName}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">审批流程</div>
                      <div className="font-medium">{selectedTask.workflowName}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">当前节点</div>
                      <div className="font-medium">{selectedTask.nodeName}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">提交人</div>
                      <div className="font-medium">{selectedTask.submitterName}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">提交部门</div>
                      <div className="font-medium">{selectedTask.submitterDept}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">提交时间</div>
                      <div className="font-medium">{formatDate(selectedTask.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">优先级</div>
                      <div className={`font-medium ${getPriorityColor(selectedTask.priority)}`}>
                        {selectedTask.priority === 'urgent'
                          ? '紧急'
                          : selectedTask.priority === 'high'
                            ? '高'
                            : '普通'}
                      </div>
                    </div>
                  </div>

                  {selectedTask.description && (
                    <>
                      <Separator />
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">申请说明</div>
                        <div className="text-sm bg-muted p-3 rounded-lg">
                          {selectedTask.description}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* 审批历史 */}
              {selectedTask.history && selectedTask.history.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4" />
                      审批历史
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedTask.history.map((h) => (
                      <div key={h.id} className="flex items-start gap-3 text-sm">
                        <div className="p-1 bg-muted rounded-full">
                          <UserCircle className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{h.handlerName}</span>
                            <Badge variant="outline" className="text-xs">
                              {getActionLabel(h.action)}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground">
                            {h.nodeName} · {formatDate(h.handledAt)}
                          </div>
                          {h.comment && (
                            <div className="mt-1 text-muted-foreground bg-muted p-2 rounded">
                              {h.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 审批意见 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">审批意见</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="请输入审批意见（可选）"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {selectedTask?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => openActionDialog('transfer')}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  转办
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto text-red-600 hover:text-red-700"
                  onClick={() => openActionDialog('reject')}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  驳回
                </Button>
                <Button className="w-full sm:w-auto" onClick={() => openActionDialog('approve')}>
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  通过
                </Button>
              </>
            )}
            {selectedTask?.status !== 'pending' && (
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                关闭
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认操作对话框 */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve'
                ? '确认通过'
                : actionType === 'reject'
                  ? '确认驳回'
                  : '转办给他人'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' && '确认通过此审批？'}
              {actionType === 'reject' && '确认驳回此审批？驳回后需要重新编辑。'}
              {actionType === 'transfer' && '选择转办的目标人员'}
            </DialogDescription>
          </DialogHeader>

          {actionType === 'transfer' && (
            <div className="py-4">
              <select
                className="w-full border rounded-md p-2"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
              >
                <option value="">请选择人员</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.realName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={submitting || (actionType === 'transfer' && !transferTo)}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

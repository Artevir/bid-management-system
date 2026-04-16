'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ChevronRight,
  Loader2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface PendingApproval {
  id: number;
  documentId: number;
  projectId: number;
  documentName: string;
  projectName: string;
  level: string;
  status: string;
  submittedBy: string;
  submittedAt: string;
  deadline: string | null;
}

const APPROVAL_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  first: { label: '一级审核', color: 'bg-blue-500' },
  second: { label: '二级审核', color: 'bg-purple-500' },
  third: { label: '三级审核', color: 'bg-orange-500' },
  final: { label: '终审', color: 'bg-red-500' },
};

export default function ApprovalWorkbenchPage() {
  const router = useRouter();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [historyApprovals, setHistoryApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const normalizePendingApprovals = (rawItems: any[]): PendingApproval[] => {
    return (rawItems || []).map((item) => ({
      id: item.id,
      documentId: item.documentId,
      projectId: item.document?.projectId || 0,
      documentName: item.document?.name || `文档#${item.documentId}`,
      projectName: item.document?.projectName || '-',
      level: item.level,
      status: item.status,
      submittedBy: item.createdBy ? `用户#${item.createdBy}` : '未知',
      submittedAt: item.createdAt,
      deadline: item.dueDate || null,
    }));
  };

  const fetchApprovals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bid/approvals');
      const data = await res.json();
      if (data.success) {
        setPendingApprovals(normalizePendingApprovals(data?.data || []));
      }

      // 当前后端仅返回待审核列表，避免使用无效字段导致历史区误显示
      setHistoryApprovals([]);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApproval) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/bid/approvals/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedApproval.documentId,
          level: selectedApproval.level,
          action: 'approve',
          comment: reviewComment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReviewDialogOpen(false);
        setReviewComment('');
        fetchApprovals();
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/bid/approvals/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedApproval.documentId,
          level: selectedApproval.level,
          action: 'reject',
          comment: reviewComment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReviewDialogOpen(false);
        setReviewComment('');
        fetchApprovals();
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setProcessing(false);
    }
  };

  const openReviewDialog = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setReviewDialogOpen(true);
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
          <h1 className="text-2xl font-bold">审核工作台</h1>
          <p className="text-muted-foreground">管理待审核的投标文档</p>
        </div>
        <Button variant="outline" onClick={fetchApprovals}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">待审核</p>
                <p className="text-2xl font-bold">{pendingApprovals.length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日待办</p>
                <p className="text-2xl font-bold">
                  {
                    pendingApprovals.filter(
                      (a) => new Date(a.submittedAt).toDateString() === new Date().toDateString()
                    ).length
                  }
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已通过</p>
                <p className="text-2xl font-bold">
                  {historyApprovals.filter((a) => a.status === 'approved').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已驳回</p>
                <p className="text-2xl font-bold">
                  {historyApprovals.filter((a) => a.status === 'rejected').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">待审核 ({pendingApprovals.length})</TabsTrigger>
          <TabsTrigger value="history">审核历史</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingApprovals.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无待审核任务" />
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((approval) => (
                <Card key={approval.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-yellow-100">
                          <FileText className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{approval.documentName}</span>
                            <Badge className={APPROVAL_LEVEL_LABELS[approval.level]?.color}>
                              {APPROVAL_LEVEL_LABELS[approval.level]?.label || approval.level}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            项目: {approval.projectName} · 提交人: {approval.submittedBy}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            提交时间: {new Date(approval.submittedAt).toLocaleString()}
                            {approval.deadline &&
                              ` · 截止: ${new Date(approval.deadline).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/projects/${approval.projectId}/documents`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          查看
                        </Button>
                        <Button size="sm" onClick={() => openReviewDialog(approval)}>
                          审核
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {historyApprovals.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无审核历史" />
          ) : (
            <Card>
              <CardContent className="py-4">
                <div className="space-y-2">
                  {historyApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {approval.status === 'approved' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <span className="font-medium">{approval.documentName}</span>
                          <p className="text-sm text-muted-foreground">
                            {approval.projectName} · {approval.submittedBy}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={approval.status === 'approved' ? 'default' : 'destructive'}>
                          {approval.status === 'approved' ? '已通过' : '已驳回'}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(approval.submittedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审核文档</DialogTitle>
            <DialogDescription>
              {selectedApproval?.documentName} -{' '}
              {APPROVAL_LEVEL_LABELS[selectedApproval?.level || '']?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>项目:</strong> {selectedApproval?.projectName}
              </p>
              <p className="text-sm">
                <strong>提交人:</strong> {selectedApproval?.submittedBy}
              </p>
              <p className="text-sm">
                <strong>提交时间:</strong>{' '}
                {selectedApproval?.submittedAt &&
                  new Date(selectedApproval.submittedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <Label>审核意见</Label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="请输入审核意见（可选）"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-1" />
              )}
              驳回
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-1" />
              )}
              通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

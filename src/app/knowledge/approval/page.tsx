'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  User,
  Calendar,
  MessageSquare as _MessageSquare,
  AlertCircle as _AlertCircle,
} from 'lucide-react';

// ============================================
// 类型定义
// ============================================

interface ApprovalRequest {
  stepId: number;
  requestId: number;
  itemId: number;
  itemTitle: string;
  requesterName: string;
  stepOrder: number;
  currentStep: number;
  totalSteps: number;
  createdAt: string;
}

interface ApprovalDetail {
  id: number;
  itemId: number;
  itemTitle: string;
  requesterId: number;
  requesterName: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  reason: string | null;
  createdAt: string;
  steps: ApprovalStep[];
}

interface ApprovalStep {
  id: number;
  stepOrder: number;
  reviewerId: number;
  reviewerName: string;
  action: string | null;
  comment: string | null;
  createdAt: string;
  actedAt: string | null;
}

export default function KnowledgeApprovalPage() {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionDialog, setActionDialog] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchApprovalData();
  }, []);

  async function fetchApprovalData() {
    setLoading(true);
    try {
      const [pendingRes, myRes] = await Promise.all([
        fetch('/api/knowledge/approval').catch(() => ({ json: () => ({ approvals: [] }) })),
        fetch('/api/knowledge/approval?action=my').catch(() => ({ json: () => ({ requests: [] }) })),
      ]);

      const [pendingData, myData] = await Promise.all([
        pendingRes.json(),
        myRes.json(),
      ]);

      setPendingApprovals(pendingData.approvals || []);
      setMyRequests(myData.requests || []);
    } catch (error) {
      console.error('Failed to fetch approval data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRequestDetail(requestId: number) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/knowledge/approval?action=detail&requestId=${requestId}`);
      const data = await res.json();
      if (data.detail) {
        setSelectedRequest(data.detail);
      }
    } catch (error) {
      console.error('Failed to fetch request detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAction() {
    if (!selectedRequest || !actionDialog) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/knowledge/approval?action=process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: actionDialog,
          comment,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // 刷新列表
        fetchApprovalData();
        setSelectedRequest(null);
        setActionDialog(null);
        setComment('');
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to process approval:', error);
      alert('操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: '待处理' },
      approved: { variant: 'default', label: '已通过' },
      rejected: { variant: 'destructive', label: '已拒绝' },
      returned: { variant: 'outline', label: '已退回' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">知识审批中心</h1>
          <p className="text-muted-foreground">管理知识入库审批流程</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {pendingApprovals.length} 个待处理
        </Badge>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            待处理 ({pendingApprovals.length})
          </TabsTrigger>
          <TabsTrigger value="my">
            我的申请 ({myRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* 待处理列表 */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>待审批知识条目</CardTitle>
              <CardDescription>以下知识条目等待您审批</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : pendingApprovals.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-muted-foreground">暂无待处理审批</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApprovals.map((approval) => (
                    <div
                      key={approval.stepId}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => fetchRequestDetail(approval.requestId)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 rounded-full bg-blue-100">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{approval.itemTitle}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {approval.requesterName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(approval.createdAt).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">
                          步骤 {approval.stepOrder}/{approval.totalSteps}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 我的申请 */}
        <TabsContent value="my">
          <Card>
            <CardHeader>
              <CardTitle>我的申请记录</CardTitle>
              <CardDescription>查看您提交的审批申请状态</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : myRequests.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  暂无申请记录
                </div>
              ) : (
                <div className="space-y-4">
                  {myRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">申请 #{request.id}</p>
                        <p className="text-sm text-muted-foreground">
                          提交于 {new Date(request.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 审批详情弹窗 */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          {detailLoading ? (
            <div className="py-12">
              <Skeleton className="h-[400px] w-full" />
            </div>
          ) : selectedRequest ? (
            <>
              <DialogHeader>
                <DialogTitle>审批详情</DialogTitle>
                <DialogDescription>
                  知识条目: {selectedRequest.itemTitle}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">申请人</p>
                    <p className="font-medium">{selectedRequest.requesterName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">当前状态</p>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">提交时间</p>
                    <p>{new Date(selectedRequest.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">审批进度</p>
                    <p>{selectedRequest.currentStep} / {selectedRequest.totalSteps} 步</p>
                  </div>
                </div>

                {/* 申请说明 */}
                {selectedRequest.reason && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">申请说明</p>
                    <p className="p-3 rounded-lg bg-muted">{selectedRequest.reason}</p>
                  </div>
                )}

                {/* 审批流程 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">审批流程</p>
                  <div className="space-y-2">
                    {selectedRequest.steps.map((step) => (
                      <div
                        key={step.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          step.action ? 'bg-muted/50' : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            step.action === 'approve' ? 'bg-green-100' :
                            step.action === 'reject' ? 'bg-red-100' :
                            step.action === 'return' ? 'bg-orange-100' :
                            'bg-gray-100'
                          }`}>
                            {step.action === 'approve' && <CheckCircle className="h-4 w-4 text-green-600" />}
                            {step.action === 'reject' && <XCircle className="h-4 w-4 text-red-600" />}
                            {step.action === 'return' && <RotateCcw className="h-4 w-4 text-orange-600" />}
                            {!step.action && <Clock className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div>
                            <p className="font-medium">{step.reviewerName}</p>
                            <p className="text-xs text-muted-foreground">
                              步骤 {step.stepOrder}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {step.action ? (
                            <>
                              {getStatusBadge(step.action)}
                              {step.comment && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {step.comment}
                                </p>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline">待处理</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  onClick={() => setActionDialog('reject')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  拒绝
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActionDialog('return')}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  退回
                </Button>
                <Button onClick={() => setActionDialog('approve')}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  通过
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 操作确认弹窗 */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'approve' && '确认通过'}
              {actionDialog === 'reject' && '确认拒绝'}
              {actionDialog === 'return' && '确认退回'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog === 'approve' && '通过后知识条目将进入下一审批步骤'}
              {actionDialog === 'reject' && '拒绝后知识条目将返回给申请人'}
              {actionDialog === 'return' && '退回后申请人可以修改后重新提交'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                审批意见
                {actionDialog !== 'approve' && <span className="text-red-500">*</span>}
              </p>
              <Textarea
                placeholder="请输入审批意见..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              取消
            </Button>
            <Button
              variant={actionDialog === 'approve' ? 'default' : actionDialog === 'reject' ? 'destructive' : 'outline'}
              onClick={handleAction}
              disabled={submitting || (actionDialog !== 'approve' && !comment.trim())}
            >
              {submitting ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

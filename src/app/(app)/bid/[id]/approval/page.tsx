/**
 * 投标文档审批流程页面
 * 展示文档审批状态和历史
 */

'use client';

import { useState, useEffect, useCallback as _useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription as _CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  User,
  Calendar as _Calendar,
  FileText as _FileText,
  Plus,
  Eye,
  MessageSquare,
} from 'lucide-react';

interface ApprovalFlow {
  id: number;
  level: string;
  status: string;
  assigneeId: number;
  assigneeName: string;
  assignedAt: string;
  dueDate: string | null;
  completedAt: string | null;
  comment: string | null;
}

interface DocumentDetail {
  id: number;
  name: string;
  status: string;
  currentApprovalLevel: string | null;
}

export default function BidApprovalPage() {
  const _router = useRouter();
  const params = useParams();
  const documentId = params.id as string;
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [approvalFlows, setApprovalFlows] = useState<ApprovalFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; flowId: number | null }>({
    open: false,
    flowId: null,
  });
  const [reviewComment, setReviewComment] = useState('');
  const [reviewResult, setReviewResult] = useState<'approved' | 'rejected'>('approved');

  useEffect(() => {
    if (documentId) {
      loadDocumentDetail();
      loadApprovalFlows();
    }
  }, [documentId, statusFilter]);

  const loadDocumentDetail = async () => {
    try {
      const response = await fetch(`/api/bid/documents/${documentId}`);
      const data = await response.json();
      if (data.success) {
        setDocument(data.data);
      }
    } catch (error) {
      console.error('Failed to load document:', error);
    }
  };

  const loadApprovalFlows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('documentId', documentId);
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/bid/documents/approval?${params}`);
      const data = await response.json();
      if (data.success) {
        setApprovalFlows(data.data);
      }
    } catch (error) {
      console.error('Failed to load approval flows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewDialog.flowId) return;

    try {
      const response = await fetch(`/api/bid/documents/approval/${reviewDialog.flowId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: reviewResult,
          comment: reviewComment,
        }),
      });

      if (response.ok) {
        setReviewDialog({ open: false, flowId: null });
        setReviewComment('');
        loadApprovalFlows();
        loadDocumentDetail();
      }
    } catch (error) {
      console.error('Failed to review approval:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'returned':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待审批',
      approved: '已通过',
      rejected: '已拒绝',
      returned: '已退回',
    };
    return labels[status] || status;
  };

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      first: '一级审批',
      second: '二级审批',
      third: '三级审批',
      final: '终审',
    };
    return labels[level] || level;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">审批流程</h1>
          <p className="text-gray-500 mt-1">
            {document ? `文档：${document.name}` : '加载中...'}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          创建审批
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              总审批节点
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvalFlows.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              待审批
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {approvalFlows.filter((f) => f.status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              已通过
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {approvalFlows.filter((f) => f.status === 'approved').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              已拒绝
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {approvalFlows.filter((f) => f.status === 'rejected').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 当前审批状态 */}
      {document && document.currentApprovalLevel && (
        <Card>
          <CardHeader>
            <CardTitle>当前审批状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge className="bg-blue-100 text-blue-800">
                {getLevelLabel(document.currentApprovalLevel)}
              </Badge>
              <span className="text-gray-500">审批进行中</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 主要内容 */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">审批列表</TabsTrigger>
          <TabsTrigger value="timeline">审批时间线</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>审批流程</CardTitle>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="pending">待审批</SelectItem>
                      <SelectItem value="approved">已通过</SelectItem>
                      <SelectItem value="rejected">已拒绝</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={loadApprovalFlows}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : approvalFlows.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>暂无审批流程</p>
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    创建审批流程
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>审批级别</TableHead>
                      <TableHead>审批人</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>分配时间</TableHead>
                      <TableHead>截止时间</TableHead>
                      <TableHead>完成时间</TableHead>
                      <TableHead>审批意见</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalFlows.map((flow) => (
                      <TableRow key={flow.id}>
                        <TableCell>
                          <Badge variant="outline">{getLevelLabel(flow.level)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            {flow.assigneeName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(flow.status)}
                            <span>{getStatusLabel(flow.status)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(flow.assignedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {flow.dueDate ? new Date(flow.dueDate).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          {flow.completedAt ? new Date(flow.completedAt).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          {flow.comment ? (
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">{flow.comment}</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {flow.status === 'pending' && (
                            <Dialog
                              open={reviewDialog.open && reviewDialog.flowId === flow.id}
                              onOpenChange={(open) => setReviewDialog({ open, flowId: flow.id })}
                            >
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>审批文档</DialogTitle>
                                  <DialogDescription>
                                    请对该文档进行审批
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <label className="text-sm font-medium">审批结果</label>
                                    <Select value={reviewResult} onValueChange={(v) => setReviewResult(v as 'approved' | 'rejected')}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="approved">通过</SelectItem>
                                        <SelectItem value="rejected">拒绝</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">审批意见</label>
                                    <Textarea
                                      value={reviewComment}
                                      onChange={(e) => setReviewComment(e.target.value)}
                                      placeholder="请输入审批意见"
                                      rows={4}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setReviewDialog({ open: false, flowId: null })}>
                                    取消
                                  </Button>
                                  <Button onClick={handleReview}>提交</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>审批时间线</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {approvalFlows.map((flow, index) => (
                  <div key={flow.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        flow.status === 'approved' ? 'bg-green-100 text-green-600' :
                        flow.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        flow.status === 'pending' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {getStatusIcon(flow.status)}
                      </div>
                      {index < approvalFlows.length - 1 && (
                        <div className="w-0.5 h-16 bg-gray-200" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{getLevelLabel(flow.level)}</p>
                          <p className="text-sm text-gray-500">
                            审批人: {flow.assigneeName}
                          </p>
                        </div>
                        <Badge
                          variant={
                            flow.status === 'approved' ? 'default' :
                            flow.status === 'rejected' ? 'destructive' :
                            flow.status === 'pending' ? 'secondary' :
                            'outline'
                          }
                        >
                          {getStatusLabel(flow.status)}
                        </Badge>
                      </div>
                      {flow.dueDate && (
                        <p className="text-sm text-gray-500 mt-2">
                          截止时间: {new Date(flow.dueDate).toLocaleString()}
                        </p>
                      )}
                      {flow.comment && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          {flow.comment}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  FileText,
  ChevronRight,
  User,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';

interface ApprovalItem {
  id: number;
  documentId: number;
  document: {
    id: number;
    name: string;
    project?: { name: string };
    status: string;
  };
  record: {
    id: number;
    level: number;
    status: string;
    dueDate?: string;
  };
  currentLevel: number;
  status: string;
  createdAt: string;
}

interface ReviewResult {
  score: number;
  passed: boolean;
  summary: string;
  statistics: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  issues: Array<{
    id: string;
    type: string;
    message: string;
    suggestion?: string;
    location?: {
      chapterTitle?: string;
    };
  }>;
}

export default function ApprovalPage() {
  const router = useRouter();
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  async function fetchPendingApprovals() {
    try {
      const response = await fetch('/api/bid/approval');
      const data = await response.json();
      setPendingApprovals(data.approvals || []);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReviewResult(documentId: number) {
    setReviewLoading(true);
    try {
      const response = await fetch(`/api/bid/review?documentId=${documentId}`);
      const data = await response.json();
      // 获取最新的审校结果
      if (data.reviews && data.reviews.length > 0) {
        const latest = data.reviews[0];
        setReviewResult({
          score: latest.score,
          passed: latest.status === 'completed',
          summary: latest.result?.summary || '',
          statistics: latest.result?.statistics || { total: 0, errors: 0, warnings: 0, infos: 0 },
          issues: latest.issues || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch review result:', error);
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleApprovalAction() {
    if (!selectedApproval) return;

    try {
      const response = await fetch('/api/bid/approval?action=execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowId: selectedApproval.id,
          action: actionType,
          comment,
        }),
      });

      if (response.ok) {
        setActionDialogOpen(false);
        setSelectedApproval(null);
        setComment('');
        fetchPendingApprovals();
      }
    } catch (error) {
      console.error('Failed to execute approval:', error);
    }
  }

  function openActionDialog(type: 'approve' | 'reject') {
    setActionType(type);
    setActionDialogOpen(true);
  }

  const getLevelLabel = (level: number) => {
    const labels = ['', '初审', '复审', '终审', '批准'];
    return labels[level] || `第${level}级`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">审核中心</h1>
        <p className="text-muted-foreground">处理待审核的标书文档</p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            待审核 ({pendingApprovals.length})
          </TabsTrigger>
          <TabsTrigger value="history">审核历史</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : pendingApprovals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无待审核文档</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingApprovals.map((approval) => (
                <Card
                  key={approval.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedApproval(approval);
                    fetchReviewResult(approval.documentId);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{approval.document.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{approval.document.project?.name || '未关联项目'}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(approval.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {getLevelLabel(approval.record.level)}
                        </Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>审核历史记录将在此显示</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 审核详情对话框 */}
      <Dialog
        open={!!selectedApproval}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedApproval(null);
            setReviewResult(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>审核文档</DialogTitle>
            <DialogDescription>
              查看文档详情并执行审核操作
            </DialogDescription>
          </DialogHeader>

          {selectedApproval && (
            <div className="space-y-4">
              {/* 文档信息 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-10 w-10 text-primary" />
                    <div>
                      <h3 className="font-medium">{selectedApproval.document.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedApproval.document.project?.name}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 审校结果 */}
              {reviewLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : reviewResult ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">智能审校结果</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {reviewResult.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        )}
                        <span className="font-medium">
                          评分: {reviewResult.score}/100
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-red-500">
                          {reviewResult.statistics.errors} 错误
                        </span>
                        <span className="text-yellow-500">
                          {reviewResult.statistics.warnings} 警告
                        </span>
                        <span className="text-blue-500">
                          {reviewResult.statistics.infos} 提示
                        </span>
                      </div>
                    </div>
                    {reviewResult.summary && (
                      <p className="text-sm text-muted-foreground">
                        {reviewResult.summary}
                      </p>
                    )}
                    {reviewResult.issues.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {reviewResult.issues.slice(0, 5).map((issue) => (
                          <div
                            key={issue.id}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Badge
                              variant={
                                issue.type === 'error'
                                  ? 'destructive'
                                  : issue.type === 'warning'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {issue.type}
                            </Badge>
                            <span>
                              {issue.location?.chapterTitle && (
                                <span className="text-muted-foreground">
                                  [{issue.location.chapterTitle}]{' '}
                                </span>
                              )}
                              {issue.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>暂无审校结果</p>
                  </CardContent>
                </Card>
              )}

              {/* 审核意见 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">审核意见</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="请输入审核意见（可选）"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedApproval) {
                  router.push(`/bid/${selectedApproval.documentId}`);
                }
              }}
            >
              查看详情
            </Button>
            <Button
              variant="outline"
              className="text-red-600"
              onClick={() => openActionDialog('reject')}
            >
              <XCircle className="mr-2 h-4 w-4" />
              驳回
            </Button>
            <Button onClick={() => openActionDialog('approve')}>
              <CheckCircle className="mr-2 h-4 w-4" />
              通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认操作对话框 */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? '确认通过' : '确认驳回'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? '确认通过此文档的审核？'
                : '确认驳回此文档？驳回后需要重新编辑。'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              onClick={handleApprovalAction}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

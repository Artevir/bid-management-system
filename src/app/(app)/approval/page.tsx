'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader as _CardHeader, CardTitle as _CardTitle } from '@/components/ui/card';
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
  AlertCircle as _AlertCircle,
} from 'lucide-react';
import { useApprovals, useExecuteApproval } from '@/hooks/use-bid';
import { APPROVAL_STATUS_MAP as _APPROVAL_STATUS_MAP } from '@/lib/constants/bid-ui';

export default function ApprovalPage() {
  const _router = useRouter();
  
  // --- 服务端状态 (React Query) ---
  const { data: approvals = [], isLoading: loadingApprovals } = useApprovals();
  const executeApprovalMutation = useExecuteApproval();

  // --- 本地交互状态 ---
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState('');

  // --- 事件处理 ---
  async function handleApprovalAction() {
    if (!selectedApproval) return;

    await executeApprovalMutation.mutateAsync({
      documentId: selectedApproval.documentId,
      level: selectedApproval.level,
      action: actionType,
      comment,
    });

    setActionDialogOpen(false);
    setSelectedApproval(null);
    setComment('');
  }

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      first: '初审',
      second: '复审',
      third: '终审',
      final: '批准',
    };
    return labels[level] || level;
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
            待审核 ({approvals.length})
          </TabsTrigger>
          <TabsTrigger value="history">审核历史</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loadingApprovals ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : approvals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无待审核文档</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {approvals.map((approval: any) => (
                <Card
                  key={approval.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedApproval(approval)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{approval.documentName}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{approval.projectName || '未关联项目'}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(approval.assignedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {getLevelLabel(approval.level)}
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
          if (!open) setSelectedApproval(null);
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
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-10 w-10 text-primary" />
                    <div>
                      <h3 className="font-medium">{selectedApproval.documentName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedApproval.projectName}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    setActionType('reject');
                    setActionDialogOpen(true);
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  驳回
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setActionType('approve');
                    setActionDialogOpen(true);
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  通过
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 审批操作对话框 */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === 'approve' ? '审批通过' : '审批驳回'}</DialogTitle>
            <DialogDescription>
              请输入您的审批意见（可选）。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="请输入审批意见..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              onClick={handleApprovalAction}
              disabled={executeApprovalMutation.isPending}
            >
              {executeApprovalMutation.isPending ? '提交中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea as _ScrollArea } from '@/components/ui/scroll-area';
import { Separator as _Separator } from '@/components/ui/separator';
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
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Loader2,
  User,
  Calendar,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PendingReview {
  review: {
    id: number;
    documentId: number;
    reviewType: string;
    status: string;
    submittedBy: number;
    submittedAt: string;
    createdAt: string;
  };
  document: {
    id: number;
    name: string;
    projectId: number;
    status: string;
    totalChapters: number;
    completedChapters: number;
    wordCount: number;
    createdAt: string;
  };
}

interface DocumentReviewPanelProps {
  projectId?: number;
  onReviewComplete?: () => void;
}

export function DocumentReviewPanel({
  projectId,
  onReviewComplete,
}: DocumentReviewPanelProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewComments, setReviewComments] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadPendingReviews();
  }, [projectId]);

  const loadPendingReviews = async () => {
    setLoading(true);
    try {
      const url = projectId
        ? `/api/bid/documents/review?projectId=${projectId}`
        : '/api/bid/documents/review';
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setReviews(result.data);
      }
    } catch (error) {
      console.error('Load pending reviews error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (result: 'approved' | 'rejected') => {
    if (!selectedReview) return;

    setReviewing(true);
    try {
      const response = await fetch('/api/bid/documents/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: selectedReview.document.id,
          reviewId: selectedReview.review.id,
          result,
          comments: reviewComments,
        }),
      });

      const res = await response.json();
      if (res.success) {
        toast({
          title: result === 'approved' ? '审核通过' : '审核拒绝',
          description: res.message,
        });
        setReviewDialogOpen(false);
        setSelectedReview(null);
        setReviewComments('');
        loadPendingReviews();
        onReviewComplete?.();
      } else {
        throw new Error(res.error || '审核失败');
      }
    } catch (error: any) {
      toast({
        title: '审核失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setReviewing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            待审核
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            已通过
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            已拒绝
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>暂无待审核的AI生成文档</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {reviews.map((item) => (
          <Card key={item.review.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{item.document.name}</CardTitle>
                  <CardDescription>
                    共 {item.document.totalChapters} 个章节 · {item.document.wordCount} 字
                  </CardDescription>
                </div>
                {getStatusBadge(item.review.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(item.review.submittedAt), 'yyyy-MM-dd HH:mm')}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    提交人
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/bid/documents/${item.document.id}`)}
                  >
                    查看详情
                  </Button>
                  {item.review.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedReview(item);
                        setReviewDialogOpen(true);
                      }}
                    >
                      审核
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 审核对话框 */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审核AI生成文档</DialogTitle>
            <DialogDescription>
              请仔细审核文档内容，确保符合要求后再通过
            </DialogDescription>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{selectedReview.document.name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  共 {selectedReview.document.totalChapters} 个章节 ·{' '}
                  {selectedReview.document.wordCount} 字
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">审核意见（可选）</label>
                <Textarea
                  placeholder="请输入审核意见..."
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview('rejected')}
              disabled={reviewing}
            >
              {reviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              拒绝
            </Button>
            <Button onClick={() => handleReview('approved')} disabled={reviewing}>
              {reviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DocumentReviewPanel;

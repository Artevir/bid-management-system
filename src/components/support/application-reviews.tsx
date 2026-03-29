/**
 * 审核记录组件
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  XCircle,
  Clock as _Clock,
  Loader2,
  AlertCircle as _AlertCircle,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Review {
  id: number;
  stage: string;
  reviewerId: number;
  reviewerName: string;
  result: string;
  comment: string | null;
  exceptionHandling: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface ApplicationReviewsProps {
  applicationId: number;
  reviews: Review[];
  canReview: boolean;
  onUpdate: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  completeness: '材料完整性审核',
  authenticity: '材料真实性审核',
  compliance: '授权合规性审核',
  final: '最终授权审核',
};

const STAGE_ORDER = ['completeness', 'authenticity', 'compliance', 'final'];

const RESULT_LABELS: Record<string, string> = {
  pending: '未审核',
  approved: '审核通过',
  rejected: '审核驳回',
};

const RESULT_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const EXCEPTION_HANDLING_OPTIONS = [
  { value: 'none', label: '无需处理' },
  { value: 'supplement', label: '补充材料' },
  { value: 'resubmit', label: '重新提交' },
  { value: 'verify', label: '核实材料' },
  { value: 'adjust', label: '调整授权' },
  { value: 'terminate', label: '终止申请' },
];

export function ApplicationReviews({
  applicationId,
  reviews,
  canReview,
  onUpdate,
}: ApplicationReviewsProps) {
  const [submittingReview, setSubmittingReview] = useState<number | null>(null);
  const [reviewForms, setReviewForms] = useState<Record<number, { result: string; comment: string; exceptionHandling: string }>>({});

  const handleReviewSubmit = async (reviewId: number) => {
    const form = reviewForms[reviewId];
    if (!form || !form.result) {
      toast.error('请选择审核结果');
      return;
    }

    setSubmittingReview(reviewId);
    try {
      const res = await fetch(`/api/preparation/authorizations/${applicationId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_review',
          reviewId,
          result: form.result,
          comment: form.comment,
          exceptionHandling: form.exceptionHandling,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '审核提交失败');
      }

      toast.success('审核已提交');
      setReviewForms(prev => {
        const newForms = { ...prev };
        delete newForms[reviewId];
        return newForms;
      });
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '审核提交失败');
    } finally {
      setSubmittingReview(null);
    }
  };

  const updateReviewForm = (reviewId: number, field: string, value: string) => {
    setReviewForms(prev => ({
      ...prev,
      [reviewId]: {
        ...prev[reviewId],
        result: prev[reviewId]?.result || '',
        comment: prev[reviewId]?.comment || '',
        exceptionHandling: prev[reviewId]?.exceptionHandling || '',
        [field]: value,
      },
    }));
  };

  // 按顺序排列审核环节
  const sortedReviews = STAGE_ORDER.map(stage => 
    reviews.find(r => r.stage === stage)
  ).filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>审核记录</CardTitle>
        <CardDescription>授权申请审核流程</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedReviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileCheck className="mx-auto h-12 w-12 mb-4" />
            <p>暂无审核记录</p>
            <p className="text-sm">提交申请后将自动创建审核流程</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedReviews.map((review, index) => {
              if (!review) return null;
              const isCompleted = review.result !== 'pending';
              const isCurrent = !isCompleted && (index === 0 || sortedReviews[index - 1]?.result === 'approved');
              const canSubmitThis = canReview && isCurrent;
              const form = reviewForms[review.id] || { result: '', comment: '', exceptionHandling: '' };

              return (
                <div
                  key={review.id}
                  className={`border rounded-lg p-4 ${isCurrent ? 'border-blue-200 bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? review.result === 'approved'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                          : isCurrent
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          review.result === 'approved' ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">{STAGE_LABELS[review.stage]}</h4>
                        <p className="text-sm text-muted-foreground">审核人: {review.reviewerName}</p>
                      </div>
                    </div>
                    <Badge className={RESULT_COLORS[review.result]}>
                      {RESULT_LABELS[review.result]}
                    </Badge>
                  </div>

                  {isCompleted && (
                    <div className="mb-4 text-sm">
                      {review.comment && (
                        <div className="mb-2">
                          <span className="text-muted-foreground">审核意见: </span>
                          <span>{review.comment}</span>
                        </div>
                      )}
                      {review.exceptionHandling && review.exceptionHandling !== 'none' && (
                        <div>
                          <span className="text-muted-foreground">异常处理: </span>
                          <span>{EXCEPTION_HANDLING_OPTIONS.find(o => o.value === review.exceptionHandling)?.label || review.exceptionHandling}</span>
                        </div>
                      )}
                      {review.reviewedAt && (
                        <div className="text-muted-foreground mt-2">
                          审核时间: {format(new Date(review.reviewedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                        </div>
                      )}
                    </div>
                  )}

                  {canSubmitThis && (
                    <div className="space-y-3 border-t pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>审核结果 *</Label>
                          <Select
                            value={form.result}
                            onValueChange={(v) => updateReviewForm(review.id, 'result', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择审核结果" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="approved">审核通过</SelectItem>
                              <SelectItem value="rejected">审核驳回</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>异常处理</Label>
                          <Select
                            value={form.exceptionHandling || 'none'}
                            onValueChange={(v) => updateReviewForm(review.id, 'exceptionHandling', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EXCEPTION_HANDLING_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>审核意见</Label>
                        <Textarea
                          value={form.comment}
                          onChange={(e) => updateReviewForm(review.id, 'comment', e.target.value)}
                          placeholder="填写审核意见，驳回时请说明原因..."
                          rows={2}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleReviewSubmit(review.id)}
                          disabled={submittingReview === review.id || !form.result}
                        >
                          {submittingReview === review.id && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          提交审核
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

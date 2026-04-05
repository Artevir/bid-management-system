'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  Search,
  BarChart3,
  Trash2,
  PieChart,
  Download,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';

interface InterpretationReview {
  id: number;
  documentName: string;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  status: 'pending' | 'parsing' | 'completed' | 'failed';
  reviewStatus: 'pending' | 'approved' | 'rejected' | null;
  extractAccuracy: number | null;
  reviewAccuracy: number | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  specCount: number;
  scoringCount: number;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

const statusConfig = {
  pending: { label: '待解析', color: 'bg-gray-100 text-gray-800', icon: Clock },
  parsing: { label: '解析中', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { label: '解析失败', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const reviewStatusConfig = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function InterpretationApprovalPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<InterpretationReview[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedReview, setSelectedReview] = useState<InterpretationReview | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportForm, setExportForm] = useState({
    format: 'excel',
    includeReviewInfo: true,
  });
  const [reviewForm, setReviewForm] = useState({
    action: 'approve' as 'approve' | 'reject',
    accuracy: 90,
    comment: '',
  });
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') {
        params.append('reviewStatus', status);
      }
      params.append('status', 'completed');
      params.append('pageSize', '100');

      const response = await fetch(`/api/interpretations?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setReviews(result.data.list || []);
        setStats(result.stats || { total: 0, pending: 0, approved: 0, rejected: 0 });
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab === 'all' ? undefined : activeTab);
  }, [activeTab, fetchData]);

  const handleOpenReview = (review: InterpretationReview) => {
    setSelectedReview(review);
    setReviewForm({
      action: 'approve',
      accuracy: review.extractAccuracy || 90,
      comment: '',
    });
    setReviewDialogOpen(true);
  };

  const handleReview = async () => {
    if (!selectedReview) return;
    setProcessing(true);
    try {
      const response = await fetch(`/api/interpretations/${selectedReview.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewForm.action,
          accuracy: reviewForm.accuracy,
          comment: reviewForm.comment,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert(result.message);
        setReviewDialogOpen(false);
        fetchData(activeTab === 'all' ? undefined : activeTab);
      } else {
        alert(result.message || '审核失败');
      }
    } catch (error) {
      console.error('审核失败:', error);
      alert('审核失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchReview = async () => {
    if (selectedIds.length === 0) return;
    setProcessing(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (const id of selectedIds) {
        try {
          const res = await fetch(`/api/interpretations/${id}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: reviewForm.action,
              accuracy: reviewForm.accuracy,
              comment: reviewForm.comment,
            }),
          });
          const result = await res.json();
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }
      alert(`批量操作完成：成功${successCount}项${failCount > 0 ? `，失败${failCount}项` : ''}`);
      setBatchDialogOpen(false);
      setSelectedIds([]);
      fetchData(activeTab === 'all' ? undefined : activeTab);
    } catch (error) {
      console.error('批量审核失败:', error);
      alert('批量审核失败');
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredReviews.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReviews.map(r => r.id));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingReviews = reviews.filter(r => r.reviewStatus === 'pending' || !r.reviewStatus);
  const approvedReviews = reviews.filter(r => r.reviewStatus === 'approved');
  const rejectedReviews = reviews.filter(r => r.reviewStatus === 'rejected');
  const filteredReviews = activeTab === 'pending' ? pendingReviews : activeTab === 'approved' ? approvedReviews : activeTab === 'rejected' ? rejectedReviews : reviews;

  const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: number; icon: React.ElementType; color: string }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">解读审核</h1>
          <p className="text-muted-foreground">审核招标文件AI解读结果</p>
        </div>
        <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
          <Download className="w-4 h-4 mr-2" />
          导出审核结果
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="总记录" value={stats.total} icon={FileText} color="bg-gray-100" />
        <StatCard title="待审核" value={stats.pending} icon={Clock} color="bg-yellow-100" />
        <StatCard title="已通过" value={stats.approved} icon={CheckCircle} color="bg-green-100" />
        <StatCard title="已驳回" value={stats.rejected} icon={XCircle} color="bg-red-100" />
      </div>

      {/* 审核统计图表 */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                审核状态分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">待审核</span>
                  </div>
                  <span className="font-medium">{stats.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">已通过</span>
                  </div>
                  <span className="font-medium">{stats.approved}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">已驳回</span>
                  </div>
                  <span className="font-medium">{stats.rejected}</span>
                </div>
                {stats.total > 0 && (
                  <div className="pt-2 border-t">
                    <div className="h-2 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-yellow-500" 
                        style={{ width: `${(stats.pending / stats.total) * 100}%` }} 
                      />
                      <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${(stats.approved / stats.total) * 100}%` }} 
                      />
                      <div 
                        className="h-full bg-red-500" 
                        style={{ width: `${(stats.rejected / stats.total) * 100}%` }} 
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      通过率: {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            待审核 ({pendingReviews.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            已通过 ({approvedReviews.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            已驳回 ({rejectedReviews.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            全部 ({reviews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardContent className="p-0">
              {/* 批量操作栏 */}
              {pendingReviews.length > 0 && (
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.length === filteredReviews.length && filteredReviews.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.length > 0 ? `已选择 ${selectedIds.length} 项` : '全选'}
                    </span>
                  </div>
                  {selectedIds.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReviewForm({ ...reviewForm, action: 'approve' });
                          setBatchDialogOpen(true);
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        批量通过
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReviewForm({ ...reviewForm, action: 'reject' });
                          setBatchDialogOpen(true);
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        批量驳回
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  暂无数据
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.length === filteredReviews.length && filteredReviews.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>文件名称</TableHead>
                      <TableHead>项目名称</TableHead>
                      <TableHead>招标单位</TableHead>
                      <TableHead>解析状态</TableHead>
                      <TableHead>提取精度</TableHead>
                      <TableHead>审核状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReviews.map((review) => {
                      const statusInfo = statusConfig[review.status];
                      const reviewStatusInfo = review.reviewStatus ? reviewStatusConfig[review.reviewStatus] : null;
                      const isPending = review.reviewStatus === 'pending' || !review.reviewStatus;

                      return (
                        <TableRow key={review.id}>
                          <TableCell>
                            {isPending && (
                              <Checkbox
                                checked={selectedIds.includes(review.id)}
                                onCheckedChange={() => toggleSelect(review.id)}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{review.documentName}</span>
                            </div>
                          </TableCell>
                          <TableCell>{review.projectName || '-'}</TableCell>
                          <TableCell>{review.tenderOrganization || '-'}</TableCell>
                          <TableCell>
                            <Badge className={statusInfo.color}>
                              <statusInfo.icon className="w-3 h-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {review.extractAccuracy ? `${review.extractAccuracy}%` : '-'}
                          </TableCell>
                          <TableCell>
                            {reviewStatusInfo ? (
                              <Badge className={reviewStatusInfo.color}>
                                <reviewStatusInfo.icon className="w-3 h-3 mr-1" />
                                {reviewStatusInfo.label}
                              </Badge>
                            ) : (
                              <Badge variant="outline">待审核</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(review.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/interpretations/${review.id}`}>
                                  <Eye className="w-4 h-4 mr-1" />
                                  查看
                                </Link>
                              </Button>
                              {(review.reviewStatus === 'pending' || !review.reviewStatus) && (
                                <Button variant="outline" size="sm" onClick={() => handleOpenReview(review)}>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  审核
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 审核对话框 */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>审核解读结果</DialogTitle>
            <DialogDescription>
              {selectedReview?.documentName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>审核结果</Label>
              <div className="flex gap-2">
                <Button
                  variant={reviewForm.action === 'approve' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setReviewForm({ ...reviewForm, action: 'approve' })}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  通过
                </Button>
                <Button
                  variant={reviewForm.action === 'reject' ? 'destructive' : 'outline'}
                  className="flex-1"
                  onClick={() => setReviewForm({ ...reviewForm, action: 'reject' })}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  驳回
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>准确率评分: {reviewForm.accuracy}%</Label>
              <input
                type="range"
                min="0"
                max="100"
                value={reviewForm.accuracy}
                onChange={(e) => setReviewForm({ ...reviewForm, accuracy: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>审核意见</Label>
              <Textarea
                placeholder="请输入审核意见..."
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleReview} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              提交审核
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量审核对话框 */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量审核</DialogTitle>
            <DialogDescription>
              选中 {selectedIds.length} 项进行{reviewForm.action === 'approve' ? '通过' : '驳回'}操作
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>准确率评分: {reviewForm.accuracy}%</Label>
              <input
                type="range"
                min="0"
                max="100"
                value={reviewForm.accuracy}
                onChange={(e) => setReviewForm({ ...reviewForm, accuracy: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>审核意见</Label>
              <Textarea
                placeholder="请输入审核意见..."
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleBatchReview} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              确认{reviewForm.action === 'approve' ? '通过' : '驳回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审核结果导出对话框 */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>导出审核结果</DialogTitle>
            <DialogDescription>
              将审核结果导出为文件
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>导出格式</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={exportForm.format === 'excel' ? 'default' : 'outline'}
                  onClick={() => setExportForm({ ...exportForm, format: 'excel' })}
                  className="flex flex-col h-16"
                >
                  <FileSpreadsheet className="w-5 h-5 mb-1" />
                  <span className="text-xs">Excel</span>
                </Button>
                <Button
                  variant={exportForm.format === 'json' ? 'default' : 'outline'}
                  onClick={() => setExportForm({ ...exportForm, format: 'json' })}
                  className="flex flex-col h-16"
                >
                  <FileJson className="w-5 h-5 mb-1" />
                  <span className="text-xs">JSON</span>
                </Button>
                <Button
                  variant={exportForm.format === 'csv' ? 'default' : 'outline'}
                  onClick={() => setExportForm({ ...exportForm, format: 'csv' })}
                  className="flex flex-col h-16"
                >
                  <FileText className="w-5 h-5 mb-1" />
                  <span className="text-xs">CSV</span>
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeReviewInfo"
                checked={exportForm.includeReviewInfo}
                onChange={(e) => setExportForm({ ...exportForm, includeReviewInfo: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="includeReviewInfo">包含审核信息（审核人、审核时间、审核意见）</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              取消
            </Button>
            <Button asChild>
              <Link
                href={`/api/interpretations/export-review?format=${exportForm.format}&includeReviewInfo=${exportForm.includeReviewInfo}&status=${activeTab}`}
                target="_blank"
              >
                <Download className="w-4 h-4 mr-2" />
                导出
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
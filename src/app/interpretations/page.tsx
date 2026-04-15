'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader as _CardHeader,
  CardTitle as _CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs as _Tabs,
  TabsContent as _TabsContent,
  TabsList as _TabsList,
  TabsTrigger as _TabsTrigger,
} from '@/components/ui/tabs';
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
import { TableListStateRow } from '@/components/ui/list-states';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  RefreshCw,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText as FileWord,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

interface Interpretation {
  id: number;
  documentName: string;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  status: 'pending' | 'parsing' | 'completed' | 'failed';
  extractAccuracy: number | null;
  specCount: number;
  scoringCount: number;
  createdAt: string;
  tags: string[];
  reviewStatus: 'pending' | 'approved' | 'rejected' | null;
}

interface Stats {
  total: number;
  pending: number;
  parsing: number;
  completed: number;
  failed: number;
  reviewPending: number;
  reviewApproved: number;
  reviewRejected: number;
}

const statusConfig = {
  pending: { label: '待解析', color: 'bg-gray-100 text-gray-800', icon: Clock },
  parsing: { label: '解析中', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { label: '解析失败', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const reviewStatusConfig = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-800' },
};

export default function InterpretationsPage() {
  const _router = useRouter();
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    parsing: 0,
    completed: 0,
    failed: 0,
    reviewPending: 0,
    reviewApproved: 0,
    reviewRejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });

  const fetchData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      try {
        if (!silent) {
          setLoading(true);
          setError('');
        }
        const params = new URLSearchParams();
        if (keyword) params.append('keyword', keyword);
        if (status !== 'all') params.append('status', status);
        if (reviewStatusFilter !== 'all') {
          params.append(
            'reviewStatus',
            reviewStatusFilter === 'none' ? 'none' : reviewStatusFilter
          );
        }
        params.append('page', page.toString());
        params.append('pageSize', '10');

        const response = await fetch(`/api/interpretations?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
          setInterpretations(result.data.list);
          setTotalPages(result.data.totalPages);
          setStats(result.stats);
        } else {
          setError(result.message || '获取解读列表失败');
        }
      } catch (error) {
        console.error('获取数据失败:', error);
        setError(error instanceof Error ? error.message : '获取解读列表失败');
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [keyword, status, reviewStatusFilter, page]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const hasRunningBatch = interpretations.some((item) => item.status === 'parsing');
    if (!hasRunningBatch) {
      return;
    }
    const interval = setInterval(() => {
      void fetchData({ silent: true });
    }, 15000);
    return () => clearInterval(interval);
  }, [interpretations, fetchData]);

  const handleDelete = async () => {
    if (!deleteDialog.id) return;

    try {
      const response = await fetch(`/api/interpretations/${deleteDialog.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        fetchData();
      }
    } catch (error) {
      console.error('删除失败:', error);
    } finally {
      setDeleteDialog({ open: false, id: null });
    }
  };

  const handleStartParse = async (id: number) => {
    try {
      const response = await fetch(`/api/interpretations/${id}/parse`, {
        method: 'POST',
      });

      const result = await response.json();
      if (result.success) {
        void fetchData({ silent: true });
      }
    } catch (error) {
      console.error('启动解析失败:', error);
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

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
  }) => (
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
          <h1 className="text-2xl font-bold">招标文件解读</h1>
          <p className="text-muted-foreground">上传招标文件，自动提取关键信息</p>
        </div>
        <Button asChild>
          <Link href="/interpretations/upload">
            <Plus className="w-4 h-4 mr-2" />
            上传招标文件
          </Link>
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard title="总记录" value={stats.total} icon={FileText} color="bg-gray-100" />
        <StatCard title="待解析" value={stats.pending} icon={Clock} color="bg-gray-100" />
        <StatCard title="解析中" value={stats.parsing} icon={Loader2} color="bg-blue-100" />
        <StatCard title="已完成" value={stats.completed} icon={CheckCircle} color="bg-green-100" />
        <StatCard title="失败" value={stats.failed} icon={AlertCircle} color="bg-red-100" />
        <StatCard
          title="待审核"
          value={stats.reviewPending || 0}
          icon={Clock}
          color="bg-yellow-100"
        />
        <StatCard
          title="已审核"
          value={(stats.reviewApproved || 0) + (stats.reviewRejected || 0)}
          icon={CheckCircle}
          color="bg-purple-100"
        />
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索文件名、项目名称、招标单位..."
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="解析状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">解析状态</SelectItem>
                <SelectItem value="pending">待解析</SelectItem>
                <SelectItem value="parsing">解析中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="failed">解析失败</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={reviewStatusFilter}
              onValueChange={(v) => {
                setReviewStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="审核状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">审核状态</SelectItem>
                <SelectItem value="none">待审核</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已驳回</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件名称</TableHead>
                <TableHead>项目名称</TableHead>
                <TableHead>招标单位</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>提取项数</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableListStateRow state="loading" colSpan={7} />
              ) : error ? (
                <TableListStateRow state="error" colSpan={7} error={error} onRetry={fetchData} />
              ) : interpretations.length === 0 ? (
                <TableListStateRow state="empty" colSpan={7} />
              ) : (
                interpretations.map((item) => {
                  const statusInfo = statusConfig[item.status];
                  const StatusIcon = statusInfo.icon;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{item.documentName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.projectName || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.tenderOrganization || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={statusInfo.color}>
                            <StatusIcon
                              className={`w-3 h-3 mr-1 ${item.status === 'parsing' ? 'animate-spin' : ''}`}
                            />
                            {statusInfo.label}
                          </Badge>
                          {item.status === 'completed' && item.reviewStatus && (
                            <Badge className={reviewStatusConfig[item.reviewStatus].color}>
                              {reviewStatusConfig[item.reviewStatus].label}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 text-xs">
                          {item.specCount > 0 && (
                            <Badge variant="outline">规格{item.specCount}</Badge>
                          )}
                          {item.scoringCount > 0 && (
                            <Badge variant="outline">评分{item.scoringCount}</Badge>
                          )}
                          {item.specCount === 0 && item.scoringCount === 0 && '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/interpretations/${item.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </Link>
                            </DropdownMenuItem>
                            {item.status === 'pending' && (
                              <DropdownMenuItem onClick={() => handleStartParse(item.id)}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                开始解析
                              </DropdownMenuItem>
                            )}
                            {item.status === 'failed' && (
                              <DropdownMenuItem onClick={() => handleStartParse(item.id)}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                重新解析
                              </DropdownMenuItem>
                            )}
                            {item.status === 'completed' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/api/interpretations/${item.id}/export?format=json`}
                                    target="_blank"
                                  >
                                    <FileJson className="w-4 h-4 mr-2" />
                                    导出 JSON
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/api/interpretations/${item.id}/export?format=excel`}
                                    target="_blank"
                                  >
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                    导出 Excel
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/api/interpretations/${item.id}/export?format=word`}
                                    target="_blank"
                                  >
                                    <FileWord className="w-4 h-4 mr-2" />
                                    导出 Word
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/api/interpretations/${item.id}/export?format=txt`}
                                    target="_blank"
                                  >
                                    <FileText className="w-4 h-4 mr-2" />
                                    导出 TXT
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/api/interpretations/${item.id}/export?format=pdf`}
                                    target="_blank"
                                  >
                                    <FileText className="w-4 h-4 mr-2" />
                                    导出 PDF
                                  </Link>
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteDialog({ open: true, id: item.id })}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="flex items-center px-4 text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除这条解读记录吗？此操作不可恢复。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, id: null })}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

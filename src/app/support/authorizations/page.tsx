/**
 * 厂家支持 - 授权申请列表页面
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle as _CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Loader2,
  FileCheck,
  Calendar,
  User as _User,
  Building2 as _Building2,
  Clock as _Clock,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 授权申请数据类型
interface AuthorizationApplication {
  id: number;
  applicationNo: string;
  projectId: number;
  applicationDate: string;
  handlerId: number;
  handlerName: string;
  handlerPhone: string | null;
  status: string;
  materialDeadline: string | null;
  trackingStatus: string;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  submissionDeadline: string | null;
  createdAt: string;
  updatedAt: string;
}

// 统计数据类型
interface ApplicationStats {
  total: number;
  draft: number;
  pending_review: number;
  approved: number;
  rejected: number;
  material_pending: number;
  material_received: number;
  completed: number;
  terminated: number;
}

// 状态映射
const STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '审核驳回',
  material_pending: '材料待接收',
  material_received: '材料已接收',
  completed: '授权完成',
  terminated: '申请终止',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  material_pending: 'bg-yellow-100 text-yellow-800',
  material_received: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-emerald-100 text-emerald-800',
  terminated: 'bg-slate-100 text-slate-800',
};

const _TRACKING_STATUS_LABELS: Record<string, string> = {
  not_tracked: '未追踪',
  tracking: '追踪中',
  completed: '已完成',
};

export default function AuthorizationApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<AuthorizationApplication[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<AuthorizationApplication | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 加载授权申请列表
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      if (keyword) params.append('keyword', keyword);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/support/authorizations?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('获取授权申请列表失败');
      }

      const data = await response.json();
      setApplications(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter]);

  // 加载统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/support/authorizations?stats=true');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
    fetchStats();
  }, [fetchApplications, fetchStats]);

  // 处理搜索
  const handleSearch = () => {
    setPage(1);
    fetchApplications();
  };

  // 处理删除
  const handleDelete = async () => {
    if (!applicationToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/support/authorizations/${applicationToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }

      toast.success('授权申请已删除');
      setDeleteDialogOpen(false);
      setApplicationToDelete(null);
      fetchApplications();
      fetchStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(applications.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  // 单个选择
  const handleSelect = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'yyyy-MM-dd', { locale: zhCN });
  };

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    const colorClass = STATUS_COLORS[status] || STATUS_COLORS.draft;
    return (
      <Badge className={colorClass}>
        {STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/support" className="hover:text-foreground">厂家支持</Link>
            <span>/</span>
            <span className="text-foreground">授权申请</span>
          </div>
          <h1 className="text-2xl font-bold">授权申请</h1>
          <p className="text-muted-foreground">管理授权申请、厂家资质、配套材料等</p>
        </div>
        <Button onClick={() => router.push('/support/authorizations/create')}>
          <Plus className="mr-2 h-4 w-4" />
          新建申请
        </Button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>申请总数</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>待提交</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>待审核</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.pending_review}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>审核通过</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>授权完成</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索申请编号/项目名称/经办人..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="申请状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 授权申请列表 */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <FileCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">暂无授权申请数据</p>
              <Button onClick={() => router.push('/support/authorizations/create')}>
                <Plus className="mr-2 h-4 w-4" />
                创建第一个申请
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === applications.length && applications.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>申请单编号</TableHead>
                  <TableHead>项目名称</TableHead>
                  <TableHead>招标单位</TableHead>
                  <TableHead>经办人</TableHead>
                  <TableHead>申请状态</TableHead>
                  <TableHead>材料截止时间</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-16">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(application.id)}
                        onCheckedChange={(checked) => handleSelect(application.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{application.applicationNo}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{application.projectName || '-'}</div>
                      {application.projectCode && (
                        <p className="text-xs text-muted-foreground">{application.projectCode}</p>
                      )}
                    </TableCell>
                    <TableCell>{application.tenderOrganization || '-'}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{application.handlerName}</p>
                        {application.handlerPhone && (
                          <p className="text-xs text-muted-foreground">{application.handlerPhone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(application.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(application.materialDeadline)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(application.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/support/authorizations/${application.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/support/authorizations/${application.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setApplicationToDelete(application);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* 分页 */}
          {total > pageSize && (
            <div className="flex justify-center mt-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                上一页
              </Button>
              <span className="flex items-center px-4 text-sm">
                第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page * pageSize >= total}
                onClick={() => setPage(p => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除授权申请 <span className="font-medium">"{applicationToDelete?.applicationNo}"</span> 吗？
              相关的厂家、资质材料、配套材料等数据也会被删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

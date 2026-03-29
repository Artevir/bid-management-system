/**
 * 投标支持 - 友司支持列表页面
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
import {
  Plus,
  Search,
  Loader2,
  Building,
  Calendar,
} from 'lucide-react';
import { toast as _toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 友司支持申请数据类型
interface PartnerApplication {
  id: number;
  applicationNo: string;
  projectName: string | null;
  partnerCompanyName: string;
  handlerName: string;
  status: string;
  partnerConfirmStatus: string;
  materialDeadline: string | null;
  createdAt: string;
}

// 统计数据类型
interface ApplicationStats {
  total: number;
  draft: number;
  pending_confirm: number;
  confirmed: number;
  material_pending: number;
  material_received: number;
  completed: number;
  terminated: number;
}

// 状态映射
const STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_confirm: '待友司确认',
  confirmed: '友司已确认',
  material_pending: '材料待接收',
  material_received: '材料已接收',
  completed: '支持完成',
  terminated: '申请终止',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_confirm: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  material_pending: 'bg-yellow-100 text-yellow-800',
  material_received: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-emerald-100 text-emerald-800',
  terminated: 'bg-slate-100 text-slate-800',
};

const CONFIRM_STATUS_LABELS: Record<string, string> = {
  confirmed: '已确认支持',
  pending: '待确认',
  rejected: '拒绝支持',
};

const CONFIRM_STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function PartnerApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 加载友司支持申请列表
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      if (keyword) params.append('keyword', keyword);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/support/partner-applications?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('获取友司支持申请列表失败');
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
      const response = await fetch('/api/support/partner-applications?stats=true');
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

  // 获取确认状态徽章
  const getConfirmStatusBadge = (status: string) => {
    const colorClass = CONFIRM_STATUS_COLORS[status] || CONFIRM_STATUS_COLORS.pending;
    return (
      <Badge className={colorClass}>
        {CONFIRM_STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/support" className="hover:text-foreground">投标支持</Link>
            <span>/</span>
            <span className="text-foreground">友司支持</span>
          </div>
          <h1 className="text-2xl font-bold">友司支持</h1>
          <p className="text-muted-foreground">友司投标支持申请、材料管理、费用管理</p>
        </div>
        <Button onClick={() => router.push('/support/partner-applications/create')}>
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
              <CardDescription>待友司确认</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.pending_confirm}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>友司已确认</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>支持完成</CardDescription>
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
                placeholder="搜索申请编号/项目名称/友司名称/经办人..."
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

      {/* 友司支持申请列表 */}
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
              <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">暂无友司支持申请数据</p>
              <Button onClick={() => router.push('/support/partner-applications/create')}>
                <Plus className="mr-2 h-4 w-4" />
                创建第一个申请
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请单编号</TableHead>
                  <TableHead>项目名称</TableHead>
                  <TableHead>友司名称</TableHead>
                  <TableHead>经办人</TableHead>
                  <TableHead>友司确认状态</TableHead>
                  <TableHead>申请状态</TableHead>
                  <TableHead>材料截止时间</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-16">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/support/partner-applications/${application.id}`)}>
                    <TableCell>
                      <span className="font-mono text-sm">{application.applicationNo}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{application.projectName || '-'}</div>
                    </TableCell>
                    <TableCell>{application.partnerCompanyName}</TableCell>
                    <TableCell>{application.handlerName}</TableCell>
                    <TableCell>{getConfirmStatusBadge(application.partnerConfirmStatus)}</TableCell>
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
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/support/partner-applications/${application.id}`); }}>
                        查看
                      </Button>
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
    </div>
  );
}

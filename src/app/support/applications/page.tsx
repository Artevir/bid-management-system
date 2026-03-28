/**
 * 投标支持 - 统一申请列表页面
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  List,
  Calendar,
  FileCheck,
  Package,
  DollarSign,
  Building,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 统一申请数据类型
interface UnifiedApplication {
  id: number;
  type: 'authorization' | 'sample' | 'price' | 'partner';
  applicationNo: string;
  projectName: string | null;
  handlerName: string;
  status: string;
  createdAt: string;
}

// 统计数据类型
interface ApplicationStatistics {
  total: number;
  byType: {
    authorization: number;
    sample: number;
    price: number;
    partner: number;
  };
  byStatus: {
    draft: number;
    pending_review: number;
    approved: number;
    rejected: number;
    completed: number;
  };
}

// 类型标签
const TYPE_LABELS: Record<string, string> = {
  authorization: '授权申请',
  sample: '样机申请',
  price: '价格申请',
  partner: '友司支持',
};

const TYPE_COLORS: Record<string, string> = {
  authorization: 'bg-blue-100 text-blue-800',
  sample: 'bg-purple-100 text-purple-800',
  price: 'bg-green-100 text-green-800',
  partner: 'bg-orange-100 text-orange-800',
};

const TYPE_ICONS: Record<string, any> = {
  authorization: FileCheck,
  sample: Package,
  price: DollarSign,
  partner: Building,
};

// 状态映射
const STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '审核驳回',
  material_pending: '材料待接收',
  material_received: '材料已接收',
  completed: '授权完成',
  sample_pending: '样机待接收',
  sample_received: '样机已接收',
  sample_returned: '样机已归还',
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
  sample_pending: 'bg-yellow-100 text-yellow-800',
  sample_received: 'bg-cyan-100 text-cyan-800',
  sample_returned: 'bg-purple-100 text-purple-800',
  terminated: 'bg-slate-100 text-slate-800',
};

export default function ApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<UnifiedApplication[]>([]);
  const [stats, setStats] = useState<ApplicationStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 加载统一申请列表
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      if (keyword) params.append('keyword', keyword);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/support/applications?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('获取申请列表失败');
      }

      const data = await response.json();
      setApplications(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, typeFilter, statusFilter]);

  // 加载统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/support/applications?stats=true');
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

  // 获取类型徽章
  const getTypeBadge = (type: string) => {
    const colorClass = TYPE_COLORS[type] || 'bg-gray-100 text-gray-800';
    const Icon = TYPE_ICONS[type] || List;
    return (
      <Badge className={`${colorClass} gap-1`}>
        <Icon className="h-3 w-3" />
        {TYPE_LABELS[type] || type}
      </Badge>
    );
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

  // 获取详情页路径
  const getDetailPath = (application: UnifiedApplication) => {
    const pathMap: Record<string, string> = {
      authorization: 'authorizations',
      sample: 'sample-applications',
      price: 'price-applications',
      partner: 'partner-applications',
    };
    return `/support/${pathMap[application.type] || application.type}/${application.id}`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/support" className="hover:text-foreground">投标支持</Link>
            <span>/</span>
            <span className="text-foreground">全部申请</span>
          </div>
          <h1 className="text-2xl font-bold">全部申请</h1>
          <p className="text-muted-foreground">统一管理授权申请、样机申请、价格申请、友司支持申请</p>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
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
              <CardDescription>授权申请</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.byType.authorization}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>样机申请</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.byType.sample}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>价格申请</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.byType.price}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>友司支持</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.byType.partner || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>待审核</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.byStatus.pending_review}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>已完成</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.byStatus.completed}</div>
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="申请类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="authorization">授权申请</SelectItem>
                <SelectItem value="sample">样机申请</SelectItem>
                <SelectItem value="price">价格申请</SelectItem>
                <SelectItem value="partner">友司支持</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="申请状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="draft">待提交</SelectItem>
                <SelectItem value="pending_review">待审核</SelectItem>
                <SelectItem value="approved">审核通过</SelectItem>
                <SelectItem value="rejected">审核驳回</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 申请列表 */}
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
              <List className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">暂无申请数据</p>
              <div className="flex justify-center gap-2 flex-wrap">
                <Button onClick={() => router.push('/support/authorizations/create')}>
                  <FileCheck className="mr-2 h-4 w-4" />
                  新建授权申请
                </Button>
                <Button onClick={() => router.push('/support/sample-applications/create')}>
                  <Package className="mr-2 h-4 w-4" />
                  新建样机申请
                </Button>
                <Button onClick={() => router.push('/support/price-applications/create')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  新建价格申请
                </Button>
                <Button onClick={() => router.push('/support/partner-applications/create')}>
                  <Building className="mr-2 h-4 w-4" />
                  新建友司支持
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请类型</TableHead>
                  <TableHead>申请单编号</TableHead>
                  <TableHead>项目名称</TableHead>
                  <TableHead>经办人</TableHead>
                  <TableHead>申请状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-16">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={`${application.type}-${application.id}`} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(getDetailPath(application))}>
                    <TableCell>{getTypeBadge(application.type)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{application.applicationNo}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{application.projectName || '-'}</div>
                    </TableCell>
                    <TableCell>{application.handlerName}</TableCell>
                    <TableCell>{getStatusBadge(application.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(application.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(getDetailPath(application)); }}>
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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  Calendar,
  MapPin as _MapPin,
  DollarSign,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/error-message';

// 开标状态
const OPENING_STATUS = [
  { value: 'pending', label: '待开标', color: 'yellow' },
  { value: 'opened', label: '已开标', color: 'blue' },
  { value: 'cancelled', label: '已废标', color: 'red' },
  { value: 'postponed', label: '已延期', color: 'orange' },
];

interface BidOpening {
  id: number;
  projectId: number;
  projectName: string;
  tenderCode: string | null;
  openingDate: string;
  openingLocation: string | null;
  ourBidPrice: string | null;
  ourScore: string | null;
  status: string;
  winnerName: string | null;
  winnerPrice: string | null;
  budgetPrice: string | null;
  analysis: string | null;
  lessonsLearned: string | null;
  photos: string | null;
  attachments: string | null;
  participants: string | null;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: number;
  name: string;
  code: string;
}

export default function OpeningsPage() {
  const router = useRouter();
  const [openings, setOpenings] = useState<BidOpening[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 搜索和筛选
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 创建对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    projectId: '',
    projectName: '',
    tenderCode: '',
    openingDate: '',
    openingLocation: '',
    ourBidPrice: '',
    ourScore: '',
    budgetPrice: '',
    notes: '',
  });

  useEffect(() => {
    fetchOpenings();
    fetchProjects();
  }, [page, filterStatus]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects?pageSize=100');
      if (res.ok) {
        const data = await res.json();
        const projectItems = data?.data?.items || data?.items || [];
        setProjects(projectItems);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    }
  };

  const fetchOpenings = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/openings?${params}`);
      if (!res.ok) {
        throw new Error('获取开标记录失败');
      }

      const data = await res.json();
      setOpenings(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取开标记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchOpenings();
  };

  const handleCreate = async () => {
    if (!formData.projectId) {
      setError('请选择关联项目');
      return;
    }
    if (!formData.openingDate) {
      setError('请选择开标日期');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/openings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: parseInt(formData.projectId),
          projectName: formData.projectName,
          tenderCode: formData.tenderCode || null,
          openingDate: formData.openingDate,
          openingLocation: formData.openingLocation || null,
          ourBidPrice: formData.ourBidPrice || null,
          ourScore: formData.ourScore || null,
          budgetPrice: formData.budgetPrice || null,
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '创建开标记录失败'));
      }

      setDialogOpen(false);
      resetForm();
      fetchOpenings();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建开标记录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      projectId: '',
      projectName: '',
      tenderCode: '',
      openingDate: '',
      openingLocation: '',
      ourBidPrice: '',
      ourScore: '',
      budgetPrice: '',
      notes: '',
    });
    setError('');
  };

  const handleProjectChange = (projectId: string) => {
    const project = projects.find(p => p.id.toString() === projectId);
    setFormData({
      ...formData,
      projectId,
      projectName: project?.name || '',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = OPENING_STATUS.find(s => s.value === status);
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      red: 'bg-red-100 text-red-800',
      orange: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colorMap[statusInfo?.color || 'yellow']}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'opened': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'postponed': return <TrendingUp className="h-4 w-4 text-orange-600" />;
      default: return null;
    }
  };

  // 统计数据
  const stats = {
    pending: openings.filter(o => o.status === 'pending').length,
    opened: openings.filter(o => o.status === 'opened').length,
    wins: openings.filter(o => o.winnerName && o.winnerPrice === o.ourBidPrice).length,
    total: openings.length,
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">开标记录管理</h1>
          <p className="text-muted-foreground">记录开标过程、对比报价、总结经验</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              新建开标记录
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>新建开标记录</DialogTitle>
              <DialogDescription>创建新的开标记录</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{String(error)}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project">关联项目 *</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={handleProjectChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenderCode">招标编号</Label>
                  <Input
                    id="tenderCode"
                    value={formData.tenderCode}
                    onChange={(e) => setFormData({ ...formData, tenderCode: e.target.value })}
                    placeholder="招标编号"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openingDate">开标日期 *</Label>
                  <Input
                    id="openingDate"
                    type="date"
                    value={formData.openingDate}
                    onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openingLocation">开标地点</Label>
                  <Input
                    id="openingLocation"
                    value={formData.openingLocation}
                    onChange={(e) => setFormData({ ...formData, openingLocation: e.target.value })}
                    placeholder="开标地点"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ourBidPrice">我方报价</Label>
                  <Input
                    id="ourBidPrice"
                    type="number"
                    value={formData.ourBidPrice}
                    onChange={(e) => setFormData({ ...formData, ourBidPrice: e.target.value })}
                    placeholder="我方报价"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ourScore">我方得分</Label>
                  <Input
                    id="ourScore"
                    value={formData.ourScore}
                    onChange={(e) => setFormData({ ...formData, ourScore: e.target.value })}
                    placeholder="综合评分"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budgetPrice">预算金额</Label>
                <Input
                  id="budgetPrice"
                  type="number"
                  value={formData.budgetPrice}
                  onChange={(e) => setFormData({ ...formData, budgetPrice: e.target.value })}
                  placeholder="项目预算金额"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">备注</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="请输入备注信息"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待开标</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已开标</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.opened}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">中标项目</CardTitle>
            <Trophy className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总记录</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索项目名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {OPENING_STATUS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 开标记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>开标记录列表</CardTitle>
          <CardDescription>共 {total} 条记录</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : openings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无开标记录</p>
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                新建开标记录
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>开标日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>我方报价</TableHead>
                  <TableHead>中标者</TableHead>
                  <TableHead>中标价</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openings.map((opening) => (
                  <TableRow key={opening.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{opening.projectName}</div>
                        {opening.tenderCode && (
                          <div className="text-xs text-muted-foreground">
                            {opening.tenderCode}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(opening.openingDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(opening.status)}
                        {getStatusBadge(opening.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {opening.ourBidPrice
                        ? formatCurrency(parseFloat(opening.ourBidPrice))
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {opening.winnerName ? (
                        <div className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-green-600" />
                          {opening.winnerName}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {opening.winnerPrice
                        ? formatCurrency(parseFloat(opening.winnerPrice))
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/openings/${opening.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* 分页 */}
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

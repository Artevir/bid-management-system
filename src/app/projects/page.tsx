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
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  FolderOpen as _FolderOpen,
  Calendar,
  Building2 as _Building2,
  MapPin as _MapPin,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { NoProjectState } from '@/components/ui/empty-state';
import { extractErrorMessage } from '@/lib/error-message';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_TYPES,
  TENDER_METHODS,
  INDUSTRIES,
  REGIONS,
  ProjectStatus,
} from '@/types/project';

interface Project {
  id: number;
  name: string;
  code: string;
  tenderCode: string | null;
  type: string | null;
  industry: string | null;
  region: string | null;
  status: ProjectStatus;
  progress: number;
  ownerId: number;
  ownerName: string;
  departmentId: number;
  departmentName: string;
  submissionDeadline: string | null;
  openBidDate: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ id: number; name: string; color: string }>;
}

interface Department {
  id: number;
  name: string;
}

interface User {
  id: number;
  realName: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 搜索和筛选
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [availableTags, setAvailableTags] = useState<Array<{ id: number; name: string; color: string }>>([]);

  // 创建对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    tenderCode: '',
    type: '',
    industry: '',
    region: '',
    tenderOrganization: '',
    tenderAgent: '',
    tenderMethod: '',
    budget: '',
    publishDate: '',
    registerDeadline: '',
    questionDeadline: '',
    submissionDeadline: '',
    openBidDate: '',
    ownerId: '',
    departmentId: '',
    description: '',
  });

  useEffect(() => {
    fetchProjects();
    fetchDepartments();
    fetchUsers();
    fetchTags();
  }, [page, filterStatus, filterIndustry, filterRegion, filterTag]);

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/project-tags');
      if (res.ok) {
        const data = await res.json();
        setAvailableTags(data.tags || []);
      }
    } catch (err) {
      console.error('Fetch tags error:', err);
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (searchTerm) params.set('keyword', searchTerm);
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      if (filterIndustry && filterIndustry !== 'all') params.set('industry', filterIndustry);
      if (filterRegion && filterRegion !== 'all') params.set('region', filterRegion);
      if (filterTag && filterTag !== 'all') params.set('tags', filterTag);

      const res = await fetch(`/api/projects?${params}`);
      if (!res.ok) {
        throw new Error('获取项目列表失败');
      }

      const data = await res.json();
      const payload = data?.data || {};
      setProjects(payload.items || []);
      setTotal(payload.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error('Fetch departments error:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchProjects();
  };

  const handleCreate = async () => {
    // 验证必填字段
    if (!formData.name.trim()) {
      setError('项目名称不能为空');
      return;
    }
    if (!formData.code.trim()) {
      setError('项目编码不能为空');
      return;
    }
    if (!formData.ownerId) {
      setError('请选择项目负责人');
      return;
    }
    if (!formData.departmentId) {
      setError('请选择所属部门');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '创建项目失败'));
      }

      // 关闭对话框并刷新列表
      setDialogOpen(false);
      resetForm();
      fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建项目失败');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      tenderCode: '',
      type: '',
      industry: '',
      region: '',
      tenderOrganization: '',
      tenderAgent: '',
      tenderMethod: '',
      budget: '',
      publishDate: '',
      registerDeadline: '',
      questionDeadline: '',
      submissionDeadline: '',
      openBidDate: '',
      ownerId: '',
      departmentId: '',
      description: '',
    });
    setError('');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const getStatusBadge = (status: ProjectStatus) => {
    const colorMap: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      cyan: 'bg-cyan-100 text-cyan-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      emerald: 'bg-emerald-100 text-emerald-800',
      red: 'bg-red-100 text-red-800',
      slate: 'bg-slate-100 text-slate-800',
    };
    const color = PROJECT_STATUS_COLORS[status];
    return (
      <Badge className={colorMap[color] || colorMap.gray}>
        {PROJECT_STATUS_LABELS[status]}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">项目管理</h1>
          <p className="text-muted-foreground">管理投标项目，跟踪项目进度</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建项目</DialogTitle>
              <DialogDescription>创建新的投标项目</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{String(error)}</AlertDescription>
                </Alert>
              )}

              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">项目名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="请输入项目名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">项目编码 *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="请输入项目编码"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tenderCode">招标编号</Label>
                  <Input
                    id="tenderCode"
                    value={formData.tenderCode}
                    onChange={(e) => setFormData({ ...formData, tenderCode: e.target.value })}
                    placeholder="请输入招标编号"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">项目类型</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择项目类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">所属行业</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) => setFormData({ ...formData, industry: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择所属行业" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">所属区域</Label>
                  <Select
                    value={formData.region}
                    onValueChange={(value) => setFormData({ ...formData, region: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择所属区域" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 招标信息 */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-4">招标信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenderOrganization">招标单位</Label>
                    <Input
                      id="tenderOrganization"
                      value={formData.tenderOrganization}
                      onChange={(e) =>
                        setFormData({ ...formData, tenderOrganization: e.target.value })
                      }
                      placeholder="请输入招标单位"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenderAgent">招标代理</Label>
                    <Input
                      id="tenderAgent"
                      value={formData.tenderAgent}
                      onChange={(e) => setFormData({ ...formData, tenderAgent: e.target.value })}
                      placeholder="请输入招标代理"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenderMethod">招标方式</Label>
                    <Select
                      value={formData.tenderMethod}
                      onValueChange={(value) => setFormData({ ...formData, tenderMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择招标方式" />
                      </SelectTrigger>
                      <SelectContent>
                        {TENDER_METHODS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">预算金额</Label>
                    <Input
                      id="budget"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      placeholder="请输入预算金额"
                    />
                  </div>
                </div>
              </div>

              {/* 关键时间节点 */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-4">关键时间节点</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="publishDate">招标公告日期</Label>
                    <Input
                      id="publishDate"
                      type="date"
                      value={formData.publishDate}
                      onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registerDeadline">报名截止日期</Label>
                    <Input
                      id="registerDeadline"
                      type="date"
                      value={formData.registerDeadline}
                      onChange={(e) =>
                        setFormData({ ...formData, registerDeadline: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="questionDeadline">答疑截止日期</Label>
                    <Input
                      id="questionDeadline"
                      type="date"
                      value={formData.questionDeadline}
                      onChange={(e) =>
                        setFormData({ ...formData, questionDeadline: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="submissionDeadline">投标截止日期</Label>
                    <Input
                      id="submissionDeadline"
                      type="date"
                      value={formData.submissionDeadline}
                      onChange={(e) =>
                        setFormData({ ...formData, submissionDeadline: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="openBidDate">开标日期</Label>
                    <Input
                      id="openBidDate"
                      type="date"
                      value={formData.openBidDate}
                      onChange={(e) => setFormData({ ...formData, openBidDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 项目管理 */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-4">项目管理</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departmentId">所属部门 *</Label>
                    <Select
                      value={formData.departmentId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, departmentId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择所属部门" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id.toString()}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerId">项目负责人 *</Label>
                    <Select
                      value={formData.ownerId}
                      onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择项目负责人" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.realName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="description">项目描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="请输入项目描述"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                创建项目
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索项目名称、编码..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="项目状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterIndustry} onValueChange={setFilterIndustry}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="所属行业" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部行业</SelectItem>
                {INDUSTRIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="所属区域" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部区域</SelectItem>
                {REGIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="项目标签" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部标签</SelectItem>
                {availableTags.map((tag) => (
                  <SelectItem key={tag.id} value={String(tag.id)}>
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 项目列表 */}
      <Card>
        <CardHeader>
          <CardTitle>项目列表</CardTitle>
          <CardDescription>
            共 {total} 个项目
          </CardDescription>
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
          ) : projects.length === 0 ? (
            <NoProjectState onCreate={() => setDialogOpen(true)} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>项目编码</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>进度</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>投标截止</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.name}</div>
                        {project.tenderCode && (
                          <div className="text-xs text-muted-foreground">
                            招标编号: {project.tenderCode}
                          </div>
                        )}
                        {project.tags && project.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {project.tags.map((tag) => (
                              <Badge 
                                key={tag.id} 
                                variant="outline"
                                className="text-xs"
                                style={{ borderColor: tag.color, color: tag.color }}
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{project.code}</TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={project.progress} className="w-20" />
                        <span className="text-xs text-muted-foreground">{project.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{project.ownerName}</div>
                        <div className="text-xs text-muted-foreground">{project.departmentName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.submissionDeadline ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(project.submissionDeadline)}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
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
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total}{' '}
                条
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

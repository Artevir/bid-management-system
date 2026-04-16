'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription as _CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  FileCheck,
  Calendar,
  Send,
  ExternalLink,
  Ban,
  CheckCircle,
  Clock,
  FileText,
  MapPin as _MapPin,
  Phone as _Phone,
  User,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/error-message';

// 领取状态
const COLLECTION_STATUS = [
  { value: 'pending', label: '待领取', color: 'yellow' },
  { value: 'in_progress', label: '进行中', color: 'blue' },
  { value: 'completed', label: '已领取', color: 'green' },
  { value: 'cancelled', label: '已取消', color: 'gray' },
];

interface NotificationCollection {
  id: number;
  projectId: number | null;
  projectName: string;
  projectCode: string | null;
  bidWinDate: string | null;
  publicityEndDate: string | null;
  notificationDeadline: string | null;
  collectionLocation: string | null;
  collectionLocationDetail: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  collectorId: number | null;
  collectorName: string | null;
  collectorPhone: string | null;
  needIdCard: boolean;
  needBusinessLicense: boolean;
  needSeal: boolean;
  otherDocuments: string | null;
  idCardPrepared: boolean;
  businessLicensePrepared: boolean;
  otherDocumentsPrepared: boolean;
  status: string;
  collectedAt: string | null;
  remarks: string | null;
  taskId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Statistics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

interface User {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
  code: string | null;
}

export default function BidNotificationCollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<NotificationCollection[]>([]);
  const [stats, setStats] = useState<Statistics>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 筛选条件
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');

  // 新增/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // 详情对话框
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<NotificationCollection | null>(null);

  // 推送任务中
  const [pushingTaskId, setPushingTaskId] = useState<number | null>(null);

  // 下拉选项
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // 表单数据
  const [formData, setFormData] = useState({
    projectId: '',
    projectName: '',
    projectCode: '',
    bidWinDate: '',
    publicityEndDate: '',
    notificationDeadline: '',
    collectionLocation: '',
    collectionLocationDetail: '',
    contactPerson: '',
    contactPhone: '',
    collectorId: '',
    collectorName: '',
    collectorPhone: '',
    needIdCard: true,
    needBusinessLicense: true,
    needSeal: true,
    otherDocuments: '',
    idCardPrepared: false,
    businessLicensePrepared: false,
    otherDocumentsPrepared: false,
    remarks: '',
    status: 'pending',
  });

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (keyword) params.append('keyword', keyword);

      const response = await fetch(`/api/bid-notification-collections?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setCollections(result.data);
      } else {
        setError(extractErrorMessage(result, '加载数据失败'));
      }

      // 加载统计
      const statsResponse = await fetch('/api/bid-notification-collections?stats=true');
      const statsResult = await statsResponse.json();
      if (statsResult.success) {
        setStats(statsResult.stats);
      }
    } catch (_err) {
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载用户列表
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/bid-notification-collections?users=true');
      const result = await response.json();
      if (result.success) {
        setUsers(result.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  // 加载项目列表
  const loadProjects = async () => {
    try {
      const response = await fetch('/api/bid-notification-collections?projects=true');
      const result = await response.json();
      if (result.success) {
        setProjects(result.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadUsers();
    loadProjects();
  }, [statusFilter]);

  // 打开新增对话框
  const handleAdd = () => {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (collection: NotificationCollection) => {
    setEditingId(collection.id);
    setFormData({
      projectId: collection.projectId?.toString() || '',
      projectName: collection.projectName,
      projectCode: collection.projectCode || '',
      bidWinDate: collection.bidWinDate ? collection.bidWinDate.split('T')[0] : '',
      publicityEndDate: collection.publicityEndDate
        ? collection.publicityEndDate.split('T')[0]
        : '',
      notificationDeadline: collection.notificationDeadline
        ? collection.notificationDeadline.split('T')[0]
        : '',
      collectionLocation: collection.collectionLocation || '',
      collectionLocationDetail: collection.collectionLocationDetail || '',
      contactPerson: collection.contactPerson || '',
      contactPhone: collection.contactPhone || '',
      collectorId: collection.collectorId?.toString() || '',
      collectorName: collection.collectorName || '',
      collectorPhone: collection.collectorPhone || '',
      needIdCard: collection.needIdCard,
      needBusinessLicense: collection.needBusinessLicense,
      needSeal: collection.needSeal,
      otherDocuments: collection.otherDocuments || '',
      idCardPrepared: collection.idCardPrepared,
      businessLicensePrepared: collection.businessLicensePrepared,
      otherDocumentsPrepared: collection.otherDocumentsPrepared,
      remarks: collection.remarks || '',
      status: collection.status,
    });
    setError('');
    setDialogOpen(true);
  };

  // 查看详情
  const handleView = (collection: NotificationCollection) => {
    setSelectedCollection(collection);
    setDetailOpen(true);
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      projectId: '',
      projectName: '',
      projectCode: '',
      bidWinDate: '',
      publicityEndDate: '',
      notificationDeadline: '',
      collectionLocation: '',
      collectionLocationDetail: '',
      contactPerson: '',
      contactPhone: '',
      collectorId: '',
      collectorName: '',
      collectorPhone: '',
      needIdCard: true,
      needBusinessLicense: true,
      needSeal: true,
      otherDocuments: '',
      idCardPrepared: false,
      businessLicensePrepared: false,
      otherDocumentsPrepared: false,
      remarks: '',
      status: 'pending',
    });
    setError('');
  };

  // 从用户选择填充姓名
  const handleCollectorSelect = (userId: string) => {
    const user = users.find((u) => u.id === parseInt(userId));
    if (user) {
      setFormData({
        ...formData,
        collectorId: userId,
        collectorName: user.name,
      });
    }
  };

  // 保存数据
  const handleSave = async () => {
    // 验证必填字段
    if (!formData.projectName) {
      setError('请填写项目名称');
      return;
    }

    if (!formData.collectorName) {
      setError('请选择领取人');
      return;
    }

    setSaving(true);
    try {
      const url = '/api/bid-notification-collections';
      const method = editingId ? 'PUT' : 'POST';
      const body = {
        id: editingId,
        ...formData,
        collectorId: formData.collectorId ? parseInt(formData.collectorId) : null,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setDialogOpen(false);
        resetForm();
        loadData();
      } else {
        setError(extractErrorMessage(result, '保存失败'));
      }
    } catch (_err) {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除数据
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条领取安排吗？')) return;

    try {
      const response = await fetch(`/api/bid-notification-collections?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        loadData();
      } else {
        alert(extractErrorMessage(result, '删除失败'));
      }
    } catch (_err) {
      alert('删除失败');
    }
  };

  // 推送到任务中心
  const handlePushTask = async (id: number) => {
    setPushingTaskId(id);
    try {
      const response = await fetch(`/api/bid-notification-collections/${id}/push-task`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert('已推送到任务中心');
        loadData();
      } else {
        alert(extractErrorMessage(result, '推送失败'));
      }
    } catch (_err) {
      alert('推送失败');
    } finally {
      setPushingTaskId(null);
    }
  };

  // 更新状态
  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const response = await fetch('/api/bid-notification-collections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      const result = await response.json();

      if (result.success) {
        loadData();
      } else {
        alert(extractErrorMessage(result, '更新状态失败'));
      }
    } catch (_err) {
      alert('更新状态失败');
    }
  };

  // 获取状态样式
  const getStatusBadge = (status: string) => {
    const statusConfig = COLLECTION_STATUS.find((s) => s.value === status);
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colorMap[statusConfig?.color || 'gray']}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  // 检查材料是否齐全
  const checkDocumentsComplete = (collection: NotificationCollection): boolean => {
    if (collection.needIdCard && !collection.idCardPrepared) return false;
    if (collection.needBusinessLicense && !collection.businessLicensePrepared) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCheck className="h-6 w-6" />
            领取中标通知书
          </h1>
          <p className="text-muted-foreground">管理中标通知书的领取安排，是签合同的核心依据</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          新增领取安排
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待领取</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">进行中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已领取</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已取消</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>关键词搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索项目名称或编号..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                />
              </div>
            </div>
            <div className="w-40">
              <Label>状态</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  {COLLECTION_STATUS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadData}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <ListStateBlock state="loading" />
          ) : collections.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无领取安排数据" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>领取地点</TableHead>
                  <TableHead>领取人</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead>材料状态</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{collection.projectName}</div>
                        {collection.projectCode && (
                          <div className="text-sm text-muted-foreground">
                            {collection.projectCode}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className="text-sm max-w-[200px] truncate"
                        title={collection.collectionLocation || ''}
                      >
                        {collection.collectionLocation || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{collection.collectorName || '-'}</div>
                        {collection.collectorPhone && (
                          <div className="text-sm text-muted-foreground">
                            {collection.collectorPhone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {collection.notificationDeadline ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(collection.notificationDeadline)}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {checkDocumentsComplete(collection) ? (
                        <Badge className="bg-green-100 text-green-800">材料齐全</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-800">材料待准备</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(collection.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleView(collection)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(collection)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        {collection.status !== 'completed' && collection.status !== 'cancelled' && (
                          <>
                            {!collection.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePushTask(collection.id)}
                                disabled={pushingTaskId === collection.id}
                              >
                                {pushingTaskId === collection.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {collection.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/tasks/${collection.taskId}`)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        {collection.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(collection.id, 'in_progress')}
                          >
                            <Clock className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {collection.status === 'in_progress' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(collection.id, 'completed')}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(collection.id)}
                        >
                          <Ban className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑领取安排' : '新增领取安排'}</DialogTitle>
            <DialogDescription>填写领取中标通知书安排信息</DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {/* 项目信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">项目信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>关联项目</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) => {
                      const project = projects.find((p) => p.id === parseInt(value));
                      setFormData({
                        ...formData,
                        projectId: value,
                        projectName: project?.name || '',
                        projectCode: project?.code || '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择项目" />
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
                  <Label>项目名称 *</Label>
                  <Input
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    placeholder="输入项目名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label>项目编号</Label>
                  <Input
                    value={formData.projectCode}
                    onChange={(e) => setFormData({ ...formData, projectCode: e.target.value })}
                    placeholder="输入项目编号"
                  />
                </div>
                <div className="space-y-2">
                  <Label>中标日期</Label>
                  <Input
                    type="date"
                    value={formData.bidWinDate}
                    onChange={(e) => setFormData({ ...formData, bidWinDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>公示结束日期</Label>
                  <Input
                    type="date"
                    value={formData.publicityEndDate}
                    onChange={(e) => setFormData({ ...formData, publicityEndDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>领取截止日期</Label>
                  <Input
                    type="date"
                    value={formData.notificationDeadline}
                    onChange={(e) =>
                      setFormData({ ...formData, notificationDeadline: e.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* 领取地点 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">领取地点（政采/代理机构）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>领取地点</Label>
                    <Input
                      value={formData.collectionLocation}
                      onChange={(e) =>
                        setFormData({ ...formData, collectionLocation: e.target.value })
                      }
                      placeholder="输入领取地点"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>对接人</Label>
                    <Input
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      placeholder="输入对接人姓名"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>详细地址</Label>
                  <Textarea
                    value={formData.collectionLocationDetail}
                    onChange={(e) =>
                      setFormData({ ...formData, collectionLocationDetail: e.target.value })
                    }
                    placeholder="输入详细地址"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>对接人电话</Label>
                    <Input
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      placeholder="输入对接人电话"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 领取人信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">领取人信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>选择领取人 *</Label>
                  <Select value={formData.collectorId} onValueChange={handleCollectorSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择领取人" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>领取人姓名</Label>
                  <Input
                    value={formData.collectorName}
                    onChange={(e) => setFormData({ ...formData, collectorName: e.target.value })}
                    placeholder="输入领取人姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label>联系电话</Label>
                  <Input
                    value={formData.collectorPhone}
                    onChange={(e) => setFormData({ ...formData, collectorPhone: e.target.value })}
                    placeholder="输入联系电话"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 需携带材料 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">需携带材料</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.needIdCard}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, needIdCard: checked as boolean })
                      }
                    />
                    <Label className="font-normal">代办人身份证</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.needBusinessLicense}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, needBusinessLicense: checked as boolean })
                      }
                    />
                    <Label className="font-normal">公司营业执照副本</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.needSeal}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, needSeal: checked as boolean })
                      }
                    />
                    <Label className="font-normal">复印件加盖公章</Label>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-muted-foreground text-sm">材料准备状态</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    {formData.needIdCard && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.idCardPrepared}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, idCardPrepared: checked as boolean })
                          }
                        />
                        <Label className="font-normal text-sm">身份证已准备</Label>
                      </div>
                    )}
                    {formData.needBusinessLicense && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.businessLicensePrepared}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              businessLicensePrepared: checked as boolean,
                            })
                          }
                        />
                        <Label className="font-normal text-sm">营业执照已准备</Label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>其他材料</Label>
                  <Textarea
                    value={formData.otherDocuments}
                    onChange={(e) => setFormData({ ...formData, otherDocuments: e.target.value })}
                    placeholder="输入其他需要携带的材料，每行一个"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 备注 */}
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="输入备注信息"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>领取安排详情</DialogTitle>
          </DialogHeader>

          {selectedCollection && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">项目名称</Label>
                  <p className="font-medium">{selectedCollection.projectName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">项目编号</Label>
                  <p className="font-medium">{selectedCollection.projectCode || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">中标日期</Label>
                  <p className="font-medium">
                    {selectedCollection.bidWinDate
                      ? formatDate(selectedCollection.bidWinDate)
                      : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">领取截止日期</Label>
                  <p className="font-medium">
                    {selectedCollection.notificationDeadline
                      ? formatDate(selectedCollection.notificationDeadline)
                      : '-'}
                  </p>
                </div>
              </div>

              {/* 领取地点 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">领取地点</Label>
                <p className="mt-1">{selectedCollection.collectionLocation || '-'}</p>
                {selectedCollection.collectionLocationDetail && (
                  <p className="text-sm text-muted-foreground">
                    {selectedCollection.collectionLocationDetail}
                  </p>
                )}
                {selectedCollection.contactPerson && (
                  <p className="text-sm mt-2">
                    对接人: {selectedCollection.contactPerson}
                    {selectedCollection.contactPhone && ` (${selectedCollection.contactPhone})`}
                  </p>
                )}
              </div>

              {/* 领取人信息 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">领取人</Label>
                <p className="mt-1">
                  {selectedCollection.collectorName || '-'}
                  {selectedCollection.collectorPhone && ` (${selectedCollection.collectorPhone})`}
                </p>
              </div>

              {/* 材料准备 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">需携带材料</Label>
                <div className="mt-2 space-y-2">
                  {selectedCollection.needIdCard && (
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedCollection.idCardPrepared ? 'default' : 'outline'}>
                        {selectedCollection.idCardPrepared ? '✓' : '○'} 身份证
                      </Badge>
                    </div>
                  )}
                  {selectedCollection.needBusinessLicense && (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={selectedCollection.businessLicensePrepared ? 'default' : 'outline'}
                      >
                        {selectedCollection.businessLicensePrepared ? '✓' : '○'} 营业执照副本
                      </Badge>
                      {selectedCollection.needSeal && (
                        <span className="text-sm text-muted-foreground">(复印件加盖公章)</span>
                      )}
                    </div>
                  )}
                  {selectedCollection.otherDocuments && (
                    <div className="text-sm text-muted-foreground">
                      其他: {selectedCollection.otherDocuments}
                    </div>
                  )}
                </div>
              </div>

              {/* 备注 */}
              {selectedCollection.remarks && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">备注</Label>
                  <p className="mt-1 whitespace-pre-wrap">{selectedCollection.remarks}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
            <Button
              onClick={() => {
                setDetailOpen(false);
                if (selectedCollection) {
                  handleEdit(selectedCollection);
                }
              }}
            >
              编辑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

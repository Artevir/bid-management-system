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
  Stamp,
  Calendar,
  Building2,
  User,
  Send,
  ExternalLink,
  Ban,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

// 盖章状态
const SEAL_STATUS = [
  { value: 'pending', label: '待盖章', color: 'yellow' },
  { value: 'in_progress', label: '进行中', color: 'blue' },
  { value: 'completed', label: '已完成', color: 'green' },
  { value: 'cancelled', label: '已取消', color: 'gray' },
];

// 盖章方式
const SEAL_METHODS = [
  { value: 'our_company', label: '本公司盖章', icon: '🏢', description: '我们带公章去对方公司' },
  { value: 'partner_company', label: '对方来盖章', icon: '🤝', description: '对方带公章来我们公司' },
];

// 优先级
const PRIORITIES = [
  { value: 'high', label: '高', color: 'red' },
  { value: 'medium', label: '中', color: 'yellow' },
  { value: 'low', label: '低', color: 'green' },
];

interface SealApplication {
  id: number;
  projectId: number | null;
  projectName: string;
  projectCode: string | null;
  sealDeadline: string | null;
  plannedDate: string | null;
  actualDate: string | null;
  sealMethod: string;
  partnerCompanyId: number | null;
  partnerCompanyName: string | null;
  partnerCompanyAddress: string | null;
  partnerContactId: number | null;
  partnerContactName: string | null;
  partnerContactPhone: string | null;
  sealCount: number | null;
  sealPurpose: string | null;
  documentType: string | null;
  specialRequirements: string | null;
  ourContactId: number | null;
  ourContactName: string | null;
  ourContactPhone: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  priority: string;
  remarks: string | null;
  status: string;
  completedAt: string | null;
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

interface Company {
  id: number;
  name: string;
  officeAddress: string | null;
  registerAddress: string | null;
}

interface Contact {
  id: number;
  name: string;
  phone: string | null;
}

export default function BidSealApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<SealApplication[]>([]);
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
  const [sealMethodFilter, setSealMethodFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  
  // 新增/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  
  // 详情对话框
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<SealApplication | null>(null);
  
  // 推送任务中
  const [pushingTaskId, setPushingTaskId] = useState<number | null>(null);
  
  // 下拉选项
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  // 表单数据
  const [formData, setFormData] = useState({
    projectId: '',
    projectName: '',
    projectCode: '',
    sealDeadline: '',
    plannedDate: '',
    sealMethod: 'our_company',
    partnerCompanyId: '',
    partnerCompanyName: '',
    partnerCompanyAddress: '',
    partnerContactId: '',
    partnerContactName: '',
    partnerContactPhone: '',
    sealCount: 1,
    sealPurpose: '',
    documentType: '',
    specialRequirements: '',
    ourContactId: '',
    ourContactName: '',
    ourContactPhone: '',
    assigneeId: '',
    assigneeName: '',
    priority: 'medium',
    remarks: '',
    status: 'pending',
  });

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (sealMethodFilter) params.append('sealMethod', sealMethodFilter);
      if (keyword) params.append('keyword', keyword);
      
      const response = await fetch(`/api/bid-seal-applications?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setApplications(result.data);
        setStats(result.stats);
      } else {
        setError(result.error || '加载数据失败');
      }
    } catch (err) {
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载用户列表
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/bid-seal-applications?users=true');
      const result = await response.json();
      if (result.success) {
        setUsers(result.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  // 加载公司列表
  const loadCompanies = async () => {
    try {
      const response = await fetch('/api/bid-seal-applications?companies=true');
      const result = await response.json();
      if (result.success) {
        setCompanies(result.companies);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  // 加载公司联系人
  const loadContacts = async (companyId: number) => {
    try {
      const response = await fetch(`/api/bid-seal-applications?companyId=${companyId}&contacts=true`);
      const result = await response.json();
      if (result.success) {
        setContacts(result.contacts);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  // 加载公司地址
  const loadCompanyAddress = async (companyId: number) => {
    try {
      const response = await fetch(`/api/bid-seal-applications?companyId=${companyId}&address=true`);
      const result = await response.json();
      if (result.success && result.address) {
        // 优先使用办公地址，其次使用注册地址
        const address = result.address.officeAddress || result.address.registerAddress || '';
        setFormData(prev => ({
          ...prev,
          partnerCompanyAddress: address,
        }));
      }
    } catch (err) {
      console.error('Failed to load company address:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadUsers();
    loadCompanies();
  }, [statusFilter, sealMethodFilter]);

  // 处理公司选择变更
  const handleCompanyChange = (companyId: string) => {
    const company = companies.find(c => c.id === parseInt(companyId));
    setFormData(prev => ({
      ...prev,
      partnerCompanyId: companyId,
      partnerCompanyName: company?.name || '',
      partnerCompanyAddress: company?.officeAddress || company?.registerAddress || '',
      partnerContactId: '',
      partnerContactName: '',
      partnerContactPhone: '',
    }));
    setContacts([]);
    
    if (companyId) {
      loadContacts(parseInt(companyId));
    }
  };

  // 处理联系人选择变更
  const handleContactChange = (contactId: string) => {
    const contact = contacts.find(c => c.id === parseInt(contactId));
    setFormData(prev => ({
      ...prev,
      partnerContactId: contactId,
      partnerContactName: contact?.name || '',
      partnerContactPhone: contact?.phone || '',
    }));
  };

  // 处理指派人选择变更
  const handleAssigneeChange = (userId: string) => {
    const user = users.find(u => u.id === parseInt(userId));
    setFormData(prev => ({
      ...prev,
      assigneeId: userId,
      assigneeName: user?.name || '',
    }));
  };

  // 打开新增对话框
  const handleAdd = () => {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (application: SealApplication) => {
    setEditingId(application.id);
    setFormData({
      projectId: application.projectId?.toString() || '',
      projectName: application.projectName,
      projectCode: application.projectCode || '',
      sealDeadline: application.sealDeadline ? application.sealDeadline.split('T')[0] : '',
      plannedDate: application.plannedDate ? application.plannedDate.split('T')[0] : '',
      sealMethod: application.sealMethod,
      partnerCompanyId: application.partnerCompanyId?.toString() || '',
      partnerCompanyName: application.partnerCompanyName || '',
      partnerCompanyAddress: application.partnerCompanyAddress || '',
      partnerContactId: application.partnerContactId?.toString() || '',
      partnerContactName: application.partnerContactName || '',
      partnerContactPhone: application.partnerContactPhone || '',
      sealCount: application.sealCount || 1,
      sealPurpose: application.sealPurpose || '',
      documentType: application.documentType || '',
      specialRequirements: application.specialRequirements || '',
      ourContactId: application.ourContactId?.toString() || '',
      ourContactName: application.ourContactName || '',
      ourContactPhone: application.ourContactPhone || '',
      assigneeId: application.assigneeId?.toString() || '',
      assigneeName: application.assigneeName || '',
      priority: application.priority,
      remarks: application.remarks || '',
      status: application.status,
    });
    setError('');
    setDialogOpen(true);
    
    // 加载联系人列表
    if (application.partnerCompanyId) {
      loadContacts(application.partnerCompanyId);
    }
  };

  // 查看详情
  const handleView = (application: SealApplication) => {
    setSelectedApplication(application);
    setDetailOpen(true);
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      projectId: '',
      projectName: '',
      projectCode: '',
      sealDeadline: '',
      plannedDate: '',
      sealMethod: 'our_company',
      partnerCompanyId: '',
      partnerCompanyName: '',
      partnerCompanyAddress: '',
      partnerContactId: '',
      partnerContactName: '',
      partnerContactPhone: '',
      sealCount: 1,
      sealPurpose: '',
      documentType: '',
      specialRequirements: '',
      ourContactId: '',
      ourContactName: '',
      ourContactPhone: '',
      assigneeId: '',
      assigneeName: '',
      priority: 'medium',
      remarks: '',
      status: 'pending',
    });
    setError('');
    setContacts([]);
  };

  // 保存数据
  const handleSave = async () => {
    // 验证必填字段
    if (!formData.projectName) {
      setError('请填写项目名称');
      return;
    }

    setSaving(true);
    try {
      const url = '/api/bid-seal-applications';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, ...formData } : formData;

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
        setError(result.error || '保存失败');
      }
    } catch (err) {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除数据
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条盖章申请吗？')) return;

    try {
      const response = await fetch(`/api/bid-seal-applications?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        loadData();
      } else {
        alert(result.error || '删除失败');
      }
    } catch (err) {
      alert('删除失败');
    }
  };

  // 推送到任务中心
  const handlePushTask = async (id: number) => {
    setPushingTaskId(id);
    try {
      const response = await fetch(`/api/bid-seal-applications/${id}/push-task`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert('已推送到任务中心');
        loadData();
      } else {
        alert(result.error || '推送失败');
      }
    } catch (err) {
      alert('推送失败');
    } finally {
      setPushingTaskId(null);
    }
  };

  // 更新状态
  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const response = await fetch('/api/bid-seal-applications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      const result = await response.json();

      if (result.success) {
        loadData();
      } else {
        alert(result.error || '更新状态失败');
      }
    } catch (err) {
      alert('更新状态失败');
    }
  };

  // 获取状态样式
  const getStatusBadge = (status: string) => {
    const statusConfig = SEAL_STATUS.find(s => s.value === status);
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

  // 获取盖章方式显示
  const getSealMethodLabel = (method: string) => {
    const methodConfig = SEAL_METHODS.find(m => m.value === method);
    return methodConfig?.label || method;
  };

  // 获取优先级样式
  const getPriorityBadge = (priority: string) => {
    const priorityConfig = PRIORITIES.find(p => p.value === priority);
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
    };
    return (
      <Badge variant="outline" className={colorMap[priorityConfig?.color || 'gray']}>
        {priorityConfig?.label || priority}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stamp className="h-6 w-6" />
            盖章安排
          </h1>
          <p className="text-muted-foreground">管理投标项目的盖章安排</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          新增盖章安排
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待盖章</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">已完成</CardTitle>
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
                  {SEAL_STATUS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label>盖章方式</Label>
              <Select value={sealMethodFilter} onValueChange={setSealMethodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="全部方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部方式</SelectItem>
                  {SEAL_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
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
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <TableSkeleton rows={5} columns={8} />
          ) : applications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Stamp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无盖章安排数据</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>盖章方式</TableHead>
                  <TableHead>友司</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{application.projectName}</div>
                        {application.projectCode && (
                          <div className="text-sm text-muted-foreground">{application.projectCode}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getSealMethodLabel(application.sealMethod)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {application.partnerCompanyName || '-'}
                        {application.partnerCompanyAddress && (
                          <div className="text-muted-foreground text-xs flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {application.partnerCompanyAddress}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {application.sealDeadline ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(application.sealDeadline)}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {application.assigneeName || '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(application.status)}</TableCell>
                    <TableCell>{getPriorityBadge(application.priority)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(application)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(application)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {application.status !== 'completed' && application.status !== 'cancelled' && (
                          <>
                            {!application.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePushTask(application.id)}
                                disabled={pushingTaskId === application.id}
                              >
                                {pushingTaskId === application.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {application.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/tasks/${application.taskId}`)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        {application.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(application.id, 'in_progress')}
                          >
                            <Clock className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {application.status === 'in_progress' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(application.id, 'completed')}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(application.id)}
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
            <DialogTitle>{editingId ? '编辑盖章安排' : '新增盖章安排'}</DialogTitle>
            <DialogDescription>
              {editingId ? '修改盖章安排信息' : '创建新的盖章安排'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6 py-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">基本信息</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName">项目名称 *</Label>
                  <Input
                    id="projectName"
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    placeholder="请输入项目名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectCode">项目编号</Label>
                  <Input
                    id="projectCode"
                    value={formData.projectCode}
                    onChange={(e) => setFormData({ ...formData, projectCode: e.target.value })}
                    placeholder="请输入项目编号"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sealDeadline">盖章截止日期</Label>
                  <Input
                    id="sealDeadline"
                    type="date"
                    value={formData.sealDeadline}
                    onChange={(e) => setFormData({ ...formData, sealDeadline: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plannedDate">计划日期</Label>
                  <Input
                    id="plannedDate"
                    type="date"
                    value={formData.plannedDate}
                    onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">优先级</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 盖章方式 */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">盖章方式</h4>
              <div className="grid grid-cols-2 gap-4">
                {SEAL_METHODS.map((method) => (
                  <div
                    key={method.value}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      formData.sealMethod === method.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setFormData({ ...formData, sealMethod: method.value })}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{method.icon}</span>
                      <div>
                        <div className="font-medium">{method.label}</div>
                        <div className="text-sm text-muted-foreground">{method.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 友司信息 */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">友司信息</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="partnerCompanyId">友司公司</Label>
                  <Select
                    value={formData.partnerCompanyId}
                    onValueChange={handleCompanyChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择友司公司" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partnerContactId">友司对接人</Label>
                  <Select
                    value={formData.partnerContactId}
                    onValueChange={handleContactChange}
                    disabled={!formData.partnerCompanyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择对接人" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id.toString()}>
                          {contact.name} {contact.phone && `(${contact.phone})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formData.sealMethod === 'our_company' && (
                <div className="space-y-2">
                  <Label htmlFor="partnerCompanyAddress">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      友司地址（盖章地点）
                    </div>
                  </Label>
                  <Input
                    id="partnerCompanyAddress"
                    value={formData.partnerCompanyAddress}
                    onChange={(e) => setFormData({ ...formData, partnerCompanyAddress: e.target.value })}
                    placeholder="选择友司公司后自动填充，也可手动修改"
                  />
                  <p className="text-xs text-muted-foreground">地址从公司管理中自动获取，优先使用办公地址</p>
                </div>
              )}
            </div>

            {/* 盖章详情 */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">盖章详情</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sealCount">盖章份数</Label>
                  <Input
                    id="sealCount"
                    type="number"
                    min={1}
                    value={formData.sealCount}
                    onChange={(e) => setFormData({ ...formData, sealCount: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sealPurpose">盖章用途</Label>
                  <Input
                    id="sealPurpose"
                    value={formData.sealPurpose}
                    onChange={(e) => setFormData({ ...formData, sealPurpose: e.target.value })}
                    placeholder="如：投标文件盖章"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentType">文件类型</Label>
                  <Input
                    id="documentType"
                    value={formData.documentType}
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                    placeholder="如：投标文件、合同等"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialRequirements">特殊要求</Label>
                <Textarea
                  id="specialRequirements"
                  value={formData.specialRequirements}
                  onChange={(e) => setFormData({ ...formData, specialRequirements: e.target.value })}
                  placeholder="请输入特殊要求"
                  rows={2}
                />
              </div>
            </div>

            {/* 任务指派 */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">任务指派</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assigneeId">负责人</Label>
                  <Select
                    value={formData.assigneeId}
                    onValueChange={handleAssigneeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择负责人" />
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
                  <Label htmlFor="status">状态</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEAL_STATUS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks">备注</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="请输入备注信息"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>盖章安排详情</DialogTitle>
          </DialogHeader>
          
          {selectedApplication && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">项目名称</Label>
                  <div className="font-medium">{selectedApplication.projectName}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">项目编号</Label>
                  <div className="font-medium">{selectedApplication.projectCode || '-'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">盖章方式</Label>
                  <div className="font-medium">{getSealMethodLabel(selectedApplication.sealMethod)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">状态</Label>
                  <div>{getStatusBadge(selectedApplication.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">友司公司</Label>
                  <div className="font-medium">{selectedApplication.partnerCompanyName || '-'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">友司对接人</Label>
                  <div className="font-medium">
                    {selectedApplication.partnerContactName || '-'}
                    {selectedApplication.partnerContactPhone && (
                      <span className="text-muted-foreground ml-2">
                        ({selectedApplication.partnerContactPhone})
                      </span>
                    )}
                  </div>
                </div>
                {selectedApplication.sealMethod === 'our_company' && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      友司地址（盖章地点）
                    </Label>
                    <div className="font-medium">{selectedApplication.partnerCompanyAddress || '-'}</div>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">盖章份数</Label>
                  <div className="font-medium">{selectedApplication.sealCount || 1} 份</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">盖章用途</Label>
                  <div className="font-medium">{selectedApplication.sealPurpose || '-'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">截止日期</Label>
                  <div className="font-medium">
                    {selectedApplication.sealDeadline ? formatDate(selectedApplication.sealDeadline) : '-'}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">负责人</Label>
                  <div className="font-medium">{selectedApplication.assigneeName || '-'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">优先级</Label>
                  <div>{getPriorityBadge(selectedApplication.priority)}</div>
                </div>
                {selectedApplication.remarks && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">备注</Label>
                    <div className="font-medium">{selectedApplication.remarks}</div>
                  </div>
                )}
              </div>
              
              {selectedApplication.taskId && (
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/tasks/${selectedApplication.taskId}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    查看关联任务
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

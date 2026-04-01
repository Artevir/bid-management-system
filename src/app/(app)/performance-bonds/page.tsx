'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription as _CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Shield,
  Calendar,
  Send,
  ExternalLink,
  Ban,
  CheckCircle,
  Clock,
  FileText,
  DollarSign as _DollarSign,
  User,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/error-message';

// 履约保证金状态
const BOND_STATUS = [
  { value: 'pending', label: '待缴纳', color: 'yellow' },
  { value: 'processing', label: '处理中', color: 'blue' },
  { value: 'paid', label: '已缴纳', color: 'green' },
  { value: 'refunding', label: '退还中', color: 'purple' },
  { value: 'refunded', label: '已退还', color: 'gray' },
  { value: 'cancelled', label: '已取消', color: 'gray' },
];

// 缴纳方式
const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: '银行转账' },
  { value: 'bank_guarantee', label: '银行保函' },
  { value: 'insurance', label: '保险保函' },
  { value: 'other', label: '其他' },
];

interface PerformanceBond {
  id: number;
  projectId: number | null;
  projectName: string;
  projectCode: string | null;
  contractAmount: string | null;
  bondAmount: string;
  bondPercentage: string | null;
  isRequired: boolean;
  requirementSource: string | null;
  paymentDeadline: string | null;
  paymentMethod: string | null;
  payeeName: string | null;
  payeeBank: string | null;
  payeeAccount: string | null;
  handlerId: number | null;
  handlerName: string | null;
  handlerPhone: string | null;
  financeHandlerId: number | null;
  financeHandlerName: string | null;
  financeHandlerPhone: string | null;
  paidAt: string | null;
  paymentVoucher: string | null;
  paymentProof: string | null;
  refundDeadline: string | null;
  refundedAt: string | null;
  refundProof: string | null;
  riskWarning: string | null;
  status: string;
  remarks: string | null;
  taskId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Statistics {
  total: number;
  pending: number;
  processing: number;
  paid: number;
  refunding: number;
  refunded: number;
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

export default function PerformanceBondsPage() {
  const router = useRouter();
  const [bonds, setBonds] = useState<PerformanceBond[]>([]);
  const [stats, setStats] = useState<Statistics>({
    total: 0,
    pending: 0,
    processing: 0,
    paid: 0,
    refunding: 0,
    refunded: 0,
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
  const [selectedBond, setSelectedBond] = useState<PerformanceBond | null>(null);
  
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
    contractAmount: '',
    bondAmount: '',
    bondPercentage: '',
    isRequired: true,
    requirementSource: '',
    paymentDeadline: '',
    paymentMethod: '',
    payeeName: '',
    payeeBank: '',
    payeeAccount: '',
    handlerId: '',
    handlerName: '',
    handlerPhone: '',
    financeHandlerId: '',
    financeHandlerName: '',
    financeHandlerPhone: '',
    riskWarning: '',
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
      
      const response = await fetch(`/api/performance-bonds?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setBonds(result.data);
      } else {
        setError(extractErrorMessage(result, '加载数据失败'));
      }
      
      // 加载统计
      const statsResponse = await fetch('/api/performance-bonds?stats=true');
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
      const response = await fetch('/api/performance-bonds?users=true');
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
      const response = await fetch('/api/performance-bonds?projects=true');
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
  const handleEdit = (bond: PerformanceBond) => {
    setEditingId(bond.id);
    setFormData({
      projectId: bond.projectId?.toString() || '',
      projectName: bond.projectName,
      projectCode: bond.projectCode || '',
      contractAmount: bond.contractAmount || '',
      bondAmount: bond.bondAmount,
      bondPercentage: bond.bondPercentage || '',
      isRequired: bond.isRequired,
      requirementSource: bond.requirementSource || '',
      paymentDeadline: bond.paymentDeadline ? bond.paymentDeadline.split('T')[0] : '',
      paymentMethod: bond.paymentMethod || '',
      payeeName: bond.payeeName || '',
      payeeBank: bond.payeeBank || '',
      payeeAccount: bond.payeeAccount || '',
      handlerId: bond.handlerId?.toString() || '',
      handlerName: bond.handlerName || '',
      handlerPhone: bond.handlerPhone || '',
      financeHandlerId: bond.financeHandlerId?.toString() || '',
      financeHandlerName: bond.financeHandlerName || '',
      financeHandlerPhone: bond.financeHandlerPhone || '',
      riskWarning: bond.riskWarning || '',
      remarks: bond.remarks || '',
      status: bond.status,
    });
    setError('');
    setDialogOpen(true);
  };

  // 查看详情
  const handleView = (bond: PerformanceBond) => {
    setSelectedBond(bond);
    setDetailOpen(true);
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      projectId: '',
      projectName: '',
      projectCode: '',
      contractAmount: '',
      bondAmount: '',
      bondPercentage: '',
      isRequired: true,
      requirementSource: '',
      paymentDeadline: '',
      paymentMethod: '',
      payeeName: '',
      payeeBank: '',
      payeeAccount: '',
      handlerId: '',
      handlerName: '',
      handlerPhone: '',
      financeHandlerId: '',
      financeHandlerName: '',
      financeHandlerPhone: '',
      riskWarning: '',
      remarks: '',
      status: 'pending',
    });
    setError('');
  };

  // 从用户选择填充姓名（业务经办人）
  const handleHandlerSelect = (userId: string) => {
    const user = users.find(u => u.id === parseInt(userId));
    if (user) {
      setFormData({
        ...formData,
        handlerId: userId,
        handlerName: user.name,
      });
    }
  };

  // 从用户选择填充姓名（财务经办人）
  const handleFinanceHandlerSelect = (userId: string) => {
    const user = users.find(u => u.id === parseInt(userId));
    if (user) {
      setFormData({
        ...formData,
        financeHandlerId: userId,
        financeHandlerName: user.name,
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
    if (!formData.bondAmount) {
      setError('请填写履约保证金金额');
      return;
    }

    setSaving(true);
    try {
      const url = '/api/performance-bonds';
      const method = editingId ? 'PUT' : 'POST';
      const body = {
        id: editingId,
        ...formData,
        handlerId: formData.handlerId ? parseInt(formData.handlerId) : null,
        financeHandlerId: formData.financeHandlerId ? parseInt(formData.financeHandlerId) : null,
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
    if (!confirm('确定要删除这条履约保证金记录吗？')) return;

    try {
      const response = await fetch(`/api/performance-bonds?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        loadData();
      } else {
        alert(result.error || '删除失败');
      }
    } catch (_err) {
      alert('删除失败');
    }
  };

  // 推送到任务中心
  const handlePushTask = async (id: number) => {
    setPushingTaskId(id);
    try {
      const response = await fetch(`/api/performance-bonds/${id}/push-task`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert('已推送到任务中心');
        loadData();
      } else {
        alert(result.error || '推送失败');
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
      const response = await fetch('/api/performance-bonds', {
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
    } catch (_err) {
      alert('更新状态失败');
    }
  };

  // 获取状态样式
  const getStatusBadge = (status: string) => {
    const statusConfig = BOND_STATUS.find(s => s.value === status);
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      purple: 'bg-purple-100 text-purple-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colorMap[statusConfig?.color || 'gray']}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  // 获取缴纳方式显示
  const getPaymentMethodLabel = (method: string) => {
    const methodConfig = PAYMENT_METHODS.find(m => m.value === method);
    return methodConfig?.label || method;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            履约保证金
          </h1>
          <p className="text-muted-foreground">
            管理履约保证金缴纳，金额不超过中标合同金额10%，履约完毕后按约定退还
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          新增履约保证金
        </Button>
      </div>

      {/* 风险提示 */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>风险提示：</strong>不缴纳履约保证金可能导致取消中标资格、不退投标保证金，请务必按时缴纳！
        </AlertDescription>
      </Alert>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待缴纳</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">处理中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已缴纳</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">退还中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.refunding}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已退还</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.refunded}</div>
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
                  {BOND_STATUS.map((status) => (
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
            <TableSkeleton rows={5} columns={7} />
          ) : bonds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无履约保证金数据</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>保证金金额</TableHead>
                  <TableHead>缴纳截止</TableHead>
                  <TableHead>业务经办人</TableHead>
                  <TableHead>财务经办人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonds.map((bond) => (
                  <TableRow key={bond.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{bond.projectName}</div>
                        {bond.projectCode && (
                          <div className="text-sm text-muted-foreground">{bond.projectCode}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-green-600">{bond.bondAmount}</div>
                      {bond.bondPercentage && (
                        <div className="text-sm text-muted-foreground">{bond.bondPercentage}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {bond.paymentDeadline ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(bond.paymentDeadline)}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{bond.handlerName || '-'}</div>
                        {bond.handlerPhone && (
                          <div className="text-sm text-muted-foreground">{bond.handlerPhone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{bond.financeHandlerName || '-'}</div>
                        {bond.financeHandlerPhone && (
                          <div className="text-sm text-muted-foreground">{bond.financeHandlerPhone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(bond.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(bond)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(bond)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {bond.status !== 'refunded' && bond.status !== 'cancelled' && (
                          <>
                            {!bond.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePushTask(bond.id)}
                                disabled={pushingTaskId === bond.id}
                              >
                                {pushingTaskId === bond.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {bond.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/tasks/${bond.taskId}`)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        {bond.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(bond.id, 'processing')}
                          >
                            <Clock className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {bond.status === 'processing' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(bond.id, 'paid')}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {bond.status === 'paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(bond.id, 'refunding')}
                            title="申请退还"
                          >
                            <RotateCcw className="h-4 w-4 text-purple-600" />
                          </Button>
                        )}
                        {bond.status === 'refunding' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(bond.id, 'refunded')}
                          >
                            <CheckCircle className="h-4 w-4 text-gray-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(bond.id)}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑履约保证金' : '新增履约保证金'}</DialogTitle>
            <DialogDescription>
              填写履约保证金信息，金额不超过中标合同金额10%
            </DialogDescription>
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
                      const project = projects.find(p => p.id === parseInt(value));
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
                  <Label>中标合同金额</Label>
                  <Input
                    value={formData.contractAmount}
                    onChange={(e) => setFormData({ ...formData, contractAmount: e.target.value })}
                    placeholder="例如：100万元"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 保证金信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">保证金信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.isRequired}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, isRequired: checked as boolean })
                      }
                    />
                    <Label className="font-normal">需要缴纳履约保证金</Label>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>履约保证金金额 *</Label>
                    <Input
                      value={formData.bondAmount}
                      onChange={(e) => setFormData({ ...formData, bondAmount: e.target.value })}
                      placeholder="例如：10万元"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>占合同金额百分比</Label>
                    <Input
                      value={formData.bondPercentage}
                      onChange={(e) => setFormData({ ...formData, bondPercentage: e.target.value })}
                      placeholder="例如：10%"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>缴纳截止日期</Label>
                    <Input
                      type="date"
                      value={formData.paymentDeadline}
                      onChange={(e) => setFormData({ ...formData, paymentDeadline: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>缴纳方式</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择缴纳方式" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>要求来源（招标文件条款）</Label>
                    <Input
                      value={formData.requirementSource}
                      onChange={(e) => setFormData({ ...formData, requirementSource: e.target.value })}
                      placeholder="例如：招标文件第X章第X条"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 收款方信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">收款方信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>收款单位</Label>
                  <Input
                    value={formData.payeeName}
                    onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                    placeholder="输入收款单位名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label>开户银行</Label>
                  <Input
                    value={formData.payeeBank}
                    onChange={(e) => setFormData({ ...formData, payeeBank: e.target.value })}
                    placeholder="输入开户银行"
                  />
                </div>
                <div className="space-y-2">
                  <Label>银行账号</Label>
                  <Input
                    value={formData.payeeAccount}
                    onChange={(e) => setFormData({ ...formData, payeeAccount: e.target.value })}
                    placeholder="输入银行账号"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 经办人信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">经办人信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 业务经办人 */}
                <div>
                  <Label className="text-muted-foreground">业务经办人</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="space-y-2">
                      <Select
                        value={formData.handlerId}
                        onValueChange={handleHandlerSelect}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择经办人" />
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
                      <Input
                        value={formData.handlerName}
                        onChange={(e) => setFormData({ ...formData, handlerName: e.target.value })}
                        placeholder="姓名"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={formData.handlerPhone}
                        onChange={(e) => setFormData({ ...formData, handlerPhone: e.target.value })}
                        placeholder="联系电话"
                      />
                    </div>
                  </div>
                </div>
                
                {/* 财务经办人 */}
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">财务经办人</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="space-y-2">
                      <Select
                        value={formData.financeHandlerId}
                        onValueChange={handleFinanceHandlerSelect}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择财务经办人" />
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
                      <Input
                        value={formData.financeHandlerName}
                        onChange={(e) => setFormData({ ...formData, financeHandlerName: e.target.value })}
                        placeholder="姓名"
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={formData.financeHandlerPhone}
                        onChange={(e) => setFormData({ ...formData, financeHandlerPhone: e.target.value })}
                        placeholder="联系电话"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 风险提示与备注 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">其他信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>风险提示</Label>
                  <Textarea
                    value={formData.riskWarning}
                    onChange={(e) => setFormData({ ...formData, riskWarning: e.target.value })}
                    placeholder="输入不缴纳的风险提示，例如：不缴纳将取消中标资格、不退投标保证金等"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="输入备注信息"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
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
            <DialogTitle>履约保证金详情</DialogTitle>
          </DialogHeader>
          
          {selectedBond && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">项目名称</Label>
                  <p className="font-medium">{selectedBond.projectName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">项目编号</Label>
                  <p className="font-medium">{selectedBond.projectCode || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">中标合同金额</Label>
                  <p className="font-medium">{selectedBond.contractAmount || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">履约保证金金额</Label>
                  <p className="font-medium text-green-600">{selectedBond.bondAmount}</p>
                </div>
              </div>

              {/* 缴纳信息 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">缴纳信息</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <span className="text-sm">缴纳截止日期：</span>
                    <span>{selectedBond.paymentDeadline ? formatDate(selectedBond.paymentDeadline) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-sm">缴纳方式：</span>
                    <span>{selectedBond.paymentMethod ? getPaymentMethodLabel(selectedBond.paymentMethod) : '-'}</span>
                  </div>
                </div>
              </div>

              {/* 收款方信息 */}
              {selectedBond.payeeName && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">收款方信息</Label>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">收款单位：{selectedBond.payeeName}</p>
                    {selectedBond.payeeBank && (
                      <p className="text-sm">开户银行：{selectedBond.payeeBank}</p>
                    )}
                    {selectedBond.payeeAccount && (
                      <p className="text-sm">银行账号：{selectedBond.payeeAccount}</p>
                    )}
                  </div>
                </div>
              )}

              {/* 经办人信息 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">经办人信息</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-sm font-medium">业务经办人</p>
                    <p className="text-sm">{selectedBond.handlerName || '-'}</p>
                    {selectedBond.handlerPhone && (
                      <p className="text-sm text-muted-foreground">{selectedBond.handlerPhone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">财务经办人</p>
                    <p className="text-sm">{selectedBond.financeHandlerName || '-'}</p>
                    {selectedBond.financeHandlerPhone && (
                      <p className="text-sm text-muted-foreground">{selectedBond.financeHandlerPhone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 风险提示 */}
              {selectedBond.riskWarning && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">风险提示</Label>
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{selectedBond.riskWarning}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* 备注 */}
              {selectedBond.remarks && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">备注</Label>
                  <p className="mt-1 whitespace-pre-wrap">{selectedBond.remarks}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
            <Button onClick={() => {
              setDetailOpen(false);
              if (selectedBond) {
                handleEdit(selectedBond);
              }
            }}>
              编辑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  DollarSign,
  Calendar as _Calendar,
  Building2 as _Building2,
  FileText as _FileText,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  User,
  Send,
  ExternalLink,
  Ban,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/error-message';

// 保证金类型
const GUARANTEE_TYPES = [
  { value: 'cash', label: '现金' },
  { value: 'bank_guarantee', label: '银行保函' },
  { value: 'insurance', label: '保险保函' },
];

// 保证金状态
const GUARANTEE_STATUS = [
  { value: 'pending', label: '待缴纳', color: 'yellow' },
  { value: 'paid', label: '已缴纳', color: 'blue' },
  { value: 'returned', label: '已退还', color: 'green' },
  { value: 'forfeited', label: '已没收', color: 'red' },
];

// 退还状态
const RETURN_STATUS = [
  { value: 'not_applied', label: '未申请', color: 'gray' },
  { value: 'applied', label: '已申请', color: 'yellow' },
  { value: 'processing', label: '处理中', color: 'blue' },
  { value: 'returned', label: '已退还', color: 'green' },
  { value: 'rejected', label: '已拒绝', color: 'red' },
];

// 优先级
const PRIORITIES = [
  { value: 'high', label: '高', color: 'red' },
  { value: 'medium', label: '中', color: 'yellow' },
  { value: 'low', label: '低', color: 'green' },
];

interface Guarantee {
  id: number;
  projectId: number;
  amount: string;
  currency: string;
  type: string;
  guaranteeNumber: string | null;
  issuingBank: string | null;
  guaranteeValidFrom: string | null;
  guaranteeValidTo: string | null;
  guaranteeFile: string | null;
  plannedDate: string | null;
  actualDate: string | null;
  paymentDate: string | null;
  paymentVoucher: string | null;
  paymentMethod: string | null;
  returnApplicationDate: string | null;
  returnStatus: string | null;
  returnHandlerId: number | null;
  returnHandlerName: string | null;
  returnApprovedAt: string | null;
  returnDate: string | null;
  returnAmount: string | null;
  returnVoucher: string | null;
  returnReason: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  priority: string | null;
  taskId: number | null;
  pushedToTask: boolean | null;
  pushedAt: string | null;
  status: string;
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

interface User {
  id: number;
  name: string;
  email: string;
}

export default function GuaranteesPage() {
  const router = useRouter();
  const [guarantees, setGuarantees] = useState<Guarantee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 搜索和筛选
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // 创建对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 缴纳/退还对话框
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnApplyDialogOpen, setReturnApplyDialogOpen] = useState(false);
  const [selectedGuarantee, setSelectedGuarantee] = useState<Guarantee | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    projectId: '',
    amount: '',
    type: 'cash',
    guaranteeNumber: '',
    issuingBank: '',
    guaranteeValidFrom: '',
    guaranteeValidTo: '',
    plannedDate: '',
    notes: '',
    assigneeId: '',
    assigneeName: '',
    priority: 'medium',
  });

  const [payFormData, setPayFormData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentVoucher: '',
    paymentMethod: 'bank_transfer',
  });

  const [returnFormData, setReturnFormData] = useState({
    returnDate: new Date().toISOString().split('T')[0],
    returnAmount: '',
    returnVoucher: '',
    returnReason: '',
  });

  const [returnApplyData, setReturnApplyData] = useState({
    returnAmount: '',
    returnReason: '',
  });

  useEffect(() => {
    fetchGuarantees();
    fetchProjects();
    fetchUsers();
  }, [page, filterStatus, filterType]);

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

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users?pageSize=100');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const fetchGuarantees = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      if (filterType && filterType !== 'all') params.set('type', filterType);

      const res = await fetch(`/api/guarantees?${params}`);
      if (!res.ok) {
        throw new Error('获取保证金列表失败');
      }

      const data = await res.json();
      setGuarantees(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取保证金列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchGuarantees();
  };

  const handleCreate = async () => {
    if (!formData.projectId) {
      setError('请选择关联项目');
      return;
    }
    if (!formData.amount) {
      setError('请输入保证金金额');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/guarantees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: parseInt(formData.projectId),
          amount: formData.amount,
          type: formData.type,
          guaranteeNumber: formData.guaranteeNumber || null,
          issuingBank: formData.issuingBank || null,
          guaranteeValidFrom: formData.guaranteeValidFrom || null,
          guaranteeValidTo: formData.guaranteeValidTo || null,
          plannedDate: formData.plannedDate || null,
          notes: formData.notes || null,
          assigneeId: formData.assigneeId ? parseInt(formData.assigneeId) : null,
          assigneeName: formData.assigneeName || null,
          priority: formData.priority,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '创建保证金失败'));
      }

      setCreateDialogOpen(false);
      resetForm();
      fetchGuarantees();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建保证金失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async () => {
    if (!selectedGuarantee) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/guarantees/${selectedGuarantee.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payFormData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '标记缴纳失败'));
      }

      setPayDialogOpen(false);
      setSelectedGuarantee(null);
      resetPayForm();
      fetchGuarantees();
    } catch (err) {
      setError(err instanceof Error ? err.message : '标记缴纳失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnApply = async () => {
    if (!selectedGuarantee) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/guarantees/${selectedGuarantee.id}/return-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnApplyData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '申请退还失败'));
      }

      setReturnApplyDialogOpen(false);
      setSelectedGuarantee(null);
      resetReturnApplyForm();
      fetchGuarantees();
    } catch (err) {
      setError(err instanceof Error ? err.message : '申请退还失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedGuarantee) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/guarantees/${selectedGuarantee.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnFormData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '标记退还失败'));
      }

      setReturnDialogOpen(false);
      setSelectedGuarantee(null);
      resetReturnForm();
      fetchGuarantees();
    } catch (err) {
      setError(err instanceof Error ? err.message : '标记退还失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePushTask = async (guarantee: Guarantee) => {
    if (!guarantee.assigneeId) {
      setError('请先指派负责人后再推送到任务中心');
      return;
    }

    try {
      const res = await fetch(`/api/guarantees/${guarantee.id}/push-task`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '推送失败'));
      }

      fetchGuarantees();
    } catch (err) {
      setError(err instanceof Error ? err.message : '推送失败');
    }
  };

  const handleCancelPushTask = async (guarantee: Guarantee) => {
    try {
      const res = await fetch(`/api/guarantees/${guarantee.id}/push-task`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '取消推送失败'));
      }

      fetchGuarantees();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消推送失败');
    }
  };

  const resetForm = () => {
    setFormData({
      projectId: '',
      amount: '',
      type: 'cash',
      guaranteeNumber: '',
      issuingBank: '',
      guaranteeValidFrom: '',
      guaranteeValidTo: '',
      plannedDate: '',
      notes: '',
      assigneeId: '',
      assigneeName: '',
      priority: 'medium',
    });
    setError('');
  };

  const resetPayForm = () => {
    setPayFormData({
      paymentDate: new Date().toISOString().split('T')[0],
      paymentVoucher: '',
      paymentMethod: 'bank_transfer',
    });
  };

  const resetReturnForm = () => {
    setReturnFormData({
      returnDate: new Date().toISOString().split('T')[0],
      returnAmount: '',
      returnVoucher: '',
      returnReason: '',
    });
  };

  const resetReturnApplyForm = () => {
    setReturnApplyData({
      returnAmount: '',
      returnReason: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = GUARANTEE_STATUS.find(s => s.value === status);
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colorMap[statusInfo?.color || 'yellow']}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const getReturnStatusBadge = (returnStatus: string | null) => {
    const statusInfo = RETURN_STATUS.find(s => s.value === returnStatus);
    const colorMap: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={colorMap[statusInfo?.color || 'gray']}>
        {statusInfo?.label || returnStatus || '未申请'}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string | null) => {
    const info = PRIORITIES.find(p => p.value === priority);
    if (!info) return null;
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
    };
    return (
      <Badge className={colorMap[info.color]} variant="outline">
        {info.label}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    return GUARANTEE_TYPES.find(t => t.value === type)?.label || type;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'paid': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'returned': return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case 'forfeited': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">保证金管理</h1>
          <p className="text-muted-foreground">管理投标保证金申请、缴纳、退还全流程</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              新建保证金
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建保证金</DialogTitle>
              <DialogDescription>创建新的投标保证金记录</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{String(error)}</AlertDescription>
                </Alert>
              )}

              {/* 基本信息 */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">基本信息</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project">关联项目 *</Label>
                    <Select
                      value={formData.projectId}
                      onValueChange={(value) => setFormData({ ...formData, projectId: value })}
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
                    <Label htmlFor="amount">保证金金额 *</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="请输入金额"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">保证金类型</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {GUARANTEE_TYPES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plannedDate">计划缴纳日期</Label>
                    <Input
                      id="plannedDate"
                      type="date"
                      value={formData.plannedDate}
                      onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 保函信息 */}
              {formData.type === 'bank_guarantee' && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">保函信息</h4>
                  <div className="space-y-2">
                    <Label htmlFor="guaranteeNumber">保函编号</Label>
                    <Input
                      id="guaranteeNumber"
                      value={formData.guaranteeNumber}
                      onChange={(e) => setFormData({ ...formData, guaranteeNumber: e.target.value })}
                      placeholder="银行保函编号"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issuingBank">开证银行</Label>
                    <Input
                      id="issuingBank"
                      value={formData.issuingBank}
                      onChange={(e) => setFormData({ ...formData, issuingBank: e.target.value })}
                      placeholder="请输入开证银行"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="validFrom">有效期起</Label>
                      <Input
                        id="validFrom"
                        type="date"
                        value={formData.guaranteeValidFrom}
                        onChange={(e) => setFormData({ ...formData, guaranteeValidFrom: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validTo">有效期止</Label>
                      <Input
                        id="validTo"
                        type="date"
                        value={formData.guaranteeValidTo}
                        onChange={(e) => setFormData({ ...formData, guaranteeValidTo: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 任务指派 */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">任务指派</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignee">负责人</Label>
                    <Select
                      value={formData.assigneeId}
                      onValueChange={(value) => {
                        const user = users.find(u => u.id.toString() === value);
                        setFormData({
                          ...formData,
                          assigneeId: value,
                          assigneeName: user?.name || '',
                        });
                      }}
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
                    <Label htmlFor="priority">优先级</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择优先级" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 备注 */}
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
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待缴纳</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {guarantees.filter(g => g.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已缴纳</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {guarantees.filter(g => g.status === 'paid').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已退还</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {guarantees.filter(g => g.status === 'returned').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已没收</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {guarantees.filter(g => g.status === 'forfeited').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待退还</CardTitle>
            <RefreshCw className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {guarantees.filter(g => g.returnStatus === 'applied' || g.returnStatus === 'processing').length}
            </div>
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
                  placeholder="搜索保证金..."
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
                {GUARANTEE_STATUS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="类型筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {GUARANTEE_TYPES.map((item) => (
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

      {/* 保证金列表 */}
      <Card>
        <CardHeader>
          <CardTitle>保证金列表</CardTitle>
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
            <TableSkeleton rows={5} columns={8} />
          ) : guarantees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无保证金记录</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                新建保证金
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>金额</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>计划日期</TableHead>
                  <TableHead>退还状态</TableHead>
                  <TableHead>推送</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guarantees.map((guarantee) => (
                  <TableRow key={guarantee.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatCurrency(parseFloat(guarantee.amount))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeLabel(guarantee.type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(guarantee.status)}
                        {getStatusBadge(guarantee.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {guarantee.assigneeName ? (
                          <>
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{guarantee.assigneeName}</span>
                            {getPriorityBadge(guarantee.priority)}
                          </>
                        ) : (
                          <span className="text-muted-foreground">未指派</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {guarantee.plannedDate ? formatDate(guarantee.plannedDate) : '-'}
                    </TableCell>
                    <TableCell>
                      {guarantee.status === 'paid' && getReturnStatusBadge(guarantee.returnStatus)}
                    </TableCell>
                    <TableCell>
                      {guarantee.pushedToTask ? (
                        <Badge className="bg-green-100 text-green-800">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          已推送
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {guarantee.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedGuarantee(guarantee);
                              setPayDialogOpen(true);
                            }}
                          >
                            <ArrowUpRight className="h-4 w-4 mr-1" />
                            缴纳
                          </Button>
                        )}
                        {guarantee.status === 'paid' && !guarantee.returnStatus?.includes('applied') && !guarantee.returnStatus?.includes('processing') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedGuarantee(guarantee);
                              setReturnApplyDialogOpen(true);
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            申请退还
                          </Button>
                        )}
                        {(guarantee.returnStatus === 'applied' || guarantee.returnStatus === 'processing') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedGuarantee(guarantee);
                              setReturnDialogOpen(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            完成退还
                          </Button>
                        )}
                        {!guarantee.pushedToTask && guarantee.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePushTask(guarantee)}
                            disabled={!guarantee.assigneeId}
                            title={!guarantee.assigneeId ? '请先指派负责人' : '推送到任务中心'}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {guarantee.pushedToTask && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelPushTask(guarantee)}
                            title="取消推送"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/guarantees/${guarantee.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
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

      {/* 缴纳对话框 */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认缴纳</DialogTitle>
            <DialogDescription>标记保证金为已缴纳状态</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {selectedGuarantee && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">保证金金额</div>
                <div className="text-xl font-bold">
                  {formatCurrency(parseFloat(selectedGuarantee.amount))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="paymentDate">缴纳日期</Label>
              <Input
                id="paymentDate"
                type="date"
                value={payFormData.paymentDate}
                onChange={(e) => setPayFormData({ ...payFormData, paymentDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">缴纳方式</Label>
              <Select
                value={payFormData.paymentMethod}
                onValueChange={(value) => setPayFormData({ ...payFormData, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">银行转账</SelectItem>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentVoucher">缴费凭证</Label>
              <Input
                id="paymentVoucher"
                value={payFormData.paymentVoucher}
                onChange={(e) => setPayFormData({ ...payFormData, paymentVoucher: e.target.value })}
                placeholder="凭证编号或链接"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handlePay} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认缴纳
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 申请退还对话框 */}
      <Dialog open={returnApplyDialogOpen} onOpenChange={setReturnApplyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>申请退还保证金</DialogTitle>
            <DialogDescription>提交退还申请</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {selectedGuarantee && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">保证金金额</div>
                <div className="text-xl font-bold">
                  {formatCurrency(parseFloat(selectedGuarantee.amount))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="returnAmountApply">退还金额（可选）</Label>
              <Input
                id="returnAmountApply"
                type="number"
                value={returnApplyData.returnAmount}
                onChange={(e) => setReturnApplyData({ ...returnApplyData, returnAmount: e.target.value })}
                placeholder="默认全额退还"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnReasonApply">退还原因</Label>
              <Textarea
                id="returnReasonApply"
                value={returnApplyData.returnReason}
                onChange={(e) => setReturnApplyData({ ...returnApplyData, returnReason: e.target.value })}
                placeholder="请输入退还原因"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnApplyDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleReturnApply} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              提交申请
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 完成退还对话框 */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认退还</DialogTitle>
            <DialogDescription>标记保证金为已退还状态</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {selectedGuarantee && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">保证金金额</div>
                <div className="text-xl font-bold">
                  {formatCurrency(parseFloat(selectedGuarantee.amount))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="returnDate">退还日期</Label>
              <Input
                id="returnDate"
                type="date"
                value={returnFormData.returnDate}
                onChange={(e) => setReturnFormData({ ...returnFormData, returnDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnAmount">退还金额</Label>
              <Input
                id="returnAmount"
                type="number"
                value={returnFormData.returnAmount}
                onChange={(e) => setReturnFormData({ ...returnFormData, returnAmount: e.target.value })}
                placeholder="默认全额退还"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnVoucher">退还凭证</Label>
              <Input
                id="returnVoucher"
                value={returnFormData.returnVoucher}
                onChange={(e) => setReturnFormData({ ...returnFormData, returnVoucher: e.target.value })}
                placeholder="凭证编号或链接"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnReason">退还原因</Label>
              <Textarea
                id="returnReason"
                value={returnFormData.returnReason}
                onChange={(e) => setReturnFormData({ ...returnFormData, returnReason: e.target.value })}
                placeholder="请输入退还原因"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleReturn} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认退还
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

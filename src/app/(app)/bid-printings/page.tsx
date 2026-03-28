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
  Printer,
  Calendar,
  Building2,
  User,
  Send,
  ExternalLink,
  Ban,
  CheckCircle,
  Clock,
  FileText,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

// 打印状态
const PRINTING_STATUS = [
  { value: 'pending', label: '待打印', color: 'yellow' },
  { value: 'printing', label: '打印中', color: 'blue' },
  { value: 'completed', label: '已完成', color: 'green' },
  { value: 'cancelled', label: '已取消', color: 'gray' },
];

// 打印方式
const PRINTING_METHODS = [
  { value: 'our_company', label: '本公司打印', icon: '🏢' },
  { value: 'partner_company', label: '去友司打印', icon: '🤝' },
  { value: 'together', label: '一起打印', icon: '👥' },
];

// 优先级
const PRIORITIES = [
  { value: 'high', label: '高', color: 'red' },
  { value: 'medium', label: '中', color: 'yellow' },
  { value: 'low', label: '低', color: 'green' },
];

// 纸张大小
const PAPER_SIZES = [
  { value: 'A4', label: 'A4' },
  { value: 'A3', label: 'A3' },
  { value: 'B5', label: 'B5' },
];

// 颜色模式
const COLOR_MODES = [
  { value: 'bw', label: '黑白' },
  { value: 'color', label: '彩色' },
];

// 装订方式
const BINDING_METHODS = [
  { value: '', label: '无' },
  { value: 'staple', label: '钉装' },
  { value: 'glue', label: '胶装' },
  { value: 'spiral', label: '螺旋装订' },
  { value: 'hardcover', label: '精装' },
];

interface Printing {
  id: number;
  projectId: number | null;
  projectName: string;
  projectCode: string | null;
  printingDeadline: string | null;
  plannedDate: string | null;
  actualDate: string | null;
  printingMethod: string;
  partnerCompanyId: number | null;
  partnerCompanyName: string | null;
  partnerContactId: number | null;
  partnerContactName: string | null;
  partnerContactPhone: string | null;
  copiesCount: number | null;
  paperSize: string | null;
  colorMode: string | null;
  bindingMethod: string | null;
  specialRequirements: string | null;
  ourContactId: number | null;
  ourContactName: string | null;
  ourContactPhone: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  priority: string | null;
  taskId: number | null;
  pushedToTask: boolean | null;
  pushedAt: string | null;
  remarks: string | null;
  status: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  name: string;
}

interface Company {
  id: number;
  name: string;
}

interface Contact {
  id: number;
  name: string;
  phone: string | null;
}

export default function BidPrintingsPage() {
  const router = useRouter();
  const [printings, setPrintings] = useState<Printing[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    byStatus: {} as Record<string, number>,
    byMethod: {} as Record<string, number>,
  });

  // 搜索和筛选
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMethod, setFilterMethod] = useState<string>('all');

  // 创建对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 详情/编辑对话框
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPrinting, setSelectedPrinting] = useState<Printing | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    projectId: '',
    projectName: '',
    projectCode: '',
    printingDeadline: '',
    plannedDate: '',
    printingMethod: 'our_company',
    partnerCompanyId: '',
    partnerCompanyName: '',
    partnerContactId: '',
    partnerContactName: '',
    partnerContactPhone: '',
    copiesCount: 5, // 默认一正四副
    paperSize: 'A4',
    colorMode: 'bw',
    bindingMethod: '',
    specialRequirements: '',
    ourContactId: '',
    ourContactName: '',
    ourContactPhone: '',
    assigneeId: '',
    assigneeName: '',
    priority: 'medium',
    remarks: '',
  });

  useEffect(() => {
    fetchPrintings();
    fetchUsers();
    fetchCompanies();
  }, [filterStatus, filterMethod]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/bid-printings?users=true');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/bid-printings?companies=true');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (err) {
      console.error('Fetch companies error:', err);
    }
  };

  const fetchContacts = async (companyId: number) => {
    try {
      const res = await fetch(`/api/bid-printings?contacts=true&companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (err) {
      console.error('Fetch contacts error:', err);
    }
  };

  const fetchPrintings = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      if (filterMethod && filterMethod !== 'all') params.set('printingMethod', filterMethod);
      if (keyword) params.set('keyword', keyword);

      const res = await fetch(`/api/bid-printings?${params}`);
      if (!res.ok) {
        throw new Error('获取打印安排列表失败');
      }

      const data = await res.json();
      setPrintings(data.data || []);
      setStats(data.stats || { total: 0, byStatus: {}, byMethod: {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取打印安排列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchPrintings();
  };

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find(c => c.id.toString() === companyId);
    setFormData({
      ...formData,
      partnerCompanyId: companyId,
      partnerCompanyName: company?.name || '',
      partnerContactId: '',
      partnerContactName: '',
      partnerContactPhone: '',
    });
    if (companyId) {
      fetchContacts(parseInt(companyId));
      setContacts([]);
    } else {
      setContacts([]);
    }
  };

  const handleContactChange = (contactId: string) => {
    const contact = contacts.find(c => c.id.toString() === contactId);
    setFormData({
      ...formData,
      partnerContactId: contactId,
      partnerContactName: contact?.name || '',
      partnerContactPhone: contact?.phone || '',
    });
  };

  const handleAssigneeChange = (userId: string) => {
    const user = users.find(u => u.id.toString() === userId);
    setFormData({
      ...formData,
      assigneeId: userId,
      assigneeName: user?.name || '',
    });
  };

  const handleCreate = async () => {
    if (!formData.projectName) {
      setError('项目名称为必填项');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/bid-printings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: formData.projectId ? parseInt(formData.projectId) : null,
          projectName: formData.projectName,
          projectCode: formData.projectCode || null,
          printingDeadline: formData.printingDeadline || null,
          plannedDate: formData.plannedDate || null,
          printingMethod: formData.printingMethod,
          partnerCompanyId: formData.partnerCompanyId ? parseInt(formData.partnerCompanyId) : null,
          partnerCompanyName: formData.partnerCompanyName || null,
          partnerContactId: formData.partnerContactId ? parseInt(formData.partnerContactId) : null,
          partnerContactName: formData.partnerContactName || null,
          partnerContactPhone: formData.partnerContactPhone || null,
          copiesCount: formData.copiesCount,
          paperSize: formData.paperSize,
          colorMode: formData.colorMode,
          bindingMethod: formData.bindingMethod || null,
          specialRequirements: formData.specialRequirements || null,
          ourContactId: formData.ourContactId ? parseInt(formData.ourContactId) : null,
          ourContactName: formData.ourContactName || null,
          ourContactPhone: formData.ourContactPhone || null,
          assigneeId: formData.assigneeId ? parseInt(formData.assigneeId) : null,
          assigneeName: formData.assigneeName || null,
          priority: formData.priority,
          remarks: formData.remarks || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '创建打印安排失败');
      }

      setCreateDialogOpen(false);
      resetForm();
      fetchPrintings();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建打印安排失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (printing: Printing, newStatus: string) => {
    try {
      const res = await fetch('/api/bid-printings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: printing.id,
          status: newStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '更新状态失败');
      }

      fetchPrintings();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新状态失败');
    }
  };

  const handlePushTask = async (printing: Printing) => {
    if (!printing.assigneeId) {
      setError('请先指派负责人后再推送到任务中心');
      return;
    }

    try {
      const res = await fetch(`/api/bid-printings/${printing.id}/push-task`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '推送失败');
      }

      fetchPrintings();
    } catch (err) {
      setError(err instanceof Error ? err.message : '推送失败');
    }
  };

  const handleCancelPushTask = async (printing: Printing) => {
    try {
      const res = await fetch(`/api/bid-printings/${printing.id}/push-task`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '取消推送失败');
      }

      fetchPrintings();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消推送失败');
    }
  };

  const handleDelete = async (printing: Printing) => {
    if (!confirm('确定要删除这条打印安排吗？')) return;

    try {
      const res = await fetch(`/api/bid-printings?id=${printing.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '删除失败');
      }

      fetchPrintings();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const resetForm = () => {
    setFormData({
      projectId: '',
      projectName: '',
      projectCode: '',
      printingDeadline: '',
      plannedDate: '',
      printingMethod: 'our_company',
      partnerCompanyId: '',
      partnerCompanyName: '',
      partnerContactId: '',
      partnerContactName: '',
      partnerContactPhone: '',
      copiesCount: 5, // 默认一正四副
      paperSize: 'A4',
      colorMode: 'bw',
      bindingMethod: '',
      specialRequirements: '',
      ourContactId: '',
      ourContactName: '',
      ourContactPhone: '',
      assigneeId: '',
      assigneeName: '',
      priority: 'medium',
      remarks: '',
    });
    setError('');
    setContacts([]);
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = PRINTING_STATUS.find(s => s.value === status);
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colorMap[statusInfo?.color || 'yellow']}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const getMethodBadge = (method: string) => {
    const methodInfo = PRINTING_METHODS.find(m => m.value === method);
    return (
      <Badge variant="outline" className="gap-1">
        <span>{methodInfo?.icon}</span>
        {methodInfo?.label || method}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string | null) => {
    const info = PRIORITIES.find(p => p.value === priority);
    if (!info) return null;
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-800 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      green: 'bg-green-100 text-green-800 border-green-200',
    };
    return (
      <Badge className={colorMap[info.color]} variant="outline">
        {info.label}
      </Badge>
    );
  };

  const showPartnerFields = ['partner_company', 'together'].includes(formData.printingMethod);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">打印标书安排</h1>
          <p className="text-muted-foreground">管理标书打印安排、友司协调、任务指派</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              新建打印安排
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建打印标书安排</DialogTitle>
              <DialogDescription>创建新的标书打印安排</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 项目信息 */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">项目信息</h4>
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
              </div>

              {/* 时间安排 */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">时间安排</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="printingDeadline">打印截止时间</Label>
                    <Input
                      id="printingDeadline"
                      type="datetime-local"
                      value={formData.printingDeadline}
                      onChange={(e) => setFormData({ ...formData, printingDeadline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plannedDate">计划打印日期</Label>
                    <Input
                      id="plannedDate"
                      type="date"
                      value={formData.plannedDate}
                      onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 打印方式 */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">打印方式</h4>
                <Select
                  value={formData.printingMethod}
                  onValueChange={(value) => setFormData({ ...formData, printingMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择打印方式" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINTING_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <span className="mr-2">{method.icon}</span>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 友司信息（当选择去友司打印或一起打印时显示） */}
                {showPartnerFields && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <h5 className="font-medium text-sm">友司信息</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="partnerCompany">友司公司</Label>
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
                        <Label htmlFor="partnerContact">对接人</Label>
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
                  </div>
                )}
              </div>

              {/* 打印详情 */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">打印详情</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="copiesCount">打印份数 <span className="text-muted-foreground text-xs">(默认一正四副)</span></Label>
                    <Input
                      id="copiesCount"
                      type="number"
                      min={1}
                      value={formData.copiesCount}
                      onChange={(e) => setFormData({ ...formData, copiesCount: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paperSize">纸张大小</Label>
                    <Select
                      value={formData.paperSize}
                      onValueChange={(value) => setFormData({ ...formData, paperSize: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAPER_SIZES.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="colorMode">颜色模式</Label>
                    <Select
                      value={formData.colorMode}
                      onValueChange={(value) => setFormData({ ...formData, colorMode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bindingMethod">装订方式</Label>
                    <Select
                      value={formData.bindingMethod}
                      onValueChange={(value) => setFormData({ ...formData, bindingMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择装订方式" />
                      </SelectTrigger>
                      <SelectContent>
                        {BINDING_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialRequirements">特殊要求</Label>
                  <Textarea
                    id="specialRequirements"
                    value={formData.specialRequirements}
                    onChange={(e) => setFormData({ ...formData, specialRequirements: e.target.value })}
                    placeholder="请输入特殊打印要求"
                    rows={2}
                  />
                </div>
              </div>

              {/* 任务指派 */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">任务指派</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignee">负责人</Label>
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
            <CardTitle className="text-sm font-medium">全部</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待打印</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.byStatus['pending'] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">打印中</CardTitle>
            <Printer className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.byStatus['printing'] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已完成</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.byStatus['completed'] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">友司打印</CardTitle>
            <Building2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {(stats.byMethod['partner_company'] || 0) + (stats.byMethod['together'] || 0)}
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
                  placeholder="搜索项目名称或编号..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
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
                {PRINTING_STATUS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="方式筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部方式</SelectItem>
                {PRINTING_METHODS.map((item) => (
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

      {/* 打印安排列表 */}
      <Card>
        <CardHeader>
          <CardTitle>打印安排列表</CardTitle>
          <CardDescription>共 {printings.length} 条记录</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <TableSkeleton rows={5} columns={8} />
          ) : printings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Printer className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无打印安排</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                新建打印安排
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>打印方式</TableHead>
                  <TableHead>份数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>截止时间</TableHead>
                  <TableHead>推送</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printings.map((printing) => (
                  <TableRow key={printing.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{printing.projectName}</div>
                        {printing.projectCode && (
                          <div className="text-sm text-muted-foreground">{printing.projectCode}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getMethodBadge(printing.printingMethod)}
                        {printing.partnerCompanyName && (
                          <div className="text-xs text-muted-foreground">
                            {printing.partnerCompanyName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{printing.copiesCount || 1} 份</div>
                        <div className="text-muted-foreground">
                          {printing.paperSize || 'A4'} / {printing.colorMode === 'color' ? '彩色' : '黑白'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(printing.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {printing.assigneeName ? (
                          <>
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{printing.assigneeName}</span>
                            {getPriorityBadge(printing.priority)}
                          </>
                        ) : (
                          <span className="text-muted-foreground">未指派</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {printing.printingDeadline
                        ? formatDate(printing.printingDeadline)
                        : printing.plannedDate
                        ? formatDate(printing.plannedDate)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {printing.pushedToTask ? (
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
                        {printing.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(printing, 'printing')}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            开始
                          </Button>
                        )}
                        {printing.status === 'printing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(printing, 'completed')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            完成
                          </Button>
                        )}
                        {!printing.pushedToTask && printing.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePushTask(printing)}
                            disabled={!printing.assigneeId}
                            title={!printing.assigneeId ? '请先指派负责人' : '推送到任务中心'}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {printing.pushedToTask && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelPushTask(printing)}
                            title="取消推送"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(printing)}
                          title="删除"
                        >
                          <AlertCircle className="h-4 w-4" />
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
    </div>
  );
}

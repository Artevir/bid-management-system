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
  FileSignature,
  Calendar,
  Send,
  ExternalLink,
  Ban,
  CheckCircle,
  Clock,
  FileText,
  User,
  AlertTriangle,
  Building as _Building,
  Phone as _Phone,
  MapPin as _MapPin,
  FileCheck,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

// 合同签订状态
const CONTRACT_STATUS = [
  { value: 'pending', label: '待签订', color: 'yellow' },
  { value: 'drafting', label: '起草中', color: 'blue' },
  { value: 'reviewing', label: '审核中', color: 'purple' },
  { value: 'negotiating', label: '协商中', color: 'orange' },
  { value: 'signed', label: '已签订', color: 'green' },
  { value: 'overdue', label: '已逾期', color: 'red' },
  { value: 'cancelled', label: '已取消', color: 'gray' },
];

// 合同类型
const CONTRACT_TYPES = [
  { value: 'formal', label: '正式合同' },
  { value: 'supplementary', label: '补充合同' },
  { value: 'amendment', label: '变更合同' },
];

interface ContractSigning {
  id: number;
  projectId: number | null;
  projectName: string;
  projectCode: string | null;
  contractNumber: string | null;
  contractName: string;
  contractType: string | null;
  contractAmount: string | null;
  notificationIssuedAt: string | null;
  signingDeadline: string | null;
  signedAt: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  partyAName: string | null;
  partyAContact: string | null;
  partyAPhone: string | null;
  partyAAddress: string | null;
  partyBContact: string | null;
  partyBPhone: string | null;
  termsConsistent: boolean | null;
  inconsistentTerms: string | null;
  termsModified: boolean | null;
  modificationReason: string | null;
  contractFile: string | null;
  signedContractFile: string | null;
  bidDocumentFile: string | null;
  tenderDocumentFile: string | null;
  handlerId: number | null;
  handlerName: string | null;
  handlerPhone: string | null;
  reviewerId: number | null;
  reviewerName: string | null;
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
  drafting: number;
  reviewing: number;
  negotiating: number;
  signed: number;
  overdue: number;
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

export default function ContractSigningsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractSigning[]>([]);
  const [stats, setStats] = useState<Statistics>({
    total: 0,
    pending: 0,
    drafting: 0,
    reviewing: 0,
    negotiating: 0,
    signed: 0,
    overdue: 0,
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
  const [selectedContract, setSelectedContract] = useState<ContractSigning | null>(null);
  
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
    contractNumber: '',
    contractName: '',
    contractType: 'formal',
    contractAmount: '',
    notificationIssuedAt: '',
    signingDeadline: '',
    signedAt: '',
    contractStartDate: '',
    contractEndDate: '',
    partyAName: '',
    partyAContact: '',
    partyAPhone: '',
    partyAAddress: '',
    partyBContact: '',
    partyBPhone: '',
    termsConsistent: true,
    inconsistentTerms: '',
    termsModified: false,
    modificationReason: '',
    contractFile: '',
    signedContractFile: '',
    bidDocumentFile: '',
    tenderDocumentFile: '',
    handlerId: '',
    handlerName: '',
    handlerPhone: '',
    reviewerId: '',
    reviewerName: '',
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
      
      const response = await fetch(`/api/contract-signings?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setContracts(result.data);
      } else {
        setError(result.error || '加载数据失败');
      }
      
      // 加载统计
      const statsResponse = await fetch('/api/contract-signings?stats=true');
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
      const response = await fetch('/api/contract-signings?users=true');
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
      const response = await fetch('/api/contract-signings?projects=true');
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
  const handleEdit = (contract: ContractSigning) => {
    setEditingId(contract.id);
    setFormData({
      projectId: contract.projectId?.toString() || '',
      projectName: contract.projectName,
      projectCode: contract.projectCode || '',
      contractNumber: contract.contractNumber || '',
      contractName: contract.contractName,
      contractType: contract.contractType || 'formal',
      contractAmount: contract.contractAmount || '',
      notificationIssuedAt: contract.notificationIssuedAt ? contract.notificationIssuedAt.split('T')[0] : '',
      signingDeadline: contract.signingDeadline ? contract.signingDeadline.split('T')[0] : '',
      signedAt: contract.signedAt ? contract.signedAt.split('T')[0] : '',
      contractStartDate: contract.contractStartDate ? contract.contractStartDate.split('T')[0] : '',
      contractEndDate: contract.contractEndDate ? contract.contractEndDate.split('T')[0] : '',
      partyAName: contract.partyAName || '',
      partyAContact: contract.partyAContact || '',
      partyAPhone: contract.partyAPhone || '',
      partyAAddress: contract.partyAAddress || '',
      partyBContact: contract.partyBContact || '',
      partyBPhone: contract.partyBPhone || '',
      termsConsistent: contract.termsConsistent ?? true,
      inconsistentTerms: contract.inconsistentTerms || '',
      termsModified: contract.termsModified ?? false,
      modificationReason: contract.modificationReason || '',
      contractFile: contract.contractFile || '',
      signedContractFile: contract.signedContractFile || '',
      bidDocumentFile: contract.bidDocumentFile || '',
      tenderDocumentFile: contract.tenderDocumentFile || '',
      handlerId: contract.handlerId?.toString() || '',
      handlerName: contract.handlerName || '',
      handlerPhone: contract.handlerPhone || '',
      reviewerId: contract.reviewerId?.toString() || '',
      reviewerName: contract.reviewerName || '',
      riskWarning: contract.riskWarning || '',
      remarks: contract.remarks || '',
      status: contract.status,
    });
    setError('');
    setDialogOpen(true);
  };

  // 查看详情
  const handleView = (contract: ContractSigning) => {
    setSelectedContract(contract);
    setDetailOpen(true);
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      projectId: '',
      projectName: '',
      projectCode: '',
      contractNumber: '',
      contractName: '',
      contractType: 'formal',
      contractAmount: '',
      notificationIssuedAt: '',
      signingDeadline: '',
      signedAt: '',
      contractStartDate: '',
      contractEndDate: '',
      partyAName: '',
      partyAContact: '',
      partyAPhone: '',
      partyAAddress: '',
      partyBContact: '',
      partyBPhone: '',
      termsConsistent: true,
      inconsistentTerms: '',
      termsModified: false,
      modificationReason: '',
      contractFile: '',
      signedContractFile: '',
      bidDocumentFile: '',
      tenderDocumentFile: '',
      handlerId: '',
      handlerName: '',
      handlerPhone: '',
      reviewerId: '',
      reviewerName: '',
      riskWarning: '',
      remarks: '',
      status: 'pending',
    });
    setError('');
  };

  // 从用户选择填充姓名
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

  // 从用户选择填充审核人
  const handleReviewerSelect = (userId: string) => {
    const user = users.find(u => u.id === parseInt(userId));
    if (user) {
      setFormData({
        ...formData,
        reviewerId: userId,
        reviewerName: user.name,
      });
    }
  };

  // 计算签订截止日期
  const calculateDeadline = (notificationDate: string) => {
    if (notificationDate) {
      const date = new Date(notificationDate);
      date.setDate(date.getDate() + 30);
      return date.toISOString().split('T')[0];
    }
    return '';
  };

  // 监听中标通知书发出日期变化
  useEffect(() => {
    if (formData.notificationIssuedAt && !formData.signingDeadline) {
      const deadline = calculateDeadline(formData.notificationIssuedAt);
      setFormData(prev => ({ ...prev, signingDeadline: deadline }));
    }
  }, [formData.notificationIssuedAt]);

  // 保存数据
  const handleSave = async () => {
    // 验证必填字段
    if (!formData.projectName) {
      setError('请填写项目名称');
      return;
    }
    if (!formData.contractName) {
      setError('请填写合同名称');
      return;
    }

    setSaving(true);
    try {
      const url = '/api/contract-signings';
      const method = editingId ? 'PUT' : 'POST';
      const body = {
        id: editingId,
        ...formData,
        handlerId: formData.handlerId ? parseInt(formData.handlerId) : null,
        reviewerId: formData.reviewerId ? parseInt(formData.reviewerId) : null,
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
        setError(result.error || '保存失败');
      }
    } catch (_err) {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除数据
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条合同签订记录吗？')) return;

    try {
      const response = await fetch(`/api/contract-signings?id=${id}`, {
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
      const response = await fetch(`/api/contract-signings/${id}/push-task`, {
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
  const handleUpdateStatus = async (id: number, status: string, projectName?: string) => {
    // 如果是标记为"已签订"，需要确认是否完结项目
    if (status === 'signed') {
      const confirmed = confirm(
        `确认该合同已签订？\n\n${
          projectName 
            ? `此操作将同时把项目「${projectName}」标记为已完结，该投标项目流程结束。` 
            : '此操作将同时将关联项目标记为已完结，该投标项目流程结束。'
        }\n\n是否继续？`
      );
      if (!confirmed) return;
    }

    try {
      const response = await fetch('/api/contract-signings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      const result = await response.json();

      if (result.success) {
        loadData();
        if (status === 'signed') {
          alert('合同已签订，项目已完结！');
        }
      } else {
        alert(result.error || '更新状态失败');
      }
    } catch (_err) {
      alert('更新状态失败');
    }
  };

  // 获取状态样式
  const getStatusBadge = (status: string) => {
    const statusConfig = CONTRACT_STATUS.find(s => s.value === status);
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      purple: 'bg-purple-100 text-purple-800',
      orange: 'bg-orange-100 text-orange-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colorMap[statusConfig?.color || 'gray']}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  // 获取合同类型显示
  const _getContractTypeLabel = (type: string) => {
    const typeConfig = CONTRACT_TYPES.find(t => t.value === type);
    return typeConfig?.label || type;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-6 w-6" />
            签订书面合同
          </h1>
          <p className="text-muted-foreground">
            中标通知书发出后30日内，与甲方按招标文件、投标文件订立合同，条款需与招标/投标文件一致
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          新增合同签订
        </Button>
      </div>

      {/* 风险提示 */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>重要提醒：</strong>中标通知书发出后30日内必须签订书面合同！条款需与招标/投标文件一致，不得擅自更改。逾期未签订可能导致中标资格被取消。
        </AlertDescription>
      </Alert>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待签订</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">起草中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.drafting}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">审核中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.reviewing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">协商中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.negotiating}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已签订</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.signed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已逾期</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
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
                  placeholder="搜索项目名称、合同名称或编号..."
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
                  {CONTRACT_STATUS.map((status) => (
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
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : contracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无合同签订数据</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合同名称</TableHead>
                  <TableHead>合同金额</TableHead>
                  <TableHead>签订截止</TableHead>
                  <TableHead>甲方</TableHead>
                  <TableHead>经办人</TableHead>
                  <TableHead>条款一致</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{contract.contractName}</div>
                        <div className="text-sm text-muted-foreground">
                          {contract.projectName}
                          {contract.contractNumber && ` | ${contract.contractNumber}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-green-600">{contract.contractAmount || '-'}</div>
                    </TableCell>
                    <TableCell>
                      {contract.signingDeadline ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(contract.signingDeadline)}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{contract.partyAName || '-'}</div>
                        {contract.partyAContact && (
                          <div className="text-sm text-muted-foreground">{contract.partyAContact}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{contract.handlerName || '-'}</div>
                        {contract.handlerPhone && (
                          <div className="text-sm text-muted-foreground">{contract.handlerPhone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contract.termsConsistent === false ? (
                        <Badge variant="destructive">不一致</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-100 text-green-800">一致</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(contract.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(contract)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(contract)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {contract.status !== 'signed' && contract.status !== 'cancelled' && contract.status !== 'overdue' && (
                          <>
                            {!contract.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePushTask(contract.id)}
                                disabled={pushingTaskId === contract.id}
                              >
                                {pushingTaskId === contract.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {contract.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/tasks/${contract.taskId}`)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        {contract.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(contract.id, 'drafting')}
                          >
                            <FileText className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {contract.status === 'drafting' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(contract.id, 'reviewing')}
                          >
                            <FileCheck className="h-4 w-4 text-purple-600" />
                          </Button>
                        )}
                        {contract.status === 'reviewing' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(contract.id, 'negotiating')}
                          >
                            <Clock className="h-4 w-4 text-orange-600" />
                          </Button>
                        )}
                        {contract.status === 'negotiating' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(contract.id, 'signed', contract.projectName)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(contract.id)}
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
            <DialogTitle>{editingId ? '编辑合同签订' : '新增合同签订'}</DialogTitle>
            <DialogDescription>
              中标通知书发出后30日内必须签订书面合同
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
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
              </CardContent>
            </Card>

            {/* 合同信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">合同信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>合同编号</Label>
                    <Input
                      value={formData.contractNumber}
                      onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                      placeholder="输入合同编号"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>合同名称 *</Label>
                    <Input
                      value={formData.contractName}
                      onChange={(e) => setFormData({ ...formData, contractName: e.target.value })}
                      placeholder="输入合同名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>合同类型</Label>
                    <Select
                      value={formData.contractType}
                      onValueChange={(value) => setFormData({ ...formData, contractType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择合同类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRACT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>合同金额</Label>
                    <Input
                      value={formData.contractAmount}
                      onChange={(e) => setFormData({ ...formData, contractAmount: e.target.value })}
                      placeholder="例如：100万元"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>中标通知书发出日期</Label>
                    <Input
                      type="date"
                      value={formData.notificationIssuedAt}
                      onChange={(e) => setFormData({ ...formData, notificationIssuedAt: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>签订截止日期（30日内）</Label>
                    <Input
                      type="date"
                      value={formData.signingDeadline}
                      onChange={(e) => setFormData({ ...formData, signingDeadline: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>实际签订日期</Label>
                    <Input
                      type="date"
                      value={formData.signedAt}
                      onChange={(e) => setFormData({ ...formData, signedAt: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>合同开始日期</Label>
                    <Input
                      type="date"
                      value={formData.contractStartDate}
                      onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>合同结束日期</Label>
                    <Input
                      type="date"
                      value={formData.contractEndDate}
                      onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 甲方信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">甲方信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>甲方名称</Label>
                  <Input
                    value={formData.partyAName}
                    onChange={(e) => setFormData({ ...formData, partyAName: e.target.value })}
                    placeholder="输入甲方名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label>甲方联系人</Label>
                  <Input
                    value={formData.partyAContact}
                    onChange={(e) => setFormData({ ...formData, partyAContact: e.target.value })}
                    placeholder="输入甲方联系人"
                  />
                </div>
                <div className="space-y-2">
                  <Label>甲方电话</Label>
                  <Input
                    value={formData.partyAPhone}
                    onChange={(e) => setFormData({ ...formData, partyAPhone: e.target.value })}
                    placeholder="输入甲方电话"
                  />
                </div>
                <div className="space-y-2">
                  <Label>甲方地址</Label>
                  <Input
                    value={formData.partyAAddress}
                    onChange={(e) => setFormData({ ...formData, partyAAddress: e.target.value })}
                    placeholder="输入甲方地址"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 乙方信息（本公司） */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">乙方信息（本公司）</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>乙方联系人</Label>
                  <Input
                    value={formData.partyBContact}
                    onChange={(e) => setFormData({ ...formData, partyBContact: e.target.value })}
                    placeholder="输入乙方联系人"
                  />
                </div>
                <div className="space-y-2">
                  <Label>乙方电话</Label>
                  <Input
                    value={formData.partyBPhone}
                    onChange={(e) => setFormData({ ...formData, partyBPhone: e.target.value })}
                    placeholder="输入乙方电话"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 条款一致性 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">条款一致性检查</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.termsConsistent}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, termsConsistent: checked as boolean })
                      }
                    />
                    <Label className="font-normal">条款与招标/投标文件一致</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.termsModified}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, termsModified: checked as boolean })
                      }
                    />
                    <Label className="font-normal">条款有修改</Label>
                  </div>
                </div>
                {!formData.termsConsistent && (
                  <div className="space-y-2">
                    <Label>不一致条款说明</Label>
                    <Textarea
                      value={formData.inconsistentTerms}
                      onChange={(e) => setFormData({ ...formData, inconsistentTerms: e.target.value })}
                      placeholder="请说明与招标/投标文件不一致的条款"
                      rows={2}
                    />
                  </div>
                )}
                {formData.termsModified && (
                  <div className="space-y-2">
                    <Label>修改原因</Label>
                    <Textarea
                      value={formData.modificationReason}
                      onChange={(e) => setFormData({ ...formData, modificationReason: e.target.value })}
                      placeholder="请说明条款修改的原因"
                      rows={2}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 经办人信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">经办人信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>经办人</Label>
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
                  <Label>经办人姓名</Label>
                  <Input
                    value={formData.handlerName}
                    onChange={(e) => setFormData({ ...formData, handlerName: e.target.value })}
                    placeholder="姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label>经办人电话</Label>
                  <Input
                    value={formData.handlerPhone}
                    onChange={(e) => setFormData({ ...formData, handlerPhone: e.target.value })}
                    placeholder="联系电话"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 审核人信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">审核人信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>审核人</Label>
                  <Select
                    value={formData.reviewerId}
                    onValueChange={handleReviewerSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择审核人" />
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
                  <Label>审核人姓名</Label>
                  <Input
                    value={formData.reviewerName}
                    onChange={(e) => setFormData({ ...formData, reviewerName: e.target.value })}
                    placeholder="姓名"
                  />
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
                    placeholder="输入风险提示，例如：逾期未签订将取消中标资格等"
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
            <DialogTitle>合同签订详情</DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">合同名称</Label>
                  <p className="font-medium">{selectedContract.contractName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">合同编号</Label>
                  <p className="font-medium">{selectedContract.contractNumber || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">项目名称</Label>
                  <p className="font-medium">{selectedContract.projectName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">合同金额</Label>
                  <p className="font-medium text-green-600">{selectedContract.contractAmount || '-'}</p>
                </div>
              </div>

              {/* 时间信息 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">时间信息</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <span className="text-sm">中标通知书发出日期：</span>
                    <span>{selectedContract.notificationIssuedAt ? formatDate(selectedContract.notificationIssuedAt) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-sm">签订截止日期：</span>
                    <span className={selectedContract.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                      {selectedContract.signingDeadline ? formatDate(selectedContract.signingDeadline) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm">实际签订日期：</span>
                    <span>{selectedContract.signedAt ? formatDate(selectedContract.signedAt) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-sm">合同期限：</span>
                    <span>
                      {selectedContract.contractStartDate && selectedContract.contractEndDate
                        ? `${formatDate(selectedContract.contractStartDate)} - ${formatDate(selectedContract.contractEndDate)}`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 甲方信息 */}
              {selectedContract.partyAName && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">甲方信息</Label>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">名称：{selectedContract.partyAName}</p>
                    {selectedContract.partyAContact && (
                      <p className="text-sm">联系人：{selectedContract.partyAContact}</p>
                    )}
                    {selectedContract.partyAPhone && (
                      <p className="text-sm">电话：{selectedContract.partyAPhone}</p>
                    )}
                    {selectedContract.partyAAddress && (
                      <p className="text-sm">地址：{selectedContract.partyAAddress}</p>
                    )}
                  </div>
                </div>
              )}

              {/* 条款一致性 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">条款一致性</Label>
                <div className="mt-2">
                  {selectedContract.termsConsistent === false ? (
                    <div className="space-y-2">
                      <Badge variant="destructive">条款不一致</Badge>
                      {selectedContract.inconsistentTerms && (
                        <p className="text-sm text-muted-foreground mt-2">
                          不一致条款：{selectedContract.inconsistentTerms}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Badge variant="default" className="bg-green-100 text-green-800">条款一致</Badge>
                  )}
                </div>
              </div>

              {/* 经办人信息 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">经办人信息</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-sm font-medium">经办人</p>
                    <p className="text-sm">{selectedContract.handlerName || '-'}</p>
                    {selectedContract.handlerPhone && (
                      <p className="text-sm text-muted-foreground">{selectedContract.handlerPhone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">审核人</p>
                    <p className="text-sm">{selectedContract.reviewerName || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 风险提示 */}
              {selectedContract.riskWarning && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">风险提示</Label>
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{selectedContract.riskWarning}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* 备注 */}
              {selectedContract.remarks && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">备注</Label>
                  <p className="mt-1 whitespace-pre-wrap">{selectedContract.remarks}</p>
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
              if (selectedContract) {
                handleEdit(selectedContract);
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

/**
 * 购买招标文件安排页面
 * 支持指派任务和推送到任务中心
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Plus,
  Search,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  Users,
  MapPin,
  Phone,
  Calendar,
  AlertTriangle,
  Loader2,
  Send,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { BidDocumentPurchaseForm, type BidDocumentPurchaseFormData } from '@/components/bid-document-purchases/purchase-form';

// 购买安排类型
interface BidDocumentPurchase {
  id: number;
  projectName: string;
  projectCode: string | null;
  purchaseDeadline: string | null;
  plannedDate: string | null;
  platformId: number | null;
  platformName: string | null;
  platformAddress: string | null;
  platformContact: string | null;
  platformPhone: string | null;
  ourContactId: number | null;
  ourContactName: string | null;
  ourContactPhone: string | null;
  partnerCompanyId: number | null;
  partnerCompanyName: string | null;
  partnerContactId: number | null;
  partnerContactName: string | null;
  partnerContactPhone: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  priority: string | null;
  taskId: number | null;
  pushedToTask: boolean | null;
  pushedAt: string | null;
  requiredMaterials: string | null;
  remarks: string | null;
  status: string;
  createdAt: string;
}

// 状态配置
const STATUS_CONFIG = {
  pending: { label: '待购买', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

// 优先级配置
const PRIORITY_CONFIG = {
  high: { label: '紧急', color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '普通', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  low: { label: '低', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

// 默认所需材料
const DEFAULT_MATERIALS = [
  { name: '营业执照副本', required: true, category: 'company', checked: false },
  { name: '法定代表人身份证明', required: true, category: 'company', checked: false },
  { name: '授权委托书', required: false, category: 'company', checked: false },
  { name: '相关资质证书', required: false, category: 'company', checked: false },
  { name: '代办人身份证', required: true, category: 'personal', checked: false },
  { name: '项目相关资质证明', required: false, category: 'other', checked: false },
  { name: '购买费用（现金/转账）', required: false, category: 'other', checked: false },
];

export default function BidDocumentPurchasesPage() {
  const [purchases, setPurchases] = useState<BidDocumentPurchase[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<BidDocumentPurchase | null>(null);
  const [showMaterialsDialog, setShowMaterialsDialog] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<typeof DEFAULT_MATERIALS>([]);
  const [pushingId, setPushingId] = useState<number | null>(null);

  // 加载数据
  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchKeyword) params.append('keyword', searchKeyword);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/bid-document-purchases?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setPurchases(result.data);
        setStats(result.stats);
      } else {
        toast.error(result.error || '获取数据失败');
      }
    } catch (error) {
      toast.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [statusFilter]);

  // 搜索
  const handleSearch = () => {
    fetchPurchases();
  };

  // 打开新建表单
  const handleCreate = () => {
    setEditingPurchase(null);
    setShowFormDialog(true);
  };

  // 打开编辑表单
  const handleEdit = (purchase: BidDocumentPurchase) => {
    setEditingPurchase(purchase);
    setShowFormDialog(true);
  };

  // 查看所需材料
  const handleViewMaterials = (purchase: BidDocumentPurchase) => {
    const materials = purchase.requiredMaterials 
      ? JSON.parse(purchase.requiredMaterials) 
      : DEFAULT_MATERIALS;
    setSelectedMaterials(materials);
    setShowMaterialsDialog(true);
  };

  // 删除
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此购买安排吗？')) return;
    
    try {
      const response = await fetch(`/api/bid-document-purchases?id=${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('删除成功');
        fetchPurchases();
      } else {
        toast.error(result.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 更新状态
  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const response = await fetch('/api/bid-document-purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('状态更新成功');
        fetchPurchases();
      } else {
        toast.error(result.error || '更新失败');
      }
    } catch (error) {
      toast.error('更新失败');
    }
  };

  // 推送到任务中心
  const handlePushToTask = async (id: number) => {
    setPushingId(id);
    try {
      const response = await fetch(`/api/bid-document-purchases/${id}/push-task`, {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('已推送到任务中心');
        fetchPurchases();
      } else {
        toast.error(result.error || '推送失败');
      }
    } catch (error) {
      toast.error('推送失败');
    } finally {
      setPushingId(null);
    }
  };

  // 表单提交
  const handleFormSubmit = async (data: BidDocumentPurchaseFormData) => {
    try {
      const url = '/api/bid-document-purchases';
      const method = editingPurchase ? 'PUT' : 'POST';
      const body = editingPurchase ? { ...data, id: editingPurchase.id } : data;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success(editingPurchase ? '更新成功' : '创建成功');
        setShowFormDialog(false);
        fetchPurchases();
      } else {
        toast.error(result.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 跳转到任务中心
  const handleGoToTask = (taskId: number) => {
    window.open(`/tasks?taskId=${taskId}`, '_blank');
  };

  // 格式化日期
  const formatDate = (dateStr: string | null, includeTime = false) => {
    if (!dateStr) return '-';
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    return new Date(dateStr).toLocaleDateString('zh-CN', options);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">购买招标文件安排</h1>
          <p className="text-muted-foreground">管理和提醒购买招标文件的相关安排</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新建安排
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">待购买</p>
                <p className="text-2xl font-bold">{stats.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已完成</p>
                <p className="text-2xl font-bold">{stats.completed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已取消</p>
                <p className="text-2xl font-bold">{stats.cancelled || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索项目名称、项目编号、对接单位..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待购买</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据列表 */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目信息</TableHead>
                  <TableHead>对接单位</TableHead>
                  <TableHead>指派人</TableHead>
                  <TableHead>时间安排</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => {
                  const statusConfig = STATUS_CONFIG[purchase.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const priorityConfig = PRIORITY_CONFIG[purchase.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
                  
                  return (
                    <TableRow key={purchase.id}>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{purchase.projectName}</p>
                            {purchase.priority && (
                              <Badge variant="outline" className={priorityConfig.color}>
                                {priorityConfig.label}
                              </Badge>
                            )}
                          </div>
                          {purchase.projectCode && (
                            <p className="text-sm text-muted-foreground">
                              编号：{purchase.projectCode}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{purchase.platformName || '-'}</p>
                          {purchase.platformAddress && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {purchase.platformAddress}
                            </p>
                          )}
                          {purchase.platformContact && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {purchase.platformContact}
                              {purchase.platformPhone && ` (${purchase.platformPhone})`}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {purchase.assigneeName ? (
                            <p className="text-sm font-medium flex items-center gap-1">
                              <UserPlus className="h-3 w-3 text-blue-500" />
                              {purchase.assigneeName}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">未指派</p>
                          )}
                          {purchase.ourContactName && (
                            <p className="text-sm text-muted-foreground">
                              我方：{purchase.ourContactName}
                            </p>
                          )}
                          {purchase.partnerCompanyName && (
                            <p className="text-sm text-muted-foreground">
                              友司：{purchase.partnerCompanyName}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {purchase.plannedDate && (
                            <p className="text-sm flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-blue-500" />
                              计划：{formatDate(purchase.plannedDate)}
                            </p>
                          )}
                          <p className="text-sm flex items-center gap-1">
                            <Clock className="h-3 w-3 text-red-500" />
                            截止：{formatDate(purchase.purchaseDeadline, true)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                          {purchase.pushedToTask && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              <Send className="mr-1 h-3 w-3" />
                              已推送任务
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewMaterials(purchase)}
                            title="查看所需材料"
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(purchase)}
                          >
                            编辑
                          </Button>
                          {/* 推送任务中心按钮 */}
                          {!purchase.pushedToTask && purchase.status === 'pending' && purchase.assigneeId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600"
                              onClick={() => handlePushToTask(purchase.id)}
                              disabled={pushingId === purchase.id}
                            >
                              {pushingId === purchase.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {/* 跳转到任务 */}
                          {purchase.pushedToTask && purchase.taskId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600"
                              onClick={() => handleGoToTask(purchase.taskId!)}
                              title="查看任务"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                          {purchase.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600"
                                onClick={() => handleUpdateStatus(purchase.id, 'completed')}
                              >
                                完成
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-600"
                                onClick={() => handleUpdateStatus(purchase.id, 'cancelled')}
                              >
                                取消
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleDelete(purchase.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑表单弹窗 */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase ? '编辑购买安排' : '新建购买安排'}
            </DialogTitle>
            <DialogDescription>
              填写购买招标文件的相关安排信息
            </DialogDescription>
          </DialogHeader>
          <BidDocumentPurchaseForm
            initialData={editingPurchase}
            onSubmit={handleFormSubmit}
            onCancel={() => setShowFormDialog(false)}
            onPushToTask={async (id) => {
              await handlePushToTask(id);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 所需材料弹窗 */}
      <Dialog open={showMaterialsDialog} onOpenChange={setShowMaterialsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>购买招标文件所需材料</DialogTitle>
            <DialogDescription>
              前往对接单位购买招标文件时需携带以下材料
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                公司相关材料
              </h4>
              <ul className="space-y-1 pl-6">
                {selectedMaterials
                  .filter(m => m.category === 'company')
                  .map((material, idx) => (
                    <li key={idx} className="text-sm flex items-center gap-2">
                      {material.required ? (
                        <span className="text-red-500">*</span>
                      ) : (
                        <span className="text-gray-300">○</span>
                      )}
                      {material.name}
                      {material.required && (
                        <span className="text-xs text-muted-foreground">(必带)</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                代办人本人材料
              </h4>
              <ul className="space-y-1 pl-6">
                {selectedMaterials
                  .filter(m => m.category === 'personal')
                  .map((material, idx) => (
                    <li key={idx} className="text-sm flex items-center gap-2">
                      {material.required ? (
                        <span className="text-red-500">*</span>
                      ) : (
                        <span className="text-gray-300">○</span>
                      )}
                      {material.name}
                      {material.required && (
                        <span className="text-xs text-muted-foreground">(必带)</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                其他补充材料
              </h4>
              <ul className="space-y-1 pl-6">
                {selectedMaterials
                  .filter(m => m.category === 'other')
                  .map((material, idx) => (
                    <li key={idx} className="text-sm flex items-center gap-2">
                      <span className="text-gray-300">○</span>
                      {material.name}
                    </li>
                  ))}
              </ul>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                <strong>提示：</strong>原件+复印件，复印件需加盖公章，具体可按对接单位要求调整
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowMaterialsDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

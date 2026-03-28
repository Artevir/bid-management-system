'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Calendar,
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { toast } from 'sonner';

// 类型定义
interface CostSummary {
  totalBudget: string;
  totalSpent: string;
  totalRemaining: string;
  usageRate: number;
  byType: Record<string, { budget: string; spent: string; count: number }>;
  byStatus: Record<string, number>;
}

interface CostRecord {
  id: number;
  projectId: number;
  budgetId: number | null;
  type: string;
  name: string;
  amount: string;
  currency: string;
  status: string;
  invoiceNumber: string | null;
  invoiceFile: string | null;
  occurredDate: string;
  description: string | null;
  projectName: string;
  budgetName: string | null;
  creatorName: string;
  approverName: string | null;
  createdAt: string;
}

interface Budget {
  id: number;
  projectId: number;
  name: string;
  type: string;
  category: string | null;
  amount: string;
  spentAmount: string;
  remainingAmount: string;
  usageRate: number;
  creatorName: string;
}

interface Project {
  id: number;
  name: string;
  status: string;
}

// 成本类型映射
const costTypeNames: Record<string, string> = {
  personnel: '人力成本',
  material: '材料成本',
  equipment: '设备成本',
  travel: '差旅费用',
  outsourcing: '外包费用',
  other: '其他费用',
};

// 状态映射
const statusNames: Record<string, string> = {
  draft: '草稿',
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  paid: '已支付',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-600',
  approved: 'bg-green-100 text-green-600',
  rejected: 'bg-red-100 text-red-600',
  paid: 'bg-blue-100 text-blue-600',
};

export default function CostManagementPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [records, setRecords] = useState<{ data: CostRecord[]; total: number }>({
    data: [],
    total: 0,
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 对话框状态
  const [budgetDialog, setBudgetDialog] = useState(false);
  const [recordDialog, setRecordDialog] = useState(false);
  const [formData, setFormData] = useState<any>({});

  // 加载项目列表
  useEffect(() => {
    fetchProjects();
  }, []);

  // 加载数据
  useEffect(() => {
    if (selectedProject) {
      loadData();
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/costs?action=projects');
      if (!response.ok) throw new Error('获取失败');
      const data = await response.json();
      setProjects(data);
      if (data.length > 0) {
        setSelectedProject(data[0].id.toString());
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 并行加载概览和预算
      const [summaryRes, budgetsRes, recordsRes] = await Promise.all([
        fetch(`/api/costs?action=summary&projectId=${selectedProject}`),
        fetch(`/api/costs?action=budgets&projectId=${selectedProject}`),
        fetch(`/api/costs?action=records&projectId=${selectedProject}&pageSize=100`),
      ]);

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (budgetsRes.ok) {
        setBudgets(await budgetsRes.json());
      }
      if (recordsRes.ok) {
        setRecords(await recordsRes.json());
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建预算
  const handleCreateBudget = async () => {
    try {
      const response = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'budget',
          data: {
            ...formData,
            projectId: parseInt(selectedProject),
          },
        }),
      });

      if (!response.ok) throw new Error('创建失败');

      toast.success('预算创建成功');
      setBudgetDialog(false);
      setFormData({});
      loadData();
    } catch (error) {
      console.error('创建预算失败:', error);
      toast.error('创建预算失败');
    }
  };

  // 创建成本记录
  const handleCreateRecord = async () => {
    try {
      const response = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          data: {
            ...formData,
            projectId: parseInt(selectedProject),
            occurredDate: formData.occurredDate || new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) throw new Error('创建失败');

      toast.success('成本记录创建成功');
      setRecordDialog(false);
      setFormData({});
      loadData();
    } catch (error) {
      console.error('创建成本记录失败:', error);
      toast.error('创建成本记录失败');
    }
  };

  // 审批成本
  const handleApprove = async (id: number, approved: boolean) => {
    try {
      const response = await fetch('/api/costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          id,
          approved,
        }),
      });

      if (!response.ok) throw new Error('操作失败');

      toast.success(approved ? '已批准' : '已拒绝');
      loadData();
    } catch (error) {
      console.error('审批失败:', error);
      toast.error('审批失败');
    }
  };

  // 标记支付
  const handlePay = async (id: number) => {
    try {
      const response = await fetch('/api/costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay',
          id,
        }),
      });

      if (!response.ok) throw new Error('操作失败');

      toast.success('已标记为已支付');
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  // 格式化金额
  const formatAmount = (amount: string) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(parseFloat(amount));
  };

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">投标成本管理</h1>
            <p className="text-gray-500 text-sm">
              管理投标项目的预算与成本支出
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64">
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
      </div>

      {loading ? (
        <div className="text-center py-12">加载中...</div>
      ) : !selectedProject ? (
        <div className="text-center py-12 text-gray-500">请选择项目</div>
      ) : (
        <>
          {/* 概览统计 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">总预算</p>
                    <p className="text-2xl font-bold">
                      {formatAmount(summary?.totalBudget || '0')}
                    </p>
                  </div>
                  <PiggyBank className="h-10 w-10 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">已支出</p>
                    <p className="text-2xl font-bold text-red-500">
                      {formatAmount(summary?.totalSpent || '0')}
                    </p>
                  </div>
                  <CreditCard className="h-10 w-10 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">剩余预算</p>
                    <p className="text-2xl font-bold text-green-500">
                      {formatAmount(summary?.totalRemaining || '0')}
                    </p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">使用率</p>
                    <p className="text-2xl font-bold">
                      {summary?.usageRate || 0}%
                    </p>
                  </div>
                  <BarChart3 className="h-10 w-10 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tab切换 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="budgets">预算管理</TabsTrigger>
              <TabsTrigger value="records">成本记录</TabsTrigger>
            </TabsList>

            {/* 概览 */}
            <TabsContent value="overview">
              <div className="grid grid-cols-2 gap-6">
                {/* 成本类型分布 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      成本类型分布
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(summary?.byType || {}).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        暂无数据
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(summary?.byType || {}).map(([type, data]) => (
                          <div key={type} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{costTypeNames[type] || type}</p>
                              <p className="text-sm text-gray-500">{data.count} 笔</p>
                            </div>
                            <p className="font-bold">{formatAmount(data.spent)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 状态分布 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      状态分布
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(summary?.byStatus || {}).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        暂无数据
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(summary?.byStatus || {}).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={statusColors[status]}>
                                {statusNames[status] || status}
                              </Badge>
                            </div>
                            <p className="font-bold">{count} 笔</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 预算管理 */}
            <TabsContent value="budgets">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>预算列表</CardTitle>
                  <Button onClick={() => setBudgetDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    新建预算
                  </Button>
                </CardHeader>
                <CardContent>
                  {budgets.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      暂无预算数据
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>预算名称</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>预算金额</TableHead>
                          <TableHead>已支出</TableHead>
                          <TableHead>剩余</TableHead>
                          <TableHead>使用率</TableHead>
                          <TableHead>创建人</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {budgets.map((budget) => (
                          <TableRow key={budget.id}>
                            <TableCell className="font-medium">{budget.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {budget.type === 'total' ? '总预算' : 
                                 budget.type === 'phase' ? '阶段预算' : '分类预算'}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatAmount(budget.amount)}</TableCell>
                            <TableCell className="text-red-500">
                              {formatAmount(budget.spentAmount)}
                            </TableCell>
                            <TableCell className="text-green-500">
                              {formatAmount(budget.remainingAmount)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500"
                                    style={{ width: `${Math.min(budget.usageRate, 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm">{budget.usageRate}%</span>
                              </div>
                            </TableCell>
                            <TableCell>{budget.creatorName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 成本记录 */}
            <TabsContent value="records">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>成本记录</CardTitle>
                  <Button onClick={() => setRecordDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    新建记录
                  </Button>
                </CardHeader>
                <CardContent>
                  {/* 筛选 */}
                  <div className="flex gap-4 mb-4">
                    <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        {Object.entries(costTypeNames).map(([key, name]) => (
                          <SelectItem key={key} value={key}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        {Object.entries(statusNames).map(([key, name]) => (
                          <SelectItem key={key} value={key}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {records.data.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      暂无成本记录
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>名称</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>发生日期</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>创建人</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.data
                          .filter((r) => !filterType || r.type === filterType)
                          .filter((r) => !filterStatus || r.status === filterStatus)
                          .map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">{record.name}</TableCell>
                              <TableCell>{costTypeNames[record.type] || record.type}</TableCell>
                              <TableCell className="font-bold">
                                {formatAmount(record.amount)}
                              </TableCell>
                              <TableCell>
                                {new Date(record.occurredDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge className={statusColors[record.status]}>
                                  {statusNames[record.status]}
                                </Badge>
                              </TableCell>
                              <TableCell>{record.creatorName}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {record.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleApprove(record.id, true)}
                                      >
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleApprove(record.id, false)}
                                      >
                                        <XCircle className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </>
                                  )}
                                  {record.status === 'approved' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handlePay(record.id)}
                                    >
                                      <CreditCard className="h-4 w-4 text-blue-500" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* 新建预算对话框 */}
      <Dialog open={budgetDialog} onOpenChange={setBudgetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建预算</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>预算名称</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：项目总预算"
              />
            </div>
            <div className="space-y-2">
              <Label>预算类型</Label>
              <Select
                value={formData.type || 'total'}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">总预算</SelectItem>
                  <SelectItem value="phase">阶段预算</SelectItem>
                  <SelectItem value="category">分类预算</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>预算金额</Label>
              <Input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="请输入金额"
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateBudget}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建成本记录对话框 */}
      <Dialog open={recordDialog} onOpenChange={setRecordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建成本记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>成本名称</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：差旅费报销"
              />
            </div>
            <div className="space-y-2">
              <Label>成本类型</Label>
              <Select
                value={formData.type || 'other'}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(costTypeNames).map(([key, name]) => (
                    <SelectItem key={key} value={key}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>金额</Label>
              <Input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="请输入金额"
              />
            </div>
            <div className="space-y-2">
              <Label>发生日期</Label>
              <Input
                type="date"
                value={formData.occurredDate?.split('T')[0] || ''}
                onChange={(e) => setFormData({ ...formData, occurredDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>发票号</Label>
              <Input
                value={formData.invoiceNumber || ''}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                placeholder="可选"
              />
            </div>
            <div className="space-y-2">
              <Label>说明</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateRecord}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

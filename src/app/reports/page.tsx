'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Target,
  FileText,
  Users,
  MapPin,
  Building2,
  Calendar,
  BarChart3,
  PieChartIcon,
} from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface ReportData {
  bidStatistics: {
    total: number;
    won: number;
    lost: number;
    pending: number;
    winRate: number;
    totalAmount: number;
    wonAmount: number;
  };
  costStatistics: {
    totalCost: number;
    laborCost: number;
    materialCost: number;
    travelCost: number;
    otherCost: number;
    avgCostPerBid: number;
    avgCostPerWin: number;
  };
  efficiencyMetrics: {
    avgBidCycle: number;
    avgResponseTime: number;
    avgDocumentPrepTime: number;
    onTimeRate: number;
    revisionRate: number;
  };
  monthlyTrend: Array<{
    month: string;
    total: number;
    won: number;
    lost: number;
    pending: number;
    winRate: number;
  }>;
  industryDistribution: Array<{
    industry: string;
    count: number;
    wonCount: number;
    winRate: number;
    percentage: number;
  }>;
  regionalDistribution: Array<{
    region: string;
    count: number;
    wonCount: number;
    winRate: number;
    percentage: number;
  }>;
  projectProgress: {
    notStarted: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
  documentStats: {
    total: number;
    draft: number;
    inReview: number;
    approved: number;
    rejected: number;
  };
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last30days');
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // 获取报表数据
  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports?action=comprehensive&dateRange=${dateRange}`);
      if (!response.ok) throw new Error('获取报表失败');
      
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('获取报表数据失败:', error);
      toast.error('获取报表数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  // 导出报表
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/reports/export?dateRange=${dateRange}`);
      if (!response.ok) throw new Error('导出失败');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `投标统计报表_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败');
    }
  };

  // 格式化金额
  const formatAmount = (amount: number) => {
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(2)}万`;
    }
    return amount.toLocaleString();
  };

  // 进度饼图数据
  const progressPieData = reportData ? [
    { name: '未开始', value: reportData.projectProgress.notStarted, color: '#94a3b8' },
    { name: '进行中', value: reportData.projectProgress.inProgress, color: '#3b82f6' },
    { name: '已完成', value: reportData.projectProgress.completed, color: '#22c55e' },
    { name: '已过期', value: reportData.projectProgress.overdue, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  // 文档状态饼图数据
  const docPieData = reportData ? [
    { name: '草稿', value: reportData.documentStats.draft, color: '#94a3b8' },
    { name: '审核中', value: reportData.documentStats.inReview, color: '#f59e0b' },
    { name: '已通过', value: reportData.documentStats.approved, color: '#22c55e' },
    { name: '已拒绝', value: reportData.documentStats.rejected, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

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
            <h1 className="text-2xl font-bold">统计报表</h1>
            <p className="text-gray-500 text-sm">投标数据分析与报表导出</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">近7天</SelectItem>
              <SelectItem value="last30days">近30天</SelectItem>
              <SelectItem value="last3months">近3个月</SelectItem>
              <SelectItem value="lastyear">近1年</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出报表
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : !reportData ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500">暂无数据</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 核心指标卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">投标总数</p>
                    <p className="text-2xl font-bold">{reportData.bidStatistics.total}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">中标率</span>
                  <span className="ml-2 text-green-600 font-medium">
                    {reportData.bidStatistics.winRate}%
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">中标数量</p>
                    <p className="text-2xl font-bold text-green-600">
                      {reportData.bidStatistics.won}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Target className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">中标金额</span>
                  <span className="ml-2 text-green-600 font-medium">
                    {formatAmount(reportData.bidStatistics.wonAmount)}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">投标成本</p>
                    <p className="text-2xl font-bold">
                      {formatAmount(reportData.costStatistics.totalCost)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">单次成本</span>
                  <span className="ml-2 text-purple-600 font-medium">
                    {formatAmount(reportData.costStatistics.avgCostPerBid)}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">平均周期</p>
                    <p className="text-2xl font-bold">
                      {reportData.efficiencyMetrics.avgBidCycle}天
                    </p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Clock className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">按时完成率</span>
                  <span className="ml-2 text-orange-600 font-medium">
                    {reportData.efficiencyMetrics.onTimeRate}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 图表区域 */}
          <div className="grid grid-cols-2 gap-6">
            {/* 投标趋势图 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  投标趋势
                </CardTitle>
                <CardDescription>近12个月投标情况</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="投标数"
                      stroke="#3b82f6"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="won"
                      name="中标数"
                      stroke="#22c55e"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="lost"
                      name="未中标"
                      stroke="#ef4444"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 中标率趋势 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  中标率趋势
                </CardTitle>
                <CardDescription>月度中标率变化</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="winRate" name="中标率(%)" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 行业分布 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  行业分布
                </CardTitle>
                <CardDescription>按行业统计投标情况</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.industryDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reportData.industryDistribution}
                        dataKey="count"
                        nameKey="industry"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ industry, percentage }) => `${industry} ${percentage}%`}
                      >
                        {reportData.industryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    暂无数据
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 地区分布 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  地区分布
                </CardTitle>
                <CardDescription>按地区统计投标情况</CardDescription>
              </CardHeader>
              <CardContent>
                {reportData.regionalDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.regionalDistribution.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="region" type="category" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="count" name="投标数" fill="#3b82f6" />
                      <Bar dataKey="wonCount" name="中标数" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    暂无数据
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 详细数据表格 */}
          <div className="grid grid-cols-2 gap-6">
            {/* 成本构成 */}
            <Card>
              <CardHeader>
                <CardTitle>成本构成分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>人力成本</span>
                      <span>{formatAmount(reportData.costStatistics.laborCost)}</span>
                    </div>
                    <Progress 
                      value={reportData.costStatistics.totalCost > 0 
                        ? (reportData.costStatistics.laborCost / reportData.costStatistics.totalCost) * 100 
                        : 0
                      } 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>材料成本</span>
                      <span>{formatAmount(reportData.costStatistics.materialCost)}</span>
                    </div>
                    <Progress 
                      value={reportData.costStatistics.totalCost > 0 
                        ? (reportData.costStatistics.materialCost / reportData.costStatistics.totalCost) * 100 
                        : 0
                      } 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>差旅成本</span>
                      <span>{formatAmount(reportData.costStatistics.travelCost)}</span>
                    </div>
                    <Progress 
                      value={reportData.costStatistics.totalCost > 0 
                        ? (reportData.costStatistics.travelCost / reportData.costStatistics.totalCost) * 100 
                        : 0
                      } 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>其他成本</span>
                      <span>{formatAmount(reportData.costStatistics.otherCost)}</span>
                    </div>
                    <Progress 
                      value={reportData.costStatistics.totalCost > 0 
                        ? (reportData.costStatistics.otherCost / reportData.costStatistics.totalCost) * 100 
                        : 0
                      } 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 效率指标 */}
            <Card>
              <CardHeader>
                <CardTitle>效率指标</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">平均投标周期</p>
                    <p className="text-xl font-bold">{reportData.efficiencyMetrics.avgBidCycle}天</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">平均响应时间</p>
                    <p className="text-xl font-bold">{reportData.efficiencyMetrics.avgResponseTime}小时</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">文档准备时间</p>
                    <p className="text-xl font-bold">{reportData.efficiencyMetrics.avgDocumentPrepTime}小时</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">按时完成率</p>
                    <p className="text-xl font-bold">{reportData.efficiencyMetrics.onTimeRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 行业详细数据 */}
          <Card>
            <CardHeader>
              <CardTitle>行业投标明细</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>行业</TableHead>
                    <TableHead className="text-right">投标数</TableHead>
                    <TableHead className="text-right">中标数</TableHead>
                    <TableHead className="text-right">中标率</TableHead>
                    <TableHead className="text-right">占比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.industryDistribution.map((item) => (
                    <TableRow key={item.industry}>
                      <TableCell className="font-medium">{item.industry}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right">{item.wonCount}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.winRate >= 50 ? 'default' : 'secondary'}>
                          {item.winRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.percentage}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

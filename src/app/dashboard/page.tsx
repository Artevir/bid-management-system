'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  FolderOpen,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users as _Users,
  Building2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// ============================================
// 类型定义
// ============================================

interface DashboardOverview {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  totalDocuments: number;
  pendingReviews: number;
  pendingInterpretationReviews: number;
  totalKnowledge: number;
  myTasks: number;
}

interface ProjectTrend {
  date: string;
  created: number;
  completed: number;
}

interface DepartmentStats {
  departmentId: number;
  departmentName: string;
  projectCount: number;
  completedCount: number;
  avgProgress: number;
}

interface UpcomingMilestone {
  id: number;
  projectName: string;
  milestoneName: string;
  dueDate: Date;
  daysRemaining: number;
}

interface MilestoneStatus {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

const _COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [trends, setTrends] = useState<ProjectTrend[]>([]);
  const [departments, setDepartments] = useState<DepartmentStats[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMilestone[]>([]);
  const [milestoneStatus, setMilestoneStatus] = useState<MilestoneStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [overviewRes, trendsRes, deptsRes, upcomingRes, milestonesRes] = await Promise.all([
        fetch('/api/dashboard?action=overview').catch(() => ({ json: () => ({ overview: null }) })),
        fetch('/api/dashboard?action=trend').catch(() => ({ json: () => ({ trend: [] }) })),
        fetch('/api/dashboard?action=departments').catch(() => ({ json: () => ({ stats: [] }) })),
        fetch('/api/dashboard?action=upcoming').catch(() => ({ json: () => ({ milestones: [] }) })),
        fetch('/api/dashboard?action=milestones').catch(() => ({ json: () => ({ status: null }) })),
      ]);

      const [overviewData, trendsData, deptsData, upcomingData, milestonesData] = await Promise.all([
        overviewRes.json(),
        trendsRes.json(),
        deptsRes.json(),
        upcomingRes.json(),
        milestonesRes.json(),
      ]);

      if (overviewData.overview) setOverview(overviewData.overview);
      if (trendsData.trend) setTrends(trendsData.trend);
      if (deptsData.stats) setDepartments(deptsData.stats);
      if (upcomingData.milestones) setUpcoming(upcomingData.milestones);
      if (milestonesData.status) setMilestoneStatus(milestonesData.status);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  // 饼图数据
  const milestonePieData = milestoneStatus ? [
    { name: '待处理', value: milestoneStatus.pending, color: '#FFBB28' },
    { name: '进行中', value: milestoneStatus.inProgress, color: '#0088FE' },
    { name: '已完成', value: milestoneStatus.completed, color: '#00C49F' },
    { name: '已过期', value: milestoneStatus.overdue, color: '#FF8042' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">项目看板</h1>
          <p className="text-muted-foreground">实时监控项目进度与运营数据</p>
        </div>
        <div className="text-sm text-muted-foreground">
          数据更新时间: {new Date().toLocaleString('zh-CN')}
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="进行中项目"
          value={overview?.activeProjects ?? 0}
          total={overview?.totalProjects}
          icon={FolderOpen}
          color="text-blue-500"
          loading={loading}
          trend={12}
        />
        <StatCard
          title="已完成项目"
          value={overview?.completedProjects ?? 0}
          icon={CheckCircle}
          color="text-green-500"
          loading={loading}
          trend={8}
        />
        <StatCard
          title="待审核"
          value={overview?.pendingReviews ?? 0}
          icon={Clock}
          color="text-orange-500"
          loading={loading}
          alert={!!overview?.pendingReviews && overview.pendingReviews > 5}
        />
        <StatCard
          title="解读待审核"
          value={overview?.pendingInterpretationReviews ?? 0}
          icon={FileText}
          color="text-yellow-500"
          loading={loading}
          alert={!!overview?.pendingInterpretationReviews && overview.pendingInterpretationReviews > 0}
        />
        <StatCard
          title="过期项目"
          value={overview?.overdueProjects ?? 0}
          icon={AlertTriangle}
          color="text-red-500"
          loading={loading}
          alert={!!overview?.overdueProjects && overview.overdueProjects > 0}
        />
      </div>

      {/* 图表区域 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 项目趋势图 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              项目趋势
            </CardTitle>
            <CardDescription>近6个月项目创建与完成情况</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : trends.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                暂无趋势数据
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="created"
                    name="新建项目"
                    stroke="#0088FE"
                    strokeWidth={2}
                    dot={{ fill: '#0088FE' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="完成项目"
                    stroke="#00C49F"
                    strokeWidth={2}
                    dot={{ fill: '#00C49F' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 里程碑状态分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              里程碑状态
            </CardTitle>
            <CardDescription>当前里程碑完成情况</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : milestonePieData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                暂无里程碑数据
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={milestonePieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {milestonePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 部门统计与即将到期 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 部门项目统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              部门项目统计
            </CardTitle>
            <CardDescription>各部门项目数量与进度</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : departments.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                暂无部门数据
              </div>
            ) : (
              <div className="space-y-4">
                {departments.slice(0, 5).map((dept) => (
                  <div key={dept.departmentId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{dept.departmentName}</span>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{dept.projectCount} 个项目</span>
                        <span>{dept.completedCount} 已完成</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={dept.avgProgress} className="flex-1" />
                      <span className="text-sm font-medium w-12 text-right">
                        {dept.avgProgress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 即将到期的里程碑 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              即将到期
            </CardTitle>
            <CardDescription>未来7天内到期的里程碑</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>暂无即将到期的里程碑</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                  >
                    <div>
                      <p className="font-medium">{item.milestoneName}</p>
                      <p className="text-sm text-muted-foreground">{item.projectName}</p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={item.daysRemaining <= 1 ? 'destructive' : item.daysRemaining <= 3 ? 'default' : 'secondary'}
                      >
                        {item.daysRemaining === 0 ? '今日' : `${item.daysRemaining}天后`}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.dueDate).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 详细数据表格 */}
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">项目概览</TabsTrigger>
          <TabsTrigger value="documents">文档统计</TabsTrigger>
          <TabsTrigger value="reviews">审校统计</TabsTrigger>
          <TabsTrigger value="review-analysis">项目复盘</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>项目进度排行</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : departments.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">暂无数据</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={departments.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="departmentName" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="avgProgress" name="平均进度" fill="#0088FE" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>文档统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-blue-50">
                  <p className="text-2xl font-bold text-blue-600">{overview?.totalDocuments ?? 0}</p>
                  <p className="text-sm text-muted-foreground">文档总数</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-50">
                  <p className="text-2xl font-bold text-green-600">{overview?.totalKnowledge ?? 0}</p>
                  <p className="text-sm text-muted-foreground">知识条目</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-orange-50">
                  <p className="text-2xl font-bold text-orange-600">{overview?.pendingReviews ?? 0}</p>
                  <p className="text-sm text-muted-foreground">待审核</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-purple-50">
                  <p className="text-2xl font-bold text-purple-600">{overview?.myTasks ?? 0}</p>
                  <p className="text-sm text-muted-foreground">我的任务</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>审校效率分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">平均审校时间</span>
                  <Badge variant="outline">24 小时</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">审校通过率</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">85%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">问题发现数</span>
                  <Badge variant="outline">平均 12 个/文档</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 项目复盘 */}
        <TabsContent value="review-analysis" className="space-y-4">
          {/* 效率报表 */}
          <Card>
            <CardHeader>
              <CardTitle>项目效率分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">平均项目周期</p>
                  <p className="text-2xl font-bold">32天</p>
                  <p className="text-xs text-green-600">↓ 15% 较上月</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">平均投标响应时间</p>
                  <p className="text-2xl font-bold">7.5天</p>
                  <p className="text-xs text-green-600">↓ 8% 较上月</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">文档编制效率</p>
                  <p className="text-2xl font-bold">2.3份/天</p>
                  <p className="text-xs text-green-600">↑ 12% 较上月</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">中标率</p>
                  <p className="text-2xl font-bold">42%</p>
                  <p className="text-xs text-green-600">↑ 5% 较上月</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 项目复盘列表 */}
          <Card>
            <CardHeader>
              <CardTitle>已完成项目复盘</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 复盘项目项 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">某市政道路改造工程</h4>
                    <Badge className="bg-green-100 text-green-800">中标</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">项目周期</p>
                      <p className="font-medium">28天</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">文档数量</p>
                      <p className="font-medium">15份</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">审核轮次</p>
                      <p className="font-medium">3轮</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">评分</p>
                      <p className="font-medium text-green-600">92分</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">某智能交通系统建设项目</h4>
                    <Badge className="bg-red-100 text-red-800">未中标</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">项目周期</p>
                      <p className="font-medium">35天</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">文档数量</p>
                      <p className="font-medium">22份</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">审核轮次</p>
                      <p className="font-medium">5轮</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">评分</p>
                      <p className="font-medium text-yellow-600">78分</p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">某医院信息化升级项目</h4>
                    <Badge className="bg-green-100 text-green-800">中标</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">项目周期</p>
                      <p className="font-medium">21天</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">文档数量</p>
                      <p className="font-medium">18份</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">审核轮次</p>
                      <p className="font-medium">2轮</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">评分</p>
                      <p className="font-medium text-green-600">95分</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 经验总结 */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>成功经验</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>提前介入招标信息，充分准备时间</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>技术方案与商务报价紧密结合</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>审核流程优化，减少返工轮次</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>充分复用知识库内容提高效率</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>改进建议</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <span>加强投标文件格式规范检查</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <span>提高AI辅助生成内容质量</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <span>优化跨部门协作流程</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <span>增加历史投标数据分析</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// 统计卡片组件
// ============================================

interface StatCardProps {
  title: string;
  value: number;
  total?: number;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
  trend?: number;
  alert?: boolean;
}

function StatCard({ title, value, total, icon: Icon, color, loading, trend, alert }: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[80px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={alert ? 'border-red-200 bg-red-50' : ''}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{value}</span>
              {total !== undefined && total > 0 && (
                <span className="text-sm text-muted-foreground">/ {total}</span>
              )}
            </div>
            {trend !== undefined && (
              <div className={`flex items-center text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                )}
                {Math.abs(trend)}% 较上月
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${alert ? 'bg-red-100' : 'bg-gray-100'}`}>
            <Icon className={`h-6 w-6 ${alert ? 'text-red-500' : color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

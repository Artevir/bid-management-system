'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as _PieChart,
  Pie as _Pie,
  Cell as _Cell,
  BarChart as _BarChart,
  Bar as _Bar,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users as _Users,
  FileText,
  Target,
  Activity,
} from 'lucide-react';

interface ProjectDashboardProps {
  projectId: number;
}

interface DashboardStats {
  overview: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    totalDocuments: number;
    completedDocuments: number;
    totalMembers: number;
    daysRemaining: number;
  };
  progress: {
    overall: number;
    phases: Array<{
      name: string;
      progress: number;
      status: string;
    }>;
  };
  timeline: Array<{
    date: string;
    tasks: number;
    completed: number;
  }>;
  risks: Array<{
    id: string;
    level: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    dueDate?: string;
  }>;
  milestones: Array<{
    id: number;
    name: string;
    dueDate: string;
    status: string;
    progress: number;
  }>;
}

const _COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

const chartConfig = {
  tasks: {
    label: '任务数',
    color: '#3b82f6',
  },
  completed: {
    label: '完成数',
    color: '#22c55e',
  },
};

export default function ProjectDashboard({ projectId }: ProjectDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [projectId]);

  async function fetchDashboardData() {
    try {
      // 并行获取各项数据
      const [projectRes, milestonesRes, documentsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`).catch(() => ({ json: () => null })),
        fetch(`/api/projects/${projectId}/milestones`).catch(() => ({ json: () => ({ data: { milestones: [] } }) })),
        fetch('/api/bid/documents').catch(() => ({ json: () => ({ documents: [] }) })),
      ]);

      const projectData = await projectRes.json();
      const milestonesData = await milestonesRes.json();
      const documentsData = await documentsRes.json();
      const project = projectData?.data || null;

      if (project) {
        // 构建看板数据
        const milestones = milestonesData?.data?.milestones || milestonesData?.milestones || [];
        const documents = (documentsData?.documents || documentsData?.data?.documents || []).filter(
          (d: any) => d.projectId === projectId
        );

        // 计算剩余天数
        const deadline = project.submissionDeadline
          ? new Date(project.submissionDeadline)
          : null;
        const daysRemaining = deadline
          ? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0;

        // 构建进度数据
        const phases = project.phases || [];
        const phasesProgress = phases.map((phase: any) => ({
          name: phase.name,
          progress: phase.status === 'completed' ? 100 : phase.status === 'in_progress' ? 50 : 0,
          status: phase.status,
        }));

        // 构建风险数据
        const risks: DashboardStats['risks'] = [];
        
        // 检查即将到期的里程碑
        milestones.forEach((m: any) => {
          if (m.status !== 'completed') {
            const dueDate = new Date(m.dueDate);
            const daysUntilDue = Math.ceil(
              (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            
            if (daysUntilDue < 0) {
              risks.push({
                id: `overdue-${m.id}`,
                level: 'high',
                title: `里程碑逾期: ${m.name}`,
                description: '该里程碑已超过截止日期',
                dueDate: m.dueDate,
              });
            } else if (daysUntilDue <= 3) {
              risks.push({
                id: `warning-${m.id}`,
                level: 'medium',
                title: `里程碑即将到期: ${m.name}`,
                description: `距离截止日期还有 ${daysUntilDue} 天`,
                dueDate: m.dueDate,
              });
            }
          }
        });

        // 构建时间线数据（模拟最近7天）
        const timeline = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          timeline.push({
            date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
            tasks: Math.floor(Math.random() * 5) + 1,
            completed: Math.floor(Math.random() * 4) + 1,
          });
        }

        setStats({
          overview: {
            totalTasks: milestones.length * 3,
            completedTasks: milestones.filter((m: any) => m.status === 'completed').length * 3,
            pendingTasks: milestones.filter((m: any) => m.status === 'pending').length * 3,
            overdueTasks: risks.filter((r) => r.level === 'high').length,
            totalDocuments: documents.length,
            completedDocuments: documents.filter((d: any) => d.status === 'approved').length,
            totalMembers: 5,
            daysRemaining: Math.max(0, daysRemaining),
          },
          progress: {
            overall: project.progress || 0,
            phases: phasesProgress,
          },
          timeline,
          risks,
          milestones: milestones.slice(0, 5),
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        暂无数据
      </div>
    );
  }

  const riskColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <div className="space-y-6">
      {/* 概览卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">剩余天数</p>
                <p className="text-2xl font-bold">{stats.overview.daysRemaining}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">整体进度</p>
                <p className="text-2xl font-bold">{stats.progress.overall}%</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
            <Progress value={stats.progress.overall} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">标书文档</p>
                <p className="text-2xl font-bold">
                  {stats.overview.completedDocuments}/{stats.overview.totalDocuments}
                </p>
              </div>
              <FileText className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">风险预警</p>
                <p className="text-2xl font-bold text-red-500">
                  {stats.risks.filter((r) => r.level === 'high').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 阶段进度 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              阶段进度
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.progress.phases.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无阶段数据</p>
            ) : (
              <div className="space-y-4">
                {stats.progress.phases.map((phase, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{phase.name}</span>
                      <Badge
                        variant={
                          phase.status === 'completed'
                            ? 'default'
                            : phase.status === 'in_progress'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {phase.status === 'completed'
                          ? '已完成'
                          : phase.status === 'in_progress'
                          ? '进行中'
                          : '待开始'}
                      </Badge>
                    </div>
                    <Progress value={phase.progress} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 活动趋势 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              活动趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="tasks"
                    stroke="#3b82f6"
                    name="任务数"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#22c55e"
                    name="完成数"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 风险预警 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              风险预警
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.risks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无风险预警</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.risks.map((risk) => (
                  <div
                    key={risk.id}
                    className={`p-3 rounded-lg border ${riskColors[risk.level]}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{risk.title}</p>
                        <p className="text-sm mt-1">{risk.description}</p>
                      </div>
                      {risk.dueDate && (
                        <span className="text-xs">
                          {new Date(risk.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 里程碑 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              即将到来
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.milestones.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无里程碑</p>
            ) : (
              <div className="space-y-3">
                {stats.milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          milestone.status === 'completed'
                            ? 'bg-green-500'
                            : milestone.status === 'in_progress'
                            ? 'bg-blue-500'
                            : 'bg-gray-300'
                        }`}
                      />
                      <div>
                        <p className="font-medium">{milestone.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(milestone.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        milestone.status === 'completed'
                          ? 'default'
                          : milestone.status === 'in_progress'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {milestone.status === 'completed'
                        ? '已完成'
                        : milestone.status === 'in_progress'
                        ? '进行中'
                        : '待开始'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  FolderOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Plus,
  Users,
  BookOpen,
  FileSearch,
  BarChart3,
  BrainCircuit,
} from 'lucide-react';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalDocuments: number;
  pendingApprovals: number;
  totalKnowledge: number;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    time: string;
  }>;
  pendingTasks: Array<{
    id: number;
    type: string;
    title: string;
    projectName?: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: string;
  }>;
}

import { projectService } from '@/lib/api/project-service';
import { bidService } from '@/lib/api/bid-service';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      // 并行获取各项数据
      const [projectsData, documents, approvals] = await Promise.all([
        projectService.getProjects().catch(() => []),
        bidService.getDocuments(1).catch(() => []), // 假设使用项目ID 1作为默认演示
        bidService.getApprovals().catch(() => []),
      ]);

      const projects = Array.isArray(projectsData) ? projectsData : [];
      const knowledge: any[] = []; // 暂无知识库 service，保持空

      // 构建待办任务
      const pendingTasks = [
        ...approvals.map((a: any) => ({
          id: a.id,
          type: 'approval',
          title: `审核文档: ${a.document?.name || '未知文档'}`, // getPendingApprovals 返回结构包含 document
          projectName: a.document?.projectName,
          priority: 'high' as const,
        })),
        ...documents
          .filter((d: any) => d.status === 'draft' || d.status === 'editing')
          .slice(0, 3)
          .map((d: any) => ({
            id: d.id,
            type: 'document',
            title: `编写文档: ${d.name}`,
            projectName: d.projectName,
            priority: 'medium' as const,
            dueDate: d.deadline,
          })),
      ];

      // 构建最近活动（模拟）
      const recentActivities = [
        { id: '1', type: 'document', title: '新建标书文档', time: '刚刚' },
        { id: '2', type: 'approval', title: '提交审核', time: '5分钟前' },
        { id: '3', type: 'project', title: '创建项目', time: '1小时前' },
      ];

      setStats({
        totalProjects: projects.length,
        activeProjects: projects.filter((p: any) => p.status === 'active' || p.status === 'bidding').length,
        totalDocuments: documents.length,
        pendingApprovals: approvals.length,
        totalKnowledge: knowledge.length,
        recentActivities,
        pendingTasks,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // 设置默认数据
      setStats({
        totalProjects: 0,
        activeProjects: 0,
        totalDocuments: 0,
        pendingApprovals: 0,
        totalKnowledge: 0,
        recentActivities: [],
        pendingTasks: [],
      });
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: '进行中项目',
      value: stats?.activeProjects || 0,
      total: stats?.totalProjects || 0,
      icon: FolderOpen,
      color: 'text-blue-500',
      href: '/projects',
    },
    {
      title: '标书文档',
      value: stats?.totalDocuments || 0,
      icon: FileText,
      color: 'text-green-500',
      href: '/bid',
    },
    {
      title: '待审核',
      value: stats?.pendingApprovals || 0,
      icon: Clock,
      color: 'text-orange-500',
      href: '/approval',
    },
    {
      title: '知识条目',
      value: stats?.totalKnowledge || 0,
      icon: BookOpen,
      color: 'text-purple-500',
      href: '/knowledge',
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部欢迎区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">工作台</h1>
          <p className="text-muted-foreground">欢迎回来，查看您的工作概览</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Link>
          </Button>
          <Button asChild>
            <Link href="/bid">
              <FileText className="mr-2 h-4 w-4" />
              新建标书
            </Link>
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="cursor-pointer hover:shadow-md transition-shadow">
              <Link href={card.href}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {card.title}
                      </p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold">{card.value}</span>
                        {card.total !== undefined && card.total > 0 && (
                          <span className="text-sm text-muted-foreground">
                            / {card.total}
                          </span>
                        )}
                      </div>
                    </div>
                    <Icon className={`h-8 w-8 ${card.color}`} />
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 待办事项 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">待办事项</CardTitle>
            <Badge variant="secondary">{stats?.pendingTasks.length || 0}</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !stats?.pendingTasks.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无待办事项</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.pendingTasks.map((task) => (
                  <div
                    key={`${task.type}-${task.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => {
                      if (task.type === 'approval') {
                        router.push('/approval');
                      } else if (task.type === 'document') {
                        router.push(`/bid/${task.id}/edit`);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          task.priority === 'high'
                            ? 'bg-red-500'
                            : task.priority === 'medium'
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        {task.projectName && (
                          <p className="text-xs text-muted-foreground">
                            {task.projectName}
                          </p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快捷入口 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">快捷入口</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20"
              >
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">项目看板</p>
                  <p className="text-xs text-muted-foreground">数据分析与统计</p>
                </div>
              </Link>
              <Link
                href="/projects"
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <FolderOpen className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">项目管理</p>
                  <p className="text-xs text-muted-foreground">管理投标项目</p>
                </div>
              </Link>
              <Link
                href="/bid"
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <FileText className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">标书文档</p>
                  <p className="text-xs text-muted-foreground">编辑标书内容</p>
                </div>
              </Link>
              <Link
                href="/approval"
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <CheckCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">审核中心</p>
                  <p className="text-xs text-muted-foreground">处理审核任务</p>
                </div>
              </Link>
              <Link
                href="/knowledge"
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <BookOpen className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">知识库</p>
                  <p className="text-xs text-muted-foreground">管理知识资产</p>
                </div>
              </Link>
              <Link
                href="/ai-governance"
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <BrainCircuit className="h-5 w-5 text-indigo-500" />
                <div>
                  <p className="text-sm font-medium">AI治理</p>
                  <p className="text-xs text-muted-foreground">评测与质量监控</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 最近活动 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">最近活动</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !stats?.recentActivities.length ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无最近活动
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <FileSearch className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{activity.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

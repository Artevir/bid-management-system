'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowLeft,
  Calendar as _Calendar,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Settings as _Settings,
  List,
  BarChart3,
} from 'lucide-react';
import { toast as _toast } from 'sonner';
import { cn } from '@/lib/utils';

// 类型定义
interface GanttTask {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  status: string;
  assignee?: string;
  dependencies: number[];
  children?: GanttTask[];
  isMilestone?: boolean;
}

interface Project {
  id: number;
  name: string;
  status: string;
}

// 颜色配置
const statusColors: Record<string, string> = {
  not_started: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  delayed: 'bg-red-500',
  on_hold: 'bg-yellow-500',
};

const statusNames: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  delayed: '已延期',
  on_hold: '暂停',
};

// 时间刻度类型
type TimeScale = 'day' | 'week' | 'month';

export default function GanttChartPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [timeScale, setTimeScale] = useState<TimeScale>('week');
  const [viewStart, setViewStart] = useState(new Date());
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  // 加载项目列表
  useEffect(() => {
    fetchProjects();
  }, []);

  // 加载甘特图数据
  useEffect(() => {
    if (selectedProject) {
      fetchGanttData();
    }
  }, [selectedProject]);

  // 自动播放
  useEffect(() => {
    if (isPlaying) {
      const timer = setInterval(() => {
        setViewStart((prev) => {
          const next = new Date(prev);
          next.setDate(next.getDate() + 1);
          return next;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isPlaying]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('获取失败');
      const data = await response.json();
      const projectItems = data?.data?.items || data?.data || data || [];
      setProjects(projectItems);
      if (projectItems.length > 0) {
        const firstProject = projectItems[0];
        setSelectedProject(firstProject.id.toString());
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  };

  const fetchGanttData = async () => {
    setLoading(true);
    setError('');
    try {
      // 获取项目阶段和里程碑
      const [phasesRes, milestonesRes] = await Promise.all([
        fetch(`/api/projects/${selectedProject}/phases`),
        fetch(`/api/projects/${selectedProject}/milestones`),
      ]);

      const phasesData = phasesRes.ok ? await phasesRes.json() : {};
      const milestonesData = milestonesRes.ok ? await milestonesRes.json() : {};
      const phases = phasesData?.data?.phases || phasesData?.phases || [];
      const milestones = milestonesData?.data?.milestones || milestonesData?.milestones || [];

      // 构建甘特图任务数据
      const ganttTasks: GanttTask[] = [];

      // 添加阶段作为任务
      for (const phase of phases) {
        ganttTasks.push({
          id: phase.id,
          name: phase.name,
          startDate: new Date(phase.startDate || phase.createdAt),
          endDate: new Date(phase.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          progress: phase.progress || 0,
          status: phase.status || 'in_progress',
          assignee: phase.assigneeName,
          dependencies: [],
          children: [],
        });
      }

      // 添加里程碑
      for (const milestone of milestones) {
        ganttTasks.push({
          id: 1000 + milestone.id, // 避免ID冲突
          name: milestone.name,
          startDate: new Date(milestone.dueDate || milestone.createdAt),
          endDate: new Date(milestone.dueDate || milestone.createdAt),
          progress: milestone.isCompleted ? 100 : 0,
          status: milestone.isCompleted ? 'completed' : 'not_started',
          dependencies: [],
          isMilestone: true,
        });
      }

      // 如果没有数据，生成示例数据
      if (ganttTasks.length === 0) {
        ganttTasks.push(...generateSampleTasks());
      }

      setTasks(ganttTasks);
    } catch (error) {
      console.error('获取甘特图数据失败:', error);
      // 使用示例数据
      setTasks(generateSampleTasks());
    } finally {
      setLoading(false);
    }
  };

  // 生成示例任务
  const generateSampleTasks = (): GanttTask[] => {
    const now = new Date();
    return [
      {
        id: 1,
        name: '项目启动',
        startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        progress: 100,
        status: 'completed',
        dependencies: [],
      },
      {
        id: 2,
        name: '需求分析',
        startDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        progress: 100,
        status: 'completed',
        dependencies: [1],
      },
      {
        id: 3,
        name: '招标文件解读',
        startDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        progress: 70,
        status: 'in_progress',
        dependencies: [2],
      },
      {
        id: 4,
        name: '技术方案编制',
        startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        progress: 30,
        status: 'in_progress',
        dependencies: [3],
      },
      {
        id: 5,
        name: '商务报价编制',
        startDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        progress: 0,
        status: 'not_started',
        dependencies: [4],
      },
      {
        id: 6,
        name: '内部审核',
        startDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000),
        progress: 0,
        status: 'not_started',
        dependencies: [5],
      },
      {
        id: 7,
        name: '文件提交',
        startDate: new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        progress: 0,
        status: 'not_started',
        dependencies: [6],
        isMilestone: true,
      },
    ];
  };

  // 计算视图日期范围
  const getViewRange = () => {
    const start = new Date(viewStart);
    start.setDate(start.getDate() - 7); // 显示前7天
    start.setHours(0, 0, 0, 0);

    let days = 30; // 默认显示30天
    if (timeScale === 'day') days = 14;
    if (timeScale === 'month') days = 90;

    const end = new Date(start);
    end.setDate(end.getDate() + days);

    return { start, end };
  };

  // 生成时间轴刻度
  const generateTimeScale = () => {
    const { start, end } = getViewRange();
    const scales: { date: Date; label: string; isWeekend: boolean }[] = [];
    const current = new Date(start);

    while (current <= end) {
      scales.push({
        date: new Date(current),
        label: formatDateLabel(current, timeScale),
        isWeekend: current.getDay() === 0 || current.getDay() === 6,
      });
      current.setDate(current.getDate() + 1);
    }

    return scales;
  };

  // 格式化日期标签
  const formatDateLabel = (date: Date, scale: TimeScale): string => {
    if (scale === 'day') {
      return `${date.getDate()}`;
    } else if (scale === 'week') {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } else {
      return `${date.getMonth() + 1}月`;
    }
  };

  // 计算任务条位置
  const getTaskPosition = (task: GanttTask) => {
    const { start, end } = getViewRange();
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);

    const leftDays = Math.ceil((taskStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const taskDays = Math.max(
      1,
      Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (24 * 60 * 60 * 1000))
    );

    const left = Math.max(0, (leftDays / totalDays) * 100);
    const width = Math.min(100 - left, (taskDays / totalDays) * 100);

    return { left: `${left}%`, width: `${width}%` };
  };

  // 计算今日线位置
  const getTodayPosition = () => {
    const { start, end } = getViewRange();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const passedDays = Math.ceil((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    return Math.max(0, Math.min(100, (passedDays / totalDays) * 100));
  };

  // 缩放操作
  const handleZoomIn = () => {
    if (timeScale === 'month') setTimeScale('week');
    else if (timeScale === 'week') setTimeScale('day');
  };

  const handleZoomOut = () => {
    if (timeScale === 'day') setTimeScale('week');
    else if (timeScale === 'week') setTimeScale('month');
  };

  // 移动视图
  const handleMoveLeft = () => {
    setViewStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const handleMoveRight = () => {
    setViewStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const timeScales = generateTimeScale();
  const todayPosition = getTodayPosition();

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
            <h1 className="text-2xl font-bold">甘特图进度</h1>
            <p className="text-gray-500 text-sm">可视化项目进度与里程碑</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
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

      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleMoveLeft}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewStart(new Date())}>
            今天
          </Button>
          <Button variant="outline" size="sm" onClick={handleMoveRight}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeScale} onValueChange={(v) => setTimeScale(v as TimeScale)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">日</SelectItem>
              <SelectItem value="week">周</SelectItem>
              <SelectItem value="month">月</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-gray-400" />
          <span>未开始</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span>进行中</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span>已完成</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span>已延期</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-4 h-3 bg-yellow-500"
            style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}
          />
          <span>里程碑</span>
        </div>
      </div>

      {/* 甘特图主体 */}
      <Card>
        <CardContent className="p-0">
          {error ? (
            <ListStateBlock state="error" error={error} onRetry={fetchProjects} />
          ) : loading ? (
            <ListStateBlock state="loading" />
          ) : tasks.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无数据" />
          ) : (
            <div className="overflow-x-auto" ref={ganttRef}>
              <div className="min-w-[1200px]">
                {/* 时间轴头部 */}
                <div className="flex border-b bg-gray-50 sticky top-0 z-10">
                  <div className="w-64 flex-shrink-0 p-2 border-r font-medium">任务名称</div>
                  <div className="flex-1 relative">
                    {/* 日期刻度 */}
                    <div className="flex h-8">
                      {timeScales.map((scale, index) => (
                        <div
                          key={index}
                          className={cn(
                            'flex-1 text-xs text-center border-r',
                            scale.isWeekend && 'bg-gray-100'
                          )}
                        >
                          {scale.label}
                        </div>
                      ))}
                    </div>
                    {/* 今日线 */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                      style={{ left: `${todayPosition}%` }}
                    />
                  </div>
                </div>

                {/* 任务行 */}
                {tasks.map((task, _index) => {
                  const position = getTaskPosition(task);

                  return (
                    <Popover key={task.id}>
                      <PopoverTrigger asChild>
                        <div
                          className={cn(
                            'flex border-b hover:bg-gray-50 cursor-pointer transition-colors',
                            selectedTask?.id === task.id && 'bg-blue-50'
                          )}
                          onClick={() => setSelectedTask(task)}
                        >
                          {/* 任务名称 */}
                          <div className="w-64 flex-shrink-0 p-2 border-r flex items-center gap-2">
                            {task.isMilestone ? (
                              <div
                                className="w-3 h-3 bg-yellow-500"
                                style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}
                              />
                            ) : (
                              <div className={cn('w-3 h-3 rounded', statusColors[task.status])} />
                            )}
                            <span className="truncate text-sm">{task.name}</span>
                          </div>

                          {/* 任务条 */}
                          <div className="flex-1 relative h-12">
                            {/* 周末背景 */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {timeScales.map((scale, i) => (
                                <div
                                  key={i}
                                  className={cn('flex-1 border-r', scale.isWeekend && 'bg-gray-50')}
                                />
                              ))}
                            </div>

                            {/* 任务条 */}
                            <div
                              className={cn(
                                'absolute top-2 h-8 rounded',
                                task.isMilestone ? 'bg-yellow-500' : statusColors[task.status]
                              )}
                              style={{
                                left: position.left,
                                width: task.isMilestone ? '12px' : position.width,
                                clipPath: task.isMilestone
                                  ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
                                  : undefined,
                              }}
                            >
                              {!task.isMilestone && task.progress > 0 && (
                                <div
                                  className="h-full bg-black/20 rounded"
                                  style={{ width: `${task.progress}%` }}
                                />
                              )}
                            </div>

                            {/* 今日线 */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500/50"
                              style={{ left: `${todayPosition}%` }}
                            />
                          </div>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-72">
                        <div className="space-y-2">
                          <h4 className="font-medium">{task.name}</h4>
                          <div className="text-sm text-gray-500">
                            <div>状态: {statusNames[task.status] || task.status}</div>
                            <div>开始: {new Date(task.startDate).toLocaleDateString()}</div>
                            <div>结束: {new Date(task.endDate).toLocaleDateString()}</div>
                            {!task.isMilestone && <div>进度: {task.progress}%</div>}
                            {task.assignee && <div>负责人: {task.assignee}</div>}
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 任务列表视图 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            任务列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-3 h-3 rounded', statusColors[task.status])} />
                  <span className="font-medium">{task.name}</span>
                  {task.isMilestone && <Badge variant="outline">里程碑</Badge>}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{new Date(task.startDate).toLocaleDateString()}</span>
                  <span>-</span>
                  <span>{new Date(task.endDate).toLocaleDateString()}</span>
                  <Badge className={statusColors[task.status]}>{statusNames[task.status]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

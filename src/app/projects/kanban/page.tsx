'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  User,
  Building2,
  GripVertical,
  LayoutGrid,
  List,
  Filter,
} from 'lucide-react';

// ============================================
// 类型定义
// ============================================

interface Project {
  id: number;
  name: string;
  code: string;
  status: string;
  progress: number;
  tenderOrganization: string | null;
  submissionDeadline: string | null;
  owner: {
    id: number;
    realName: string;
  };
  department: {
    id: number;
    name: string;
  };
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  projects: Project[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-500' },
  active: { label: '进行中', color: 'bg-blue-500' },
  bidding: { label: '投标中', color: 'bg-orange-500' },
  submitted: { label: '已提交', color: 'bg-purple-500' },
  awarded: { label: '已中标', color: 'bg-green-500' },
  lost: { label: '未中标', color: 'bg-red-500' },
  completed: { label: '已完结', color: 'bg-teal-500' },
  archived: { label: '已归档', color: 'bg-gray-400' },
};

// 看板列顺序
const columnOrder = ['draft', 'active', 'bidding', 'submitted', 'awarded', 'completed', 'lost'];

export default function ProjectKanbanPage() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [dragSourceColumn, setDragSourceColumn] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    setLoading(true);
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      
      // 按状态分组项目
      const groupedProjects: Record<string, Project[]> = {};
      columnOrder.forEach(status => {
        groupedProjects[status] = [];
      });

      (data.projects || []).forEach((project: Project) => {
        if (groupedProjects[project.status]) {
          groupedProjects[project.status].push(project);
        }
      });

      // 构建看板列
      const kanbanColumns: KanbanColumn[] = columnOrder.map(status => ({
        id: status,
        title: statusConfig[status]?.label || status,
        color: statusConfig[status]?.color || 'bg-gray-500',
        projects: groupedProjects[status],
      }));

      setColumns(kanbanColumns);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  }

  // 拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, project: Project, columnId: string) => {
    setDraggedProject(project);
    setDragSourceColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    // 设置拖拽图像
    const target = e.target as HTMLElement;
    e.dataTransfer.setDragImage(target, 0, 0);
  }, []);

  // 拖拽悬停
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // 放置
  const handleDrop = useCallback(async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    
    if (!draggedProject || !dragSourceColumn) return;
    if (dragSourceColumn === targetColumnId) return;

    // 更新项目状态
    try {
      const response = await fetch(`/api/projects/${draggedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetColumnId }),
      });

      if (!response.ok) throw new Error('更新失败');

      // 更新本地状态
      setColumns(prev => {
        const newColumns = [...prev];
        
        // 从源列移除
        const sourceCol = newColumns.find(c => c.id === dragSourceColumn);
        if (sourceCol) {
          sourceCol.projects = sourceCol.projects.filter(p => p.id !== draggedProject.id);
        }
        
        // 添加到目标列
        const targetCol = newColumns.find(c => c.id === targetColumnId);
        if (targetCol) {
          targetCol.projects = [...targetCol.projects, { ...draggedProject, status: targetColumnId }];
        }
        
        return newColumns;
      });
    } catch (error) {
      console.error('Failed to update project status:', error);
      // 刷新数据恢复状态
      fetchProjects();
    } finally {
      setDraggedProject(null);
      setDragSourceColumn(null);
    }
  }, [draggedProject, dragSourceColumn]);

  const handleDragEnd = useCallback(() => {
    setDraggedProject(null);
    setDragSourceColumn(null);
  }, []);

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  // 计算剩余天数
  const getDaysRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  // 获取进度条颜色
  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 30) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div className="container-fluid mx-auto py-6 space-y-6 px-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">项目看板</h1>
          <p className="text-muted-foreground">可视化项目管理，拖拽卡片更新状态</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/projects">
              <List className="mr-2 h-4 w-4" />
              列表视图
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </a>
          </Button>
        </div>
      </div>

      {/* 看板 */}
      {loading ? (
        <div className="grid grid-cols-6 gap-4">
          {columnOrder.map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex flex-col min-w-[280px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* 列标题 */}
              <div className="flex items-center justify-between p-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-medium">{column.title}</h3>
                  <Badge variant="secondary" className="ml-1">
                    {column.projects.length}
                  </Badge>
                </div>
              </div>

              {/* 项目卡片 */}
              <div className="flex-1 space-y-3 min-h-[200px] bg-muted/30 rounded-lg p-2">
                {column.projects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    暂无项目
                  </div>
                ) : (
                  column.projects.map((project) => {
                    const daysRemaining = getDaysRemaining(project.submissionDeadline);
                    
                    return (
                      <Card
                        key={project.id}
                        className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                          draggedProject?.id === project.id ? 'opacity-50' : ''
                        }`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project, column.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedProject(project)}
                      >
                        <CardContent className="p-3">
                          {/* 卡片头部 */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">
                                {project.name}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {project.code}
                              </p>
                            </div>
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>

                          {/* 招标单位 */}
                          {project.tenderOrganization && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <Building2 className="h-3 w-3" />
                              <span className="truncate">{project.tenderOrganization}</span>
                            </div>
                          )}

                          {/* 进度条 */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">进度</span>
                              <span>{project.progress}%</span>
                            </div>
                            <Progress 
                              value={project.progress} 
                              className="h-1.5"
                            />
                          </div>

                          {/* 底部信息 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[10px]">
                                  {project.owner.realName.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            {project.submissionDeadline && (
                              <div className={`flex items-center gap-1 text-xs ${
                                daysRemaining !== null && daysRemaining < 3
                                  ? 'text-red-500'
                                  : daysRemaining !== null && daysRemaining < 7
                                  ? 'text-orange-500'
                                  : 'text-muted-foreground'
                              }`}>
                                <Calendar className="h-3 w-3" />
                                {formatDate(project.submissionDeadline)}
                                {daysRemaining !== null && daysRemaining > 0 && (
                                  <span className="ml-1">({daysRemaining}天)</span>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 项目详情弹窗 */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedProject?.name}</DialogTitle>
            <DialogDescription>
              {selectedProject?.code}
            </DialogDescription>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">招标单位</p>
                  <p className="font-medium">{selectedProject.tenderOrganization || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">负责人</p>
                  <p className="font-medium">{selectedProject.owner.realName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">所属部门</p>
                  <p className="font-medium">{selectedProject.department.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">投标截止</p>
                  <p className="font-medium">
                    {formatDate(selectedProject.submissionDeadline)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">项目进度</p>
                <Progress value={selectedProject.progress} className="h-2" />
                <p className="text-right text-sm mt-1">{selectedProject.progress}%</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <a href={`/projects/${selectedProject.id}`}>查看详情</a>
                </Button>
                <Button asChild>
                  <a href={`/projects/${selectedProject.id}/edit`}>编辑项目</a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

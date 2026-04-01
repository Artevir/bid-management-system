'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs as _Tabs, TabsContent as _TabsContent, TabsList as _TabsList, TabsTrigger as _TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator as _Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  DialogTrigger as _DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileText as _FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Clock as _Clock,
  Play,
  Eye,
  Check,
  X as _X,
  Search as _Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 解析任务状态类型
type ParseTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 解析项类型
type ParseItemType = 'deadline' | 'qualification' | 'scoring_item' | 'technical_param' | 'commercial' | 'requirement';

// 解析任务接口
interface ParseTask {
  id: number;
  projectId: number;
  fileId: number;
  fileName: string;
  type: string;
  status: ParseTaskStatus;
  progress: number;
  totalPages: number | null;
  processedPages: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// 解析项接口
interface ParseItem {
  id: number;
  taskId: number;
  type: ParseItemType;
  title: string;
  content: string;
  originalText: string | null;
  pageNumber: number | null;
  confidence: number;
  isLowConfidence: boolean;
  isConfirmed: boolean;
  confirmedBy: number | null;
  confirmedAt: string | null;
  extraData: Record<string, unknown> | null;
  createdAt: string;
}

// 解析项统计
interface ParseItemStats {
  total: number;
  byType: Record<string, number>;
  lowConfidence: number;
  confirmed: number;
}

// 状态颜色映射
const STATUS_COLORS: Record<ParseTaskStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

// 状态标签
const STATUS_LABELS: Record<ParseTaskStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
};

// 解析项类型标签
const ITEM_TYPE_LABELS: Record<ParseItemType, string> = {
  deadline: '时间节点',
  qualification: '资格条件',
  scoring_item: '评分项',
  technical_param: '技术参数',
  commercial: '商务条款',
  requirement: '其他要求',
};

interface ParseDashboardProps {
  projectId: number;
}

export function ParseDashboard({ projectId }: ParseDashboardProps) {
  const [tasks, setTasks] = useState<ParseTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ParseTask | null>(null);
  const [items, setItems] = useState<ParseItem[]>([]);
  const [itemStats, setItemStats] = useState<ParseItemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<ParseItemType | 'all'>('all');
  const [showLowConfidenceOnly, setShowLowConfidenceOnly] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmingItem, setConfirmingItem] = useState<ParseItem | null>(null);
  const [correctedContent, setCorrectedContent] = useState('');

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/parse/tasks?projectId=${projectId}`);
      if (!res.ok) throw new Error('获取解析任务失败');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取解析任务失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (taskId: number) => {
    setItemsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') {
        params.append('type', filterType);
      }
      if (showLowConfidenceOnly) {
        params.append('lowConfidence', 'true');
      }
      
      const res = await fetch(`/api/parse/tasks/${taskId}/items?${params.toString()}`);
      if (!res.ok) throw new Error('获取解析项失败');
      const data = await res.json();
      setItems(data.items || []);
      setItemStats(data.stats || null);
    } catch (err) {
      console.error('获取解析项失败:', err);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleTaskSelect = (task: ParseTask) => {
    setSelectedTask(task);
    fetchItems(task.id);
  };

  const handleExecuteTask = async (taskId: number) => {
    try {
      const res = await fetch(`/api/parse/tasks/${taskId}`, { method: 'POST' });
      if (!res.ok) throw new Error('启动解析任务失败');
      // 刷新任务列表
      fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动解析任务失败');
    }
  };

  const handleConfirmItem = async () => {
    if (!confirmingItem) return;
    
    try {
      const res = await fetch(`/api/parse/items/${confirmingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctedContent }),
      });
      if (!res.ok) throw new Error('确认解析项失败');
      
      // 刷新解析项列表
      if (selectedTask) {
        fetchItems(selectedTask.id);
      }
      setConfirmDialogOpen(false);
      setConfirmingItem(null);
      setCorrectedContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认解析项失败');
    }
  };

  const openConfirmDialog = (item: ParseItem) => {
    setConfirmingItem(item);
    setCorrectedContent(item.content);
    setConfirmDialogOpen(true);
  };

  const _formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'yyyy-MM-dd HH:mm', { locale: zhCN });
  };

  const getConfidenceBadge = (confidence: number, isLowConfidence: boolean) => {
    if (isLowConfidence) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          低置信度 ({confidence}%)
        </Badge>
      );
    }
    if (confidence >= 90) {
      return (
        <Badge variant="default" className="bg-green-500 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          高 ({confidence}%)
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        中 ({confidence}%)
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{String(error)}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 解析任务列表 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>解析任务</CardTitle>
                <CardDescription>文档解析任务列表</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchTasks}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无解析任务
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTask?.id === task.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => handleTaskSelect(task)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm truncate flex-1">
                        {task.fileName}
                      </span>
                      <Badge className={STATUS_COLORS[task.status]}>
                        {STATUS_LABELS[task.status]}
                      </Badge>
                    </div>
                    {task.status === 'processing' && (
                      <div className="space-y-1">
                        <Progress value={task.progress} className="h-1" />
                        <p className="text-xs text-muted-foreground text-right">
                          {task.progress}%
                        </p>
                      </div>
                    )}
                    {task.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExecuteTask(task.id);
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        开始解析
                      </Button>
                    )}
                    {task.status === 'failed' && task.errorMessage && (
                      <p className="text-xs text-red-500 mt-1 truncate">
                        {task.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 解析结果 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>解析结果</CardTitle>
                <CardDescription>
                  {selectedTask ? selectedTask.fileName : '请选择解析任务'}
                </CardDescription>
              </div>
              {itemStats && (
                <div className="flex gap-2">
                  <Badge variant="outline">
                    共 {itemStats.total} 项
                  </Badge>
                  {itemStats.lowConfidence > 0 && (
                    <Badge variant="destructive">
                      {itemStats.lowConfidence} 项需确认
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedTask ? (
              <div className="text-center py-12 text-muted-foreground">
                请从左侧选择一个解析任务
              </div>
            ) : itemsLoading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* 过滤器 */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <select
                      className="text-sm border rounded px-2 py-1"
                      value={filterType}
                      onChange={(e) => {
                        setFilterType(e.target.value as ParseItemType | 'all');
                        fetchItems(selectedTask.id);
                      }}
                    >
                      <option value="all">全部类型</option>
                      {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showLowConfidenceOnly}
                      onChange={(e) => {
                        setShowLowConfidenceOnly(e.target.checked);
                        fetchItems(selectedTask.id);
                      }}
                      className="rounded"
                    />
                    仅显示低置信度
                  </label>
                </div>

                {/* 解析项列表 */}
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无解析结果
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">类型</TableHead>
                        <TableHead>标题</TableHead>
                        <TableHead className="w-[120px]">置信度</TableHead>
                        <TableHead className="w-[80px]">状态</TableHead>
                        <TableHead className="w-[100px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {ITEM_TYPE_LABELS[item.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px]">
                              <p className="font-medium text-sm truncate">
                                {item.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {item.content}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getConfidenceBadge(item.confidence, item.isLowConfidence)}
                          </TableCell>
                          <TableCell>
                            {item.isConfirmed ? (
                              <Badge variant="default" className="bg-green-500 text-xs">
                                已确认
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                待确认
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="查看详情"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!item.isConfirmed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="确认"
                                  onClick={() => openConfirmDialog(item)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 确认对话框 */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>确认解析项</DialogTitle>
            <DialogDescription>
              检查并确认解析结果，如有错误可修正内容
            </DialogDescription>
          </DialogHeader>
          {confirmingItem && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">类型</Label>
                <p className="text-sm text-muted-foreground">
                  {ITEM_TYPE_LABELS[confirmingItem.type]}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">标题</Label>
                <p className="text-sm">{confirmingItem.title}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">原文引用</Label>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  {confirmingItem.originalText || '无'}
                </p>
              </div>
              <div>
                <Label htmlFor="content" className="text-sm font-medium">
                  解析内容（可修正）
                </Label>
                <Textarea
                  id="content"
                  value={correctedContent}
                  onChange={(e) => setCorrectedContent(e.target.value)}
                  rows={4}
                />
              </div>
              {confirmingItem.pageNumber && (
                <div>
                  <Label className="text-sm font-medium">页码</Label>
                  <p className="text-sm text-muted-foreground">
                    第 {confirmingItem.pageNumber} 页
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmItem}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

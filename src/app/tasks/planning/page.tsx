/**
 * 智能任务规划页面
 * 基于文件解读结果，使用AI进行任务分解和分配
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator as _Separator } from '@/components/ui/separator';
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
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Wand2,
  FileSearch,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Building,
  DollarSign,
  Package,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { extractErrorMessage } from '@/lib/error-message';

// 文件解读数据类型
interface Interpretation {
  id: number;
  documentName: string;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  expireTime: string | null;
  status: string;
  createdAt: string;
}

// 任务分解结果类型
interface TaskBreakdown {
  id: string;
  name: string;
  description: string;
  deadline?: string;
  assignee?: {
    id: number;
    name: string;
    role: string;
  };
  priority: 'high' | 'medium' | 'low';
  category: string;
  dependencies?: string[];
  estimatedHours?: number;
  relatedApplication?: {
    type: 'authorization' | 'sample' | 'price' | 'partner';
    name: string;
  };
}

interface TaskPlanResult {
  projectName: string;
  projectCode?: string;
  overallDeadline: string;
  timeNodes: {
    name: string;
    deadline: string;
    description?: string;
    type: string;
  }[];
  tasks: TaskBreakdown[];
  recommendations: string[];
  riskAlerts: string[];
}

// 优先级配置
const PRIORITY_CONFIG = {
  high: { label: '高', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  medium: { label: '中', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  low: { label: '低', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
};

// 类别图标映射
const CATEGORY_ICONS: Record<string, any> = {
  授权申请: FileText,
  样机申请: Package,
  价格申请: DollarSign,
  友司支持: Building,
  文档编制: FileText,
  材料准备: FileText,
  审核提交: CheckCircle2,
};

// 申请类型映射
const APPLICATION_TYPE_LABELS: Record<string, string> = {
  authorization: '授权申请',
  sample: '样机申请',
  price: '价格申请',
  partner: '友司支持',
};

export default function TaskPlanningPage() {
  const router = useRouter();
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInterpretations, setLoadingInterpretations] = useState(true);
  const [error, setError] = useState('');
  const [planResult, setPlanResult] = useState<TaskPlanResult | null>(null);

  // 加载文件解读列表
  const fetchInterpretations = useCallback(async () => {
    setLoadingInterpretations(true);
    try {
      const response = await fetch('/api/tasks/planning');
      if (!response.ok) throw new Error('获取文件解读列表失败');
      const data = await response.json();
      setInterpretations(data);
    } catch (err) {
      console.error('Failed to fetch interpretations:', err);
    } finally {
      setLoadingInterpretations(false);
    }
  }, []);

  useEffect(() => {
    fetchInterpretations();
  }, [fetchInterpretations]);

  // 生成任务计划
  const handleGenerate = async () => {
    if (!selectedId) {
      setError('请选择要解析的招标文件');
      return;
    }

    setLoading(true);
    setError('');
    setPlanResult(null);

    try {
      const response = await fetch('/api/tasks/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interpretationId: parseInt(selectedId),
          additionalContext,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(extractErrorMessage(data, '生成任务计划失败'));
      }

      const result = await response.json();
      setPlanResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成任务计划失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取优先级徽章
  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    const config = PRIORITY_CONFIG[priority];
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // 获取类别徽章
  const getCategoryBadge = (category: string) => {
    const Icon = CATEGORY_ICONS[category] || FileText;
    return (
      <Badge variant="outline" className="gap-1">
        <Icon className="h-3 w-3" />
        {category}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/tasks')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/tasks" className="hover:text-foreground">
              任务中心
            </Link>
            <span>/</span>
            <span className="text-foreground">智能任务规划</span>
          </div>
          <h1 className="text-2xl font-bold">智能任务规划</h1>
          <p className="text-muted-foreground">基于招标文件解读，AI智能分解任务并分配责任人</p>
        </div>
      </div>

      {/* 选择文件解读 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            选择招标文件解读
          </CardTitle>
          <CardDescription>
            选择已完成解读的招标文件，系统将基于解读结果进行任务分解
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingInterpretations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : interpretations.length === 0 ? (
            <div className="space-y-3">
              <ListStateBlock state="empty" emptyText="暂无可用的文件解读" />
              <p className="text-sm text-muted-foreground text-center">
                请先在{' '}
                <Link href="/interpretations" className="underline">
                  文件解读
                </Link>{' '}
                模块上传并解析招标文件
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>选择文件解读记录</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择招标文件解读记录" />
                  </SelectTrigger>
                  <SelectContent>
                    {interpretations.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{item.documentName}</span>
                          {item.projectName && (
                            <span className="text-muted-foreground">- {item.projectName}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 显示选中的解读信息 */}
              {selectedId &&
                (() => {
                  const selected = interpretations.find((i) => String(i.id) === selectedId);
                  if (!selected) return null;
                  return (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">项目名称：</span>
                          <span className="font-medium">{selected.projectName || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">项目编号：</span>
                          <span>{selected.projectCode || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">招标单位：</span>
                          <span>{selected.tenderOrganization || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">投标截止：</span>
                          <span className="text-red-600 font-medium">
                            {selected.expireTime
                              ? format(new Date(selected.expireTime), 'yyyy-MM-dd HH:mm', {
                                  locale: zhCN,
                                })
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* 补充上下文 */}
              <div className="space-y-2">
                <Label>补充说明（可选）</Label>
                <Textarea
                  placeholder="输入额外的上下文信息，如特殊要求、团队成员特长等，帮助AI更好地分配任务..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={3}
                />
              </div>

              {/* 错误提示 */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{String(error)}</AlertDescription>
                </Alert>
              )}

              {/* 生成按钮 */}
              <Button onClick={handleGenerate} disabled={loading || !selectedId} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI正在分析任务...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    生成任务计划
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 任务计划结果 */}
      {planResult && (
        <div className="space-y-6">
          {/* 项目概览 */}
          <Card>
            <CardHeader>
              <CardTitle>项目概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">项目名称</p>
                  <p className="font-medium">{planResult.projectName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">项目编号</p>
                  <p className="font-medium">{planResult.projectCode || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">投标截止日期</p>
                  <p className="font-medium text-red-600">{planResult.overallDeadline}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">任务数量</p>
                  <p className="font-medium text-blue-600">{planResult.tasks.length} 项</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 时间节点 */}
          {planResult.timeNodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  关键时间节点
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {planResult.timeNodes.map((node, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex-shrink-0 w-20 text-sm font-medium text-red-600">
                        {node.deadline}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{node.name}</p>
                        {node.description && (
                          <p className="text-sm text-muted-foreground">{node.description}</p>
                        )}
                      </div>
                      <Badge variant="outline">{node.type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 任务列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                任务分解结果
              </CardTitle>
              <CardDescription>AI已将投标项目分解为以下可执行任务</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>任务名称</TableHead>
                    <TableHead>负责人</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>类别</TableHead>
                    <TableHead>截止时间</TableHead>
                    <TableHead>预估工时</TableHead>
                    <TableHead>关联申请</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planResult.tasks.map((task, index) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {task.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-3 w-3" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{task.assignee.name}</p>
                              <p className="text-xs text-muted-foreground">{task.assignee.role}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">待分配</span>
                        )}
                      </TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>{getCategoryBadge(task.category)}</TableCell>
                      <TableCell className="text-sm">{task.deadline || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {task.estimatedHours ? `${task.estimatedHours}h` : '-'}
                      </TableCell>
                      <TableCell>
                        {task.relatedApplication ? (
                          <Badge variant="secondary">
                            {APPLICATION_TYPE_LABELS[task.relatedApplication.type]}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 建议和风险 */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* 建议 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  专业建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {planResult.recommendations.map((rec, index) => (
                    <li key={index} className="flex gap-2 text-sm">
                      <span className="text-green-600 font-bold">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* 风险提醒 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-5 w-5" />
                  风险提醒
                </CardTitle>
              </CardHeader>
              <CardContent>
                {planResult.riskAlerts.length > 0 ? (
                  <ul className="space-y-2">
                    {planResult.riskAlerts.map((alert, index) => (
                      <li key={index} className="flex gap-2 text-sm">
                        <span className="text-orange-600 font-bold">!</span>
                        <span>{alert}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无明显风险</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPlanResult(null)}>
              重新规划
            </Button>
            <Button onClick={() => router.push('/tasks')}>查看任务列表</Button>
          </div>
        </div>
      )}
    </div>
  );
}

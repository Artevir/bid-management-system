'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BrainCircuit,
  TestTube,
  BarChart3,
  Plus,
  Play,
  RefreshCw,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

// ============================================
// 类型定义
// ============================================

interface EvaluationSet {
  id: number;
  name: string;
  description: string | null;
  documentType: string;
  sampleCount: number;
  status: string;
  createdAt: string;
}

interface RegressionTest {
  id: number;
  setName: string;
  totalSamples: number;
  passedSamples: number;
  failedSamples: number;
  accuracy: number;
  duration: number;
  status: string;
  createdAt: string;
}

interface QualityMetric {
  metricName: string;
  currentValue: number;
  previousValue: number;
  trend: 'up' | 'down' | 'stable';
  unit: string;
}

interface TestCaseResult {
  id: number;
  testRunId: number;
  testCaseId: number;
  caseCode: string;
  input: string;
  actualOutput: string | null;
  expectedOutput: string | null;
  score: number | null;
  passed: boolean;
  latency: number | null;
  tokenInput: number | null;
  tokenOutput: number | null;
  errorMessage: string | null;
  evaluatedAt: string;
}

interface TestRunDetail {
  id: number;
  evaluationSetId: number;
  modelId: string;
  status: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  avgScore: number | null;
  avgLatency: number | null;
  createdAt: string;
  completedAt: string | null;
  evaluationSet?: {
    id: number;
    name: string;
    category: string;
  } | null;
  caseResults: TestCaseResult[];
}

export default function AIGovernancePage() {
  const [evaluationSets, setEvaluationSets] = useState<EvaluationSet[]>([]);
  const [regressionTests, setRegressionTests] = useState<RegressionTest[]>([]);
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('evaluations');

  // 弹窗状态
  const [evalSetDialog, setEvalSetDialog] = useState<EvaluationSet | null>(null);
  const [testDetailDialog, setTestDetailDialog] = useState<TestRunDetail | null>(null);
  const [caseResultsDialog, setCaseResultsDialog] = useState<TestCaseResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [evalsRes, testsRes, metricsRes] = await Promise.all([
        fetch('/api/ai-governance').catch(() => ({ json: () => ({ sets: [] }) })),
        fetch('/api/ai-governance?type=tests').catch(() => ({ json: () => ({ tests: [] }) })),
        fetch('/api/ai-governance?type=metrics').catch(() => ({ json: () => ({ metrics: [] }) })),
      ]);

      const [evalsData, testsData, metricsData] = await Promise.all([
        evalsRes.json(),
        testsRes.json(),
        metricsRes.json(),
      ]);

      setEvaluationSets(evalsData.sets || []);
      setRegressionTests(testsData.tests || []);
      setMetrics(metricsData.metrics || []);
    } catch (error) {
      console.error('Failed to fetch AI governance data:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function createEvaluationSet(data: Partial<EvaluationSet>) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/ai-governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        fetchData();
        setEvalSetDialog(null);
      } else {
        alert(result.error || '创建失败');
      }
    } catch (error) {
      console.error('Failed to create evaluation set:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
      alert('创建失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function runRegressionTest(setId: number) {
    try {
      const res = await fetch('/api/ai-governance?action=run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId }),
      });
      const result = await res.json();
      if (result.success) {
        fetchData();
      } else {
        alert(result.error || '启动失败');
      }
    } catch (error) {
      console.error('Failed to run regression test:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
      alert('启动失败');
    }
  }

  async function viewTestDetail(runId: number) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/ai-governance?action=run-detail&runId=${runId}`);
      const result = await res.json();
      if (result.detail) {
        setTestDetailDialog(result.detail);
      } else {
        alert(result.error || '获取详情失败');
      }
    } catch (error) {
      console.error('Failed to get test detail:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
      alert('获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  }

  async function viewCaseResults(runId: number) {
    try {
      const res = await fetch(`/api/ai-governance?action=case-results&runId=${runId}`);
      const result = await res.json();
      if (result.results) {
        setCaseResultsDialog(result.results);
      } else {
        alert(result.error || '获取用例结果失败');
      }
    } catch (error) {
      console.error('Failed to get case results:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
      alert('获取用例结果失败');
    }
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<
      string,
      { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }
    > = {
      active: { variant: 'default', icon: CheckCircle },
      inactive: { variant: 'secondary', icon: Minus },
      running: { variant: 'default', icon: RefreshCw },
      completed: { variant: 'default', icon: CheckCircle },
      failed: { variant: 'destructive', icon: XCircle },
    };
    const config = configs[status] || { variant: 'secondary', icon: AlertTriangle };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
        {status === 'active'
          ? '启用'
          : status === 'inactive'
            ? '禁用'
            : status === 'running'
              ? '运行中'
              : status === 'completed'
                ? '已完成'
                : status === 'failed'
                  ? '失败'
                  : status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI 治理中心</h1>
          <p className="text-muted-foreground">管理AI评测、回归测试与质量监控</p>
        </div>
      </div>

      {/* 质量指标概览 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {error ? (
          <ListStateBlock state="error" error={error} onRetry={() => window.location.reload()} />
        ) : loading ? (
          <ListStateBlock state="loading" />
        ) : (
          metrics.slice(0, 4).map((metric) => (
            <Card key={metric.metricName}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.metricName}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-bold">{metric.currentValue.toFixed(1)}</span>
                      <span className="text-sm text-muted-foreground">{metric.unit}</span>
                    </div>
                  </div>
                  <div
                    className={`p-2 rounded-full ${
                      metric.trend === 'up'
                        ? 'bg-green-100'
                        : metric.trend === 'down'
                          ? 'bg-red-100'
                          : 'bg-gray-100'
                    }`}
                  >
                    {metric.trend === 'up' && <TrendingUp className="h-5 w-5 text-green-600" />}
                    {metric.trend === 'down' && <TrendingDown className="h-5 w-5 text-red-600" />}
                    {metric.trend === 'stable' && <Minus className="h-5 w-5 text-gray-400" />}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  较上期: {metric.previousValue.toFixed(1)} {metric.unit}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="evaluations">
            <BrainCircuit className="h-4 w-4 mr-2" />
            评测集管理
          </TabsTrigger>
          <TabsTrigger value="regression">
            <TestTube className="h-4 w-4 mr-2" />
            回归测试
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <BarChart3 className="h-4 w-4 mr-2" />
            质量指标
          </TabsTrigger>
          <TabsTrigger value="logs">
            <RefreshCw className="h-4 w-4 mr-2" />
            AI日志查询
          </TabsTrigger>
        </TabsList>

        {/* 评测集管理 */}
        <TabsContent value="evaluations">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>评测数据集</CardTitle>
                  <CardDescription>管理AI功能评测的数据集</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    导入
                  </Button>
                  <Button onClick={() => setEvalSetDialog({} as EvaluationSet)}>
                    <Plus className="h-4 w-4 mr-2" />
                    新建评测集
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ListStateBlock state="loading" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>评测集名称</TableHead>
                      <TableHead>文档类型</TableHead>
                      <TableHead>样本数量</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluationSets.length === 0 ? (
                      <ListStateBlock state="empty" emptyText="暂无评测集" />
                    ) : (
                      evaluationSets.map((set) => (
                        <TableRow key={set.id}>
                          <TableCell className="font-medium">{set.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{set.documentType}</Badge>
                          </TableCell>
                          <TableCell>{set.sampleCount} 个</TableCell>
                          <TableCell>{getStatusBadge(set.status)}</TableCell>
                          <TableCell>
                            {new Date(set.createdAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => runRegressionTest(set.id)}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              运行
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 回归测试 */}
        <TabsContent value="regression">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>回归测试记录</CardTitle>
                  <CardDescription>查看历史回归测试结果</CardDescription>
                </div>
                <Button variant="outline" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ListStateBlock state="loading" />
              ) : regressionTests.length === 0 ? (
                <ListStateBlock state="empty" emptyText="暂无回归测试记录" />
              ) : (
                <div className="space-y-4">
                  {regressionTests.map((test) => (
                    <Card key={test.id} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              test.status === 'completed'
                                ? 'bg-green-100'
                                : test.status === 'running'
                                  ? 'bg-blue-100'
                                  : 'bg-red-100'
                            }`}
                          >
                            {test.status === 'completed' && (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            )}
                            {test.status === 'running' && (
                              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                            )}
                            {test.status === 'failed' && (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{test.setName}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(test.createdAt).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(test.status)}
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">{test.totalSamples}</p>
                          <p className="text-xs text-muted-foreground">总样本</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">{test.passedSamples}</p>
                          <p className="text-xs text-muted-foreground">通过</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-red-600">{test.failedSamples}</p>
                          <p className="text-xs text-muted-foreground">失败</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{(test.accuracy * 100).toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">准确率</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">准确率</span>
                          <span className="text-xs font-medium">
                            {(test.accuracy * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={test.accuracy * 100} className="h-2" />
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          耗时: {test.duration}ms
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewTestDetail(test.id)}
                            disabled={detailLoading}
                          >
                            查看详情
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewCaseResults(test.id)}
                          >
                            用例结果
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 质量指标 */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>AI 质量指标监控</CardTitle>
              <CardDescription>追踪AI功能的关键质量指标</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ListStateBlock state="loading" />
              ) : (
                <div className="space-y-4">
                  {metrics.map((metric) => (
                    <div
                      key={metric.metricName}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-2 rounded-full ${
                            metric.trend === 'up'
                              ? 'bg-green-100'
                              : metric.trend === 'down'
                                ? 'bg-red-100'
                                : 'bg-gray-100'
                          }`}
                        >
                          {metric.trend === 'up' && (
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          )}
                          {metric.trend === 'down' && (
                            <TrendingDown className="h-5 w-5 text-red-600" />
                          )}
                          {metric.trend === 'stable' && <Minus className="h-5 w-5 text-gray-400" />}
                        </div>
                        <div>
                          <p className="font-medium">{metric.metricName}</p>
                          <p className="text-sm text-muted-foreground">
                            上期: {metric.previousValue.toFixed(1)} {metric.unit}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{metric.currentValue.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">{metric.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI日志查询 */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI调用日志</CardTitle>
                  <CardDescription>查看AI功能调用记录与详情</CardDescription>
                </div>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  导出日志
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* 搜索筛选 */}
              <div className="flex flex-wrap gap-4 mb-6">
                <Input placeholder="搜索请求ID、用户..." className="w-[250px]" />
                <Select defaultValue="all">
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="功能类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="document_parse">文档解析</SelectItem>
                    <SelectItem value="content_generate">内容生成</SelectItem>
                    <SelectItem value="review">智能审校</SelectItem>
                    <SelectItem value="knowledge">知识推荐</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="调用状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="success">成功</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                    <SelectItem value="timeout">超时</SelectItem>
                  </SelectContent>
                </Select>
                <Button>搜索</Button>
              </div>

              {/* 日志列表 */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>请求ID</TableHead>
                    <TableHead>功能类型</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>模型</TableHead>
                    <TableHead>耗时</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">req_a1b2c3d4</TableCell>
                    <TableCell>
                      <Badge variant="outline">内容生成</Badge>
                    </TableCell>
                    <TableCell>张三</TableCell>
                    <TableCell>doubao-pro-32k</TableCell>
                    <TableCell>2.3s</TableCell>
                    <TableCell>1,234 / 567</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">成功</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      2024-03-18 14:32:15
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">req_e5f6g7h8</TableCell>
                    <TableCell>
                      <Badge variant="outline">智能审校</Badge>
                    </TableCell>
                    <TableCell>李四</TableCell>
                    <TableCell>doubao-pro-32k</TableCell>
                    <TableCell>1.8s</TableCell>
                    <TableCell>2,456 / 890</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">成功</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      2024-03-18 14:28:42
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">req_i9j0k1l2</TableCell>
                    <TableCell>
                      <Badge variant="outline">文档解析</Badge>
                    </TableCell>
                    <TableCell>王五</TableCell>
                    <TableCell>doubao-vision</TableCell>
                    <TableCell>5.2s</TableCell>
                    <TableCell>3,789 / 1,234</TableCell>
                    <TableCell>
                      <Badge className="bg-red-100 text-red-800">失败</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      2024-03-18 14:15:30
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">req_m3n4o5p6</TableCell>
                    <TableCell>
                      <Badge variant="outline">知识推荐</Badge>
                    </TableCell>
                    <TableCell>赵六</TableCell>
                    <TableCell>text-embedding</TableCell>
                    <TableCell>0.5s</TableCell>
                    <TableCell>512 / -</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">成功</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      2024-03-18 13:45:18
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* 分页 */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">显示 1-20 条，共 156 条记录</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    上一页
                  </Button>
                  <Button variant="outline" size="sm">
                    下一页
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 新建评测集弹窗 */}
      <Dialog open={!!evalSetDialog} onOpenChange={() => setEvalSetDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建评测集</DialogTitle>
            <DialogDescription>创建用于AI功能评测的数据集</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="evalName">评测集名称</Label>
              <Input id="evalName" placeholder="例如: 技术方案审校评测集" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentType">文档类型</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择文档类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">技术方案</SelectItem>
                  <SelectItem value="business">商务标书</SelectItem>
                  <SelectItem value="contract">合同文档</SelectItem>
                  <SelectItem value="proposal">投标建议书</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea id="description" placeholder="评测集用途说明..." rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEvalSetDialog(null)}>
              取消
            </Button>
            <Button onClick={() => createEvaluationSet(evalSetDialog as any)} disabled={submitting}>
              {submitting ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 测试详情弹窗 */}
      <Dialog open={!!testDetailDialog} onOpenChange={() => setTestDetailDialog(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>测试运行详情</DialogTitle>
            <DialogDescription>查看测试运行的完整信息与用例结果</DialogDescription>
          </DialogHeader>

          {testDetailDialog && (
            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">评测集</p>
                  <p className="font-medium">{testDetailDialog.evaluationSet?.name || '未知'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">模型</p>
                  <p className="font-medium">{testDetailDialog.modelId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">状态</p>
                  {getStatusBadge(testDetailDialog.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">创建时间</p>
                  <p className="font-medium">
                    {new Date(testDetailDialog.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-4 gap-4 text-center p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-2xl font-bold">{testDetailDialog.totalCases}</p>
                  <p className="text-xs text-muted-foreground">总用例</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {testDetailDialog.passedCases}
                  </p>
                  <p className="text-xs text-muted-foreground">通过</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{testDetailDialog.failedCases}</p>
                  <p className="text-xs text-muted-foreground">失败</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {testDetailDialog.avgScore?.toFixed(1) || '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">平均分</p>
                </div>
              </div>

              {/* 用例结果列表 */}
              <div>
                <h4 className="font-medium mb-3">用例结果</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用例编号</TableHead>
                      <TableHead>得分</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>耗时</TableHead>
                      <TableHead>Tokens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testDetailDialog.caseResults.length === 0 ? (
                      <ListStateBlock state="empty" emptyText="暂无用例结果" />
                    ) : (
                      testDetailDialog.caseResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell className="font-mono text-xs">{result.caseCode}</TableCell>
                          <TableCell>
                            <span className={result.passed ? 'text-green-600' : 'text-red-600'}>
                              {result.score ?? '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {result.passed ? (
                              <Badge className="bg-green-100 text-green-800">通过</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">失败</Badge>
                            )}
                          </TableCell>
                          <TableCell>{result.latency ? `${result.latency}ms` : '-'}</TableCell>
                          <TableCell>
                            {result.tokenInput && result.tokenOutput
                              ? `${result.tokenInput}/${result.tokenOutput}`
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDetailDialog(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 用例结果弹窗 */}
      <Dialog open={!!caseResultsDialog} onOpenChange={() => setCaseResultsDialog(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>用例详细结果</DialogTitle>
            <DialogDescription>查看每个测试用例的输入输出详情</DialogDescription>
          </DialogHeader>

          {caseResultsDialog && (
            <div className="space-y-4 py-4">
              {caseResultsDialog.length === 0 ? (
                <ListStateBlock state="empty" emptyText="暂无用例结果" />
              ) : (
                caseResultsDialog.map((result) => (
                  <Card key={result.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{result.caseCode}</span>
                        {result.passed ? (
                          <Badge className="bg-green-100 text-green-800">通过</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">失败</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {result.score !== null && <span>得分: {result.score}</span>}
                        {result.latency !== null && <span>耗时: {result.latency}ms</span>}
                      </div>
                    </div>

                    {result.errorMessage && (
                      <div className="mb-3 p-2 bg-red-50 text-red-800 rounded text-sm">
                        错误: {result.errorMessage}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">输入</p>
                        <div className="p-3 bg-muted/50 rounded text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {result.input}
                        </div>
                      </div>

                      {result.expectedOutput && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">预期输出</p>
                          <div className="p-3 bg-blue-50 rounded text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {result.expectedOutput}
                          </div>
                        </div>
                      )}

                      {result.actualOutput && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">实际输出</p>
                          <div className="p-3 bg-muted/50 rounded text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {result.actualOutput}
                          </div>
                        </div>
                      )}
                    </div>

                    {(result.tokenInput || result.tokenOutput) && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Tokens: 输入 {result.tokenInput || 0} / 输出 {result.tokenOutput || 0}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCaseResultsDialog(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

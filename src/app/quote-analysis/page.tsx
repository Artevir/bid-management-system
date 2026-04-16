'use client';

import { useState, useEffect } from 'react';
import _Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input as _Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ListStateBlock } from '@/components/ui/list-states';
import { Progress } from '@/components/ui/progress';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select as _Select,
  SelectContent as _SelectContent,
  SelectItem as _SelectItem,
  SelectTrigger as _SelectTrigger,
  SelectValue as _SelectValue,
} from '@/components/ui/select';
import {
  Calculator,
  TrendingUp,
  Users as _Users,
  Target,
  DollarSign as _DollarSign,
  BarChart3 as _BarChart3,
  Lightbulb as _Lightbulb,
  BrainCircuit,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  RefreshCw,
  Eye,
  Play,
  LineChart,
  AlertCircle,
} from 'lucide-react';

interface QuoteAnalysisRequest {
  id: number;
  projectName: string;
  industry: string | null;
  region: string | null;
  budget: string | null;
  strategy: string;
  status: string;
  suggestedQuote: string | null;
  confidenceLevel: number | null;
  createdAt: string;
}

interface QuoteScheme {
  id: number;
  requestId: number;
  schemeName: string;
  quotePrice: string;
  winProbability: number;
  profitMargin: number;
  riskLevel: string;
  isAdopted: boolean;
}

export default function QuoteAnalysisPage() {
  const _router = useRouter();
  const [requests, setRequests] = useState<QuoteAnalysisRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<QuoteAnalysisRequest | null>(null);
  const [schemes, setSchemes] = useState<QuoteScheme[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch('/api/quote-analysis');
      const data = await res.json();
      setRequests(data.data || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSchemes(requestId: number) {
    try {
      const res = await fetch(`/api/quote-analysis/${requestId}`);
      const data = await res.json();
      setSchemes(data.schemes || []);
    } catch (error) {
      console.error('Failed to fetch schemes:', error);
    }
  }

  async function runAnalysis(requestId: number) {
    setAnalyzing(true);
    try {
      const _res = await fetch(`/api/quote-analysis/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'analyzing' }),
      });
      // 模拟分析过程
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchRequests();
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  }

  async function adoptScheme(schemeId: number) {
    try {
      await fetch(`/api/quote-analysis/schemes/${schemeId}/adopt`, {
        method: 'POST',
      });
      if (selectedRequest) {
        fetchSchemes(selectedRequest.id);
      }
    } catch (error) {
      console.error('Failed to adopt scheme:', error);
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      {
        label: string;
        variant: 'default' | 'secondary' | 'destructive' | 'outline';
        icon: React.ElementType;
      }
    > = {
      pending: { label: '待分析', variant: 'outline', icon: Clock },
      analyzing: { label: '分析中', variant: 'default', icon: BrainCircuit },
      completed: { label: '已完成', variant: 'secondary', icon: CheckCircle },
      failed: { label: '分析失败', variant: 'destructive', icon: XCircle },
    };
    const config = statusMap[status] || { label: status, variant: 'outline', icon: AlertCircle };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getStrategyLabel = (strategy: string) => {
    const strategyMap: Record<string, { label: string; color: string }> = {
      aggressive: { label: '激进型', color: 'text-red-500' },
      balanced: { label: '平衡型', color: 'text-blue-500' },
      conservative: { label: '保守型', color: 'text-green-500' },
    };
    const config = strategyMap[strategy] || { label: strategy, color: 'text-gray-500' };
    return <span className={config.color}>{config.label}</span>;
  };

  const getRiskLevelBadge = (level: string) => {
    const levelMap: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' }
    > = {
      low: { label: '低风险', variant: 'default' },
      medium: { label: '中风险', variant: 'secondary' },
      high: { label: '高风险', variant: 'destructive' },
    };
    const config = levelMap[level] || { label: level, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleViewDetail = (request: QuoteAnalysisRequest) => {
    setSelectedRequest(request);
    fetchSchemes(request.id);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">智能报价建议</h1>
          <p className="text-muted-foreground">基于AI分析的智能报价决策支持</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRequests}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建分析
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calculator className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{requests.length}</p>
                <p className="text-sm text-muted-foreground">分析请求</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {requests.filter((r) => r.status === 'completed').length}
                </p>
                <p className="text-sm text-muted-foreground">已完成分析</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{schemes.filter((s) => s.isAdopted).length}</p>
                <p className="text-sm text-muted-foreground">已采纳方案</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(
                    requests
                      .filter((r) => r.confidenceLevel)
                      .reduce((sum, r) => sum + (r.confidenceLevel || 0), 0) /
                      Math.max(requests.filter((r) => r.confidenceLevel).length, 1)
                  )}
                  %
                </p>
                <p className="text-sm text-muted-foreground">平均置信度</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 分析请求列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            分析请求
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ListStateBlock state="loading" />
          ) : requests.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无分析请求" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>行业</TableHead>
                  <TableHead>地区</TableHead>
                  <TableHead>报价策略</TableHead>
                  <TableHead>建议报价</TableHead>
                  <TableHead>置信度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <p className="font-medium">{request.projectName}</p>
                    </TableCell>
                    <TableCell>{request.industry || '-'}</TableCell>
                    <TableCell>{request.region || '-'}</TableCell>
                    <TableCell>{getStrategyLabel(request.strategy)}</TableCell>
                    <TableCell>
                      {request.suggestedQuote ? (
                        <span className="text-green-600 font-medium">
                          ¥{request.suggestedQuote}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {request.confidenceLevel !== null ? (
                        <div className="flex items-center gap-2">
                          <Progress value={request.confidenceLevel} className="w-16" />
                          <span className="text-sm">{request.confidenceLevel}%</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetail(request)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {request.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => runAnalysis(request.id)}
                            disabled={analyzing}
                          >
                            <Play className="h-4 w-4" />
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

      {/* 详情弹窗 */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedRequest?.projectName}</DialogTitle>
            <DialogDescription>报价分析详情</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">行业</p>
                  <p className="font-medium">{selectedRequest.industry || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">地区</p>
                  <p className="font-medium">{selectedRequest.region || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">预算</p>
                  <p className="font-medium">{selectedRequest.budget || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">策略</p>
                  {getStrategyLabel(selectedRequest.strategy)}
                </div>
              </div>

              {/* 建议报价 */}
              {selectedRequest.suggestedQuote && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">AI建议报价</p>
                      <p className="text-2xl font-bold text-green-600">
                        ¥{selectedRequest.suggestedQuote}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">置信度</p>
                      <p className="text-xl font-bold">{selectedRequest.confidenceLevel}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 报价方案 */}
              {schemes.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">报价方案</p>
                  <div className="space-y-3">
                    {schemes.map((scheme) => (
                      <div
                        key={scheme.id}
                        className={`p-4 rounded-lg border ${
                          scheme.isAdopted
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{scheme.schemeName}</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">
                              ¥{scheme.quotePrice}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">中标概率:</span>
                              <span className="font-medium">{scheme.winProbability}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">利润率:</span>
                              <span className="font-medium">{scheme.profitMargin}%</span>
                            </div>
                            <div>{getRiskLevelBadge(scheme.riskLevel)}</div>
                          </div>
                        </div>
                        {!scheme.isAdopted && (
                          <div className="mt-3 flex justify-end">
                            <Button size="sm" onClick={() => adoptScheme(scheme.id)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              采纳此方案
                            </Button>
                          </div>
                        )}
                        {scheme.isAdopted && (
                          <div className="mt-3 flex justify-end">
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              已采纳
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  关闭
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

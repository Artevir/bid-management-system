'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3 as _BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Cpu as _Cpu,
  MessageSquare,
  Settings,
  RefreshCw,
  Calendar,
} from 'lucide-react';

// 统计数据接口
interface OverviewStats {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgLatency: number;
}

interface DailyStat {
  date: string;
  calls: number;
  successCalls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
  avgLatency: number;
}

interface ModelStat {
  modelId: string;
  provider: string;
  calls: number;
  successCalls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
  avgLatency: number;
}

interface RecentCall {
  id: number;
  configId: number | null;
  configName: string | null;
  modelId: string;
  provider: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latency: number | null;
  firstTokenLatency: number | null;
  status: string;
  errorMessage: string | null;
  callContext: any;
  createdAt: string;
}

interface Config {
  id: number;
  name: string;
  provider: string;
  modelId: string;
}

// 提供商配置
const providerConfig: Record<string, { label: string; color: string }> = {
  doubao: { label: '豆包', color: 'bg-blue-100 text-blue-700' },
  deepseek: { label: 'DeepSeek', color: 'bg-purple-100 text-purple-700' },
  qwen: { label: '千问', color: 'bg-orange-100 text-orange-700' },
  openai: { label: 'OpenAI', color: 'bg-green-100 text-green-700' },
  kimi: { label: 'Kimi', color: 'bg-cyan-100 text-cyan-700' },
  glm: { label: 'GLM', color: 'bg-pink-100 text-pink-700' },
  custom: { label: '自定义', color: 'bg-gray-100 text-gray-700' },
};

// 日期范围选项
const dateRangeOptions = [
  { value: '7', label: '最近7天' },
  { value: '14', label: '最近14天' },
  { value: '30', label: '最近30天' },
  { value: '90', label: '最近90天' },
];

export default function LLMUsagePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configs, setConfigs] = useState<Config[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>('all');
  const [dateRange, setDateRange] = useState('7');

  // 统计数据
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [modelStats, setModelStats] = useState<ModelStat[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    loadStats();
  }, [selectedConfig, dateRange]);

  const loadConfigs = async () => {
    try {
      const res = await fetch('/api/llm/configs');
      const data = await res.json();
      if (data.configs) {
        setConfigs(data.configs);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    }
  };

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('days', dateRange);
      if (selectedConfig !== 'all') {
        params.append('configId', selectedConfig);
      }

      // 并行请求
      const [overviewRes, dailyRes, modelsRes, recentRes] = await Promise.all([
        fetch(`/api/llm/usage?${params.toString()}`),
        fetch(`/api/llm/usage?${params.toString()}&type=daily`),
        fetch(`/api/llm/usage?${params.toString()}&type=models`),
        fetch(`/api/llm/usage?${params.toString()}&type=recent`),
      ]);

      const [overviewData, dailyData, modelsData, recentData] = await Promise.all([
        overviewRes.json(),
        dailyRes.json(),
        modelsRes.json(),
        recentRes.json(),
      ]);

      setOverview(overviewData.overview);
      setDailyStats(dailyData.daily || []);
      setModelStats(modelsData.models || []);
      setRecentCalls(recentData.calls || []);
    } catch (error) {
      console.error('加载统计数据失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatLatency = (ms: number) => {
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
    return ms.toFixed(0) + 'ms';
  };

  const successRate = overview
    ? overview.totalCalls > 0
      ? ((overview.successCalls / overview.totalCalls) * 100).toFixed(1)
      : '0'
    : '0';

  // 计算每日趋势
  const getDailyTrend = () => {
    if (dailyStats.length < 2) return null;
    const lastTwo = dailyStats.slice(-2);
    const prev = lastTwo[0].calls;
    const curr = lastTwo[1].calls;
    if (prev === 0) return null;
    const change = ((curr - prev) / prev) * 100;
    return change;
  };

  const trend = getDailyTrend();

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">模型用量统计</h1>
          <p className="text-muted-foreground mt-1">查看LLM模型调用统计、Token使用量、费用分析</p>
        </div>
        <div className="flex gap-2">
          <Link href="/llm">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              模型配置
            </Button>
          </Link>
          <Link href="/llm/chat">
            <Button variant="outline">
              <MessageSquare className="h-4 w-4 mr-2" />
              对话测试
            </Button>
          </Link>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateRangeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={selectedConfig} onValueChange={setSelectedConfig}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="全部配置" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部配置</SelectItem>
                {configs.map((config) => (
                  <SelectItem key={config.id} value={config.id.toString()}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadStats}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">总调用次数</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : formatNumber(overview?.totalCalls || 0)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-green-600">
                成功: {formatNumber(overview?.successCalls || 0)}
              </span>
              <span className="text-red-600">失败: {formatNumber(overview?.failedCalls || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Token使用量</CardTitle>
            <Zap className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : formatNumber(overview?.totalTokens || 0)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>输入: {formatNumber(overview?.totalInputTokens || 0)}</span>
              <span>输出: {formatNumber(overview?.totalOutputTokens || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">成功率</CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : successRate}%</div>
            <div className="mt-2">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${successRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">平均延迟</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : formatLatency(overview?.avgLatency || 0)}
            </div>
            {trend !== null && (
              <div
                className={`flex items-center gap-1 mt-1 text-xs ${
                  trend > 0 ? 'text-red-500' : trend < 0 ? 'text-green-500' : 'text-gray-500'
                }`}
              >
                {trend > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trend < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span>
                  {trend > 0 ? '+' : ''}
                  {trend.toFixed(1)}% 调用量变化
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 每日趋势和模型统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 每日调用趋势 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">每日调用趋势</CardTitle>
            <CardDescription>最近{dateRange}天的调用统计</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <ListStateBlock
                state="error"
                error={error}
                onRetry={() => window.location.reload()}
              />
            ) : loading ? (
              <ListStateBlock state="loading" />
            ) : dailyStats.length === 0 ? (
              <ListStateBlock state="empty" emptyText="暂无数据" />
            ) : (
              <div className="space-y-2">
                {dailyStats.slice(-7).map((day) => {
                  const maxCalls = Math.max(...dailyStats.map((d) => d.calls));
                  const width = maxCalls > 0 ? (day.calls / maxCalls) * 100 : 0;
                  return (
                    <div key={day.date} className="flex items-center gap-3">
                      <div className="w-20 text-sm text-gray-500">{day.date}</div>
                      <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500 flex items-center justify-end px-2"
                          style={{ width: `${Math.max(width, 5)}%` }}
                        >
                          <span className="text-xs text-white font-medium">{day.calls}</span>
                        </div>
                      </div>
                      <div className="w-24 text-xs text-gray-500 text-right">
                        {formatNumber(day.inputTokens + day.outputTokens)} tokens
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 模型使用排行 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">模型使用排行</CardTitle>
            <CardDescription>按调用量排序</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListStateBlock state="loading" />
            ) : modelStats.length === 0 ? (
              <ListStateBlock state="empty" emptyText="暂无数据" />
            ) : (
              <div className="space-y-3">
                {modelStats.slice(0, 5).map((model, index) => (
                  <div
                    key={model.modelId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{model.modelId}</span>
                        <Badge
                          variant="outline"
                          className={providerConfig[model.provider]?.color || ''}
                        >
                          {providerConfig[model.provider]?.label || model.provider}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{formatNumber(model.calls)} 次调用</span>
                        <span>{formatNumber(model.inputTokens + model.outputTokens)} tokens</span>
                        <span>延迟 {formatLatency(model.avgLatency)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-600">
                        {model.calls > 0
                          ? ((model.successCalls / model.calls) * 100).toFixed(0)
                          : '0'}
                        %
                      </div>
                      <div className="text-xs text-gray-400">成功率</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 最近调用记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近调用记录</CardTitle>
          <CardDescription>最新的50条API调用</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ListStateBlock state="loading" />
          ) : recentCalls.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无调用记录" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>配置</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>延迟</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCalls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="text-sm">
                      {new Date(call.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {call.configName || <span className="text-gray-400">未知配置</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{call.modelId}</span>
                        <Badge
                          variant="outline"
                          className={providerConfig[call.provider]?.color || ''}
                        >
                          {providerConfig[call.provider]?.label || call.provider}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-gray-500">{call.inputTokens || 0}</span>
                      {' / '}
                      <span className="text-blue-600">{call.outputTokens || 0}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {call.latency ? formatLatency(call.latency) : '-'}
                    </TableCell>
                    <TableCell>
                      {call.status === 'success' ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          成功
                        </Badge>
                      ) : call.status === 'failed' ? (
                        <Badge className="bg-red-100 text-red-700">
                          <XCircle className="h-3 w-3 mr-1" />
                          失败
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {call.status}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

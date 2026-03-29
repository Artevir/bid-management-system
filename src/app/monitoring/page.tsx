'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Activity,
  Database,
  HardDrive,
  Cpu,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown as _TrendingDown,
  Clock,
  Zap,
  Trash2,
} from 'lucide-react';

interface HealthCheck {
  status: 'healthy' | 'warning' | 'unhealthy';
  latency?: number;
  value?: number | string;
  error?: string;
}

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: Record<string, HealthCheck>;
  metrics: {
    memory: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
      external: number;
      usedRatio: number;
    };
    cache: {
      size: number;
      maxSize: number;
      hits: number;
      misses: number;
    };
    performance: {
      responseTime: number;
      avgResponseTime: number;
    };
  };
  alerts?: Array<{
    level: string;
    component: string;
    message: string;
    suggestion: string;
    timestamp: string;
  }>;
  recommendations?: string[];
}

export default function MonitoringPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchHealthData();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchHealthData, 30000); // 30秒刷新一次
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  async function fetchHealthData() {
    setRefreshing(true);
    try {
      const response = await fetch('/api/health/enhanced');
      const data = await response.json();
      setHealthData(data);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function clearCache() {
    try {
      const response = await fetch('/api/health/enhanced?action=clear-cache', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        fetchHealthData();
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}天 ${hours}小时 ${mins}分钟`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500">健康</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">警告</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">异常</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">系统监控</h1>
          <p className="text-muted-foreground">实时监控系统健康状态和性能指标</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '停止自动刷新' : '开启自动刷新'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchHealthData} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 告警信息 */}
      {healthData?.alerts && healthData.alerts.length > 0 && (
        <div className="space-y-2">
          {healthData.alerts.map((alert, index) => (
            <Alert
              key={index}
              variant={alert.level === 'critical' ? 'destructive' : 'default'}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                {alert.component} - {alert.level === 'critical' ? '严重' : '警告'}
              </AlertTitle>
              <AlertDescription>
                <p>{alert.message}</p>
                <p className="text-sm text-muted-foreground mt-1">建议: {alert.suggestion}</p>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* 系统状态概览 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">系统状态</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(healthData?.status || 'unknown')}
                  <span className="text-xl font-bold capitalize">{healthData?.status}</span>
                </div>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">运行时间</p>
                <p className="text-xl font-bold">{formatUptime(healthData?.uptime || 0)}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">内存使用</p>
                <p className="text-xl font-bold">
                  {healthData?.metrics.memory.heapUsed} / {healthData?.metrics.memory.heapTotal} MB
                </p>
                <Progress
                  value={(healthData?.metrics.memory.usedRatio || 0) * 100}
                  className="mt-2 h-2"
                />
              </div>
              <Cpu className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">响应时间</p>
                <p className="text-xl font-bold">{healthData?.metrics.performance.responseTime}ms</p>
                <p className="text-xs text-muted-foreground mt-1">
                  平均: {healthData?.metrics.performance.avgResponseTime}ms
                </p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 健康检查详情 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 服务检查 */}
        <Card>
          <CardHeader>
            <CardTitle>服务检查</CardTitle>
            <CardDescription>各组件健康状态</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {healthData?.checks && Object.entries(healthData.checks).map(([name, check]) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {name === 'database' && <Database className="h-5 w-5" />}
                    {name === 'cache' && <HardDrive className="h-5 w-5" />}
                    {name === 'memory' && <Cpu className="h-5 w-5" />}
                    {name === 'filesystem' && <HardDrive className="h-5 w-5" />}
                    <div>
                      <p className="font-medium capitalize">{name}</p>
                      {check.error && (
                        <p className="text-xs text-destructive">{check.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {check.latency !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        {check.latency}ms
                      </span>
                    )}
                    {getStatusBadge(check.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 缓存状态 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>缓存状态</CardTitle>
                <CardDescription>缓存使用情况和命中率</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={clearCache}>
                <Trash2 className="mr-2 h-4 w-4" />
                清除缓存
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">缓存大小</p>
                  <p className="text-2xl font-bold">
                    {healthData?.metrics.cache.size} / {healthData?.metrics.cache.maxSize}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">命中率</p>
                  <p className="text-2xl font-bold">
                    {(healthData?.metrics.cache.hits ?? 0) + (healthData?.metrics.cache.misses ?? 0) > 0
                      ? (((healthData?.metrics.cache.hits ?? 0) / ((healthData?.metrics.cache.hits ?? 0) + (healthData?.metrics.cache.misses ?? 0))) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">命中次数</span>
                  <span className="font-medium text-green-600">{healthData?.metrics.cache.hits ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">未命中次数</span>
                  <span className="font-medium text-orange-600">{healthData?.metrics.cache.misses ?? 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 优化建议 */}
      {healthData?.recommendations && healthData.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>优化建议</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {healthData.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 系统信息 */}
      <Card>
        <CardHeader>
          <CardTitle>系统信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">版本</p>
              <p className="font-medium">{healthData?.version}</p>
            </div>
            <div>
              <p className="text-muted-foreground">环境</p>
              <p className="font-medium">{healthData?.environment}</p>
            </div>
            <div>
              <p className="text-muted-foreground">RSS 内存</p>
              <p className="font-medium">{healthData?.metrics.memory.rss} MB</p>
            </div>
            <div>
              <p className="text-muted-foreground">外部内存</p>
              <p className="font-medium">{healthData?.metrics.memory.external} MB</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input as _Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select as _Select,
  SelectContent as _SelectContent,
  SelectItem as _SelectItem,
  SelectTrigger as _SelectTrigger,
  SelectValue as _SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Globe,
  Building2,
  Factory,
  Settings,
  Play,
  Pause,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Trash2,
  Eye as _Eye,
  Edit,
  Zap,
} from 'lucide-react';

interface CrawlSource {
  id: number;
  name: string;
  code: string;
  type: 'government' | 'enterprise' | 'industry' | 'custom';
  baseUrl: string;
  listUrl: string | null;
  isActive: boolean;
  scheduleType: string;
  lastCrawlAt: string | null;
  lastCrawlStatus: string | null;
  lastCrawlCount: number | null;
  totalCrawls: number | null;
  totalItems: number | null;
  createdAt: string;
  crawlConfig?: string;
}

interface PlatformStats {
  total: number;
  totalWithWebsite: number;
  byType: Record<string, { count: number; withWebsite: number }>;
  typeLabels: Record<string, string>;
}

const TYPE_LABELS: Record<string, string> = {
  government: '政府采购网',
  enterprise: '企业招标平台',
  industry: '行业网站',
  custom: '自定义网站',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  government: <Globe className="h-4 w-4" />,
  enterprise: <Building2 className="h-4 w-4" />,
  industry: <Factory className="h-4 w-4" />,
  custom: <Settings className="h-4 w-4" />,
};

export default function CrawlSourcesPage() {
  const _router = useRouter();
  const [sources, setSources] = useState<CrawlSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  
  // 导入选项
  const [importOptions, setImportOptions] = useState({
    force: false,
    platformTypes: [] as string[],
  });

  useEffect(() => {
    fetchSources();
    fetchPlatformStats();
  }, []);

  async function fetchSources() {
    setLoading(true);
    try {
      const res = await fetch('/api/tender-crawl/sources');
      const data = await res.json();
      setSources(data.data || []);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlatformStats() {
    try {
      const res = await fetch('/api/tender-crawl/sources/init-from-platforms');
      const data = await res.json();
      if (data.success) {
        setPlatformStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch platform stats:', error);
    }
  }

  async function handleImportFromPlatforms() {
    setImporting(true);
    try {
      const res = await fetch('/api/tender-crawl/sources/init-from-platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importOptions),
      });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        fetchSources();
        fetchPlatformStats();
        setImportDialogOpen(false);
      } else {
        alert('导入失败：' + data.error);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('导入失败');
    } finally {
      setImporting(false);
    }
  }

  async function handleToggleActive(source: CrawlSource) {
    try {
      const res = await fetch(`/api/tender-crawl/sources/${source.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !source.isActive }),
      });
      
      if (res.ok) {
        fetchSources();
      }
    } catch (error) {
      console.error('Failed to toggle source:', error);
    }
  }

  async function handleDelete(source: CrawlSource) {
    if (!confirm(`确定要删除抓取源"${source.name}"吗？`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/tender-crawl/sources/${source.id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        fetchSources();
      }
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">未运行</Badge>;
    
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      success: { label: '成功', variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      failed: { label: '失败', variant: 'destructive', icon: <XCircle className="h-3 w-3 mr-1" /> },
      running: { label: '运行中', variant: 'secondary', icon: <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> },
      partial: { label: '部分成功', variant: 'outline', icon: <AlertCircle className="h-3 w-3 mr-1" /> },
    };
    
    const config = statusMap[status] || { label: status, variant: 'outline', icon: null };
    return (
      <Badge variant={config.variant} className="flex items-center">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/tender-crawl">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">抓取源管理</h1>
            <p className="text-muted-foreground">管理招标信息抓取源</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSources}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                从政采单位导入
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>从政采单位导入信息源</DialogTitle>
                <DialogDescription>
                  将已收集的政府采购单位、交易中心、招标代理公司导入为信息源
                </DialogDescription>
              </DialogHeader>
              
              {platformStats && (
                <div className="space-y-4">
                  {/* 统计信息 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm text-muted-foreground">政采单位总数</p>
                      <p className="text-2xl font-bold">{platformStats.total}</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm text-muted-foreground">可导入数量</p>
                      <p className="text-2xl font-bold text-green-600">{platformStats.totalWithWebsite}</p>
                      <p className="text-xs text-muted-foreground">有网站的单位</p>
                    </div>
                  </div>
                  
                  {/* 按类型统计 */}
                  <div className="space-y-2">
                    <Label>选择要导入的类型</Label>
                    {Object.entries(platformStats.byType).map(([type, stats]) => (
                      <div key={type} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`type-${type}`}
                            checked={importOptions.platformTypes.includes(type)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setImportOptions(prev => ({
                                  ...prev,
                                  platformTypes: [...prev.platformTypes, type],
                                }));
                              } else {
                                setImportOptions(prev => ({
                                  ...prev,
                                  platformTypes: prev.platformTypes.filter(t => t !== type),
                                }));
                              }
                            }}
                          />
                          <Label htmlFor={`type-${type}`} className="cursor-pointer">
                            {type}
                          </Label>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {stats.withWebsite}/{stats.count} 可导入
                        </div>
                      </div>
                    ))}
                    {importOptions.platformTypes.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        不选择则导入全部可导入的单位
                      </p>
                    )}
                  </div>
                  
                  {/* 强制覆盖选项 */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="force"
                      checked={importOptions.force}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, force: !!checked }))
                      }
                    />
                    <Label htmlFor="force" className="cursor-pointer">
                      强制覆盖已存在的抓取源
                    </Label>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleImportFromPlatforms} disabled={importing}>
                  {importing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      开始导入
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新增抓取源
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{sources.length}</p>
                <p className="text-sm text-muted-foreground">抓取源总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{sources.filter(s => s.isActive).length}</p>
                <p className="text-sm text-muted-foreground">已启用</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {sources.filter(s => s.scheduleType !== 'manual').length}
                </p>
                <p className="text-sm text-muted-foreground">定时任务</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {sources.reduce((sum, s) => sum + (s.totalItems || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">累计抓取</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 抓取源列表 */}
      <Card>
        <CardHeader>
          <CardTitle>抓取源列表</CardTitle>
          <CardDescription>
            点击"从政采单位导入"可快速导入广西政府采购单位、交易中心和招标代理公司作为信息源
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无抓取源</p>
              <p className="text-sm mt-2">点击"从政采单位导入"快速添加默认信息源</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>网站地址</TableHead>
                  <TableHead>调度方式</TableHead>
                  <TableHead>最后状态</TableHead>
                  <TableHead>累计抓取</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-xs text-muted-foreground">{source.code}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {TYPE_ICONS[source.type]}
                        {TYPE_LABELS[source.type] || source.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <a 
                        href={source.baseUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-[200px] block"
                      >
                        {source.baseUrl}
                      </a>
                    </TableCell>
                    <TableCell>
                      {source.scheduleType === 'manual' ? (
                        <Badge variant="secondary">手动</Badge>
                      ) : source.scheduleType === 'cron' ? (
                        <Badge variant="outline">定时</Badge>
                      ) : (
                        <Badge variant="outline">间隔</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(source.lastCrawlStatus)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{source.totalItems || 0}</span>
                      <span className="text-muted-foreground text-sm"> 条</span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(source)}
                      >
                        {source.isActive ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Pause className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(source)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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

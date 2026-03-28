'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Calendar,
  Building2,
  MapPin,
  Plus,
  Filter,
  Download,
  Eye,
  Globe,
  Zap,
} from 'lucide-react';

interface TenderInfo {
  id: number;
  title: string;
  sourceUrl: string;
  summary: string | null;
  publishDate: string | null;
  deadline: string | null;
  region: string | null;
  industry: string | null;
  budget: string | null;
  status: string;
  createdAt: string;
}

interface CrawlSource {
  id: number;
  name: string;
  type: string;
  url: string;
  isActive: boolean;
  lastCrawledAt: string | null;
}

export default function TenderCrawlPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<TenderInfo[]>([]);
  const [sources, setSources] = useState<CrawlSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [selectedTender, setSelectedTender] = useState<TenderInfo | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [tendersRes, sourcesRes] = await Promise.all([
        fetch('/api/tender-crawl/tenders'),
        fetch('/api/tender-crawl/sources'),
      ]);
      const tendersData = await tendersRes.json();
      const sourcesData = await sourcesRes.json();
      setTenders(tendersData.data || []);
      setSources(sourcesData.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    
    setCrawling(true);
    try {
      const res = await fetch('/api/tender-crawl/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query: searchQuery }),
      });
      const data = await res.json();
      if (data.data) {
        setTenders(prev => [...data.data, ...prev]);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setCrawling(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      new: { label: '新抓取', variant: 'default' },
      read: { label: '已读', variant: 'secondary' },
      followed: { label: '已跟进', variant: 'outline' },
      expired: { label: '已过期', variant: 'destructive' },
    };
    const config = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">招标信息抓取</h1>
          <p className="text-muted-foreground">自动抓取和管理招标信息</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button asChild>
            <Link href="/tender-crawl/sources">
              <Plus className="mr-2 h-4 w-4" />
              管理抓取源
            </Link>
          </Button>
        </div>
      </div>

      {/* 搜索和统计 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="col-span-2">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                placeholder="输入关键词搜索招标信息..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={crawling}>
                {crawling ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{sources.length}</p>
                <p className="text-sm text-muted-foreground">抓取源</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{tenders.filter(t => t.status === 'new').length}</p>
                <p className="text-sm text-muted-foreground">新招标</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 招标信息列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            招标信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tenders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无招标信息</p>
              <p className="text-sm mt-2">使用上方搜索框搜索招标信息</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>行业</TableHead>
                  <TableHead>地区</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenders.map((tender) => (
                  <TableRow key={tender.id}>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="font-medium truncate">{tender.title}</p>
                        {tender.summary && (
                          <p className="text-sm text-muted-foreground truncate">
                            {tender.summary}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{tender.industry || '-'}</TableCell>
                    <TableCell>
                      {tender.region && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {tender.region}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {tender.deadline && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(tender.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(tender.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTender(tender)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {tender.sourceUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={tender.sourceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
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
      <Dialog open={!!selectedTender} onOpenChange={() => setSelectedTender(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTender?.title}</DialogTitle>
            <DialogDescription>招标信息详情</DialogDescription>
          </DialogHeader>
          {selectedTender && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">行业</p>
                  <p className="font-medium">{selectedTender.industry || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">地区</p>
                  <p className="font-medium">{selectedTender.region || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">预算</p>
                  <p className="font-medium">{selectedTender.budget || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">截止日期</p>
                  <p className="font-medium">
                    {selectedTender.deadline
                      ? new Date(selectedTender.deadline).toLocaleDateString()
                      : '-'}
                  </p>
                </div>
              </div>
              {selectedTender.summary && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">摘要</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedTender.summary}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedTender(null)}>
                  关闭
                </Button>
                {selectedTender.sourceUrl && (
                  <Button asChild>
                    <a href={selectedTender.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      查看原文
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

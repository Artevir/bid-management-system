'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import {
  Trash2,
  RotateCcw,
  MoreHorizontal,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  FileText,
  Building,
  File,
  Folder,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';

// 资源类型配置
const RESOURCE_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  document: { label: '标书文档', icon: FileText, color: 'bg-blue-500' },
  chapter: { label: '章节内容', icon: FileText, color: 'bg-green-500' },
  file: { label: '文件', icon: File, color: 'bg-orange-500' },
  company: { label: '公司', icon: Building, color: 'bg-purple-500' },
  company_file: { label: '公司文件', icon: File, color: 'bg-pink-500' },
  project: { label: '项目', icon: Folder, color: 'bg-cyan-500' },
};

// 回收站项目类型
interface RecycleBinItem {
  id: number;
  resourceType: string;
  resourceId: number;
  resourceName: string;
  deletedBy: { id: number; realName: string };
  deletedAt: string;
  expiresAt: string;
  deleteReason: string | null;
  projectId: number | null;
  companyId: number | null;
  daysUntilExpiry: number;
}

// 统计数据类型
interface RecycleBinStats {
  total: number;
  byType: Record<string, number>;
  expiringSoon: number;
}

function RecycleBinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 状态
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [stats, setStats] = useState<RecycleBinStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // 对话框状态
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; item: RecycleBinItem | null }>({
    open: false,
    item: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: RecycleBinItem | null }>({
    open: false,
    item: null,
  });
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; item: RecycleBinItem | null }>({
    open: false,
    item: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  // 获取回收站列表
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedType !== 'all') {
        params.set('resourceType', selectedType);
      }
      if (keyword) {
        params.set('keyword', keyword);
      }
      params.set('page', page.toString());
      params.set('pageSize', '20');

      const response = await fetch(`/api/recycle-bin?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setItems(result.data);
        setTotalPages(result.pagination.totalPages);
      } else {
        toast.error(result.error || '获取回收站列表失败');
      }
    } catch (error) {
      console.error('Fetch recycle bin error:', error);
      toast.error('获取回收站列表失败');
    } finally {
      setLoading(false);
    }
  }, [selectedType, keyword, page]);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/recycle-bin?stats=true');
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  }, []);

  // 初始化
  useEffect(() => {
    fetchItems();
    fetchStats();
  }, [fetchItems, fetchStats]);

  // 恢复资源
  const handleRestore = async (item: RecycleBinItem) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/recycle-bin/${item.id}/restore`, {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        toast.success(result.message || '资源已恢复');
        setRestoreDialog({ open: false, item: null });
        fetchItems();
        fetchStats();
      } else {
        toast.error(result.error || '恢复失败');
      }
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('恢复失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 永久删除
  const handlePermanentDelete = async (item: RecycleBinItem) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/recycle-bin/${item.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        toast.success(result.message || '资源已永久删除');
        setDeleteDialog({ open: false, item: null });
        fetchItems();
        fetchStats();
      } else {
        toast.error(result.error || '删除失败');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('删除失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 获取过期状态样式
  const getExpiryBadge = (days: number) => {
    if (days <= 1) {
      return <Badge variant="destructive">即将删除</Badge>;
    }
    if (days <= 7) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">即将过期</Badge>;
    }
    return <Badge variant="secondary">{days}天后删除</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trash2 className="h-8 w-8" />
            回收站
          </h1>
          <p className="text-muted-foreground mt-1">
            已删除的资源将在30天后自动永久删除
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                回收站总数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          {Object.entries(stats.byType).map(([type, count]) => {
            const config = RESOURCE_TYPE_CONFIG[type];
            if (!config || count === 0) return null;
            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <config.icon className="h-4 w-4" />
                    {config.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{count}</div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                即将过期
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</div>
              <p className="text-xs text-orange-500">7天内将自动删除</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 主内容 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>回收站列表</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索资源名称..."
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 w-64"
                />
              </div>
              <Tabs value={selectedType} onValueChange={(v) => { setSelectedType(v); setPage(1); }}>
                <TabsList>
                  <TabsTrigger value="all">全部</TabsTrigger>
                  <TabsTrigger value="document">文档</TabsTrigger>
                  <TabsTrigger value="file">文件</TabsTrigger>
                  <TabsTrigger value="company">公司</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>回收站为空</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>资源名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>删除人</TableHead>
                  <TableHead>删除时间</TableHead>
                  <TableHead>剩余时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const config = RESOURCE_TYPE_CONFIG[item.resourceType];
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {config && <config.icon className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-medium">{item.resourceName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={config?.color}>
                          {config?.label || item.resourceType}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.deletedBy.realName}</TableCell>
                      <TableCell>
                        {format(new Date(item.deletedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </TableCell>
                      <TableCell>
                        {getExpiryBadge(item.daysUntilExpiry)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setDetailDialog({ open: true, item })}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setRestoreDialog({ open: true, item })}
                              className="text-green-600"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              恢复
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteDialog({ open: true, item })}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              永久删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 恢复确认对话框 */}
      <AlertDialog open={restoreDialog.open} onOpenChange={(open) => setRestoreDialog({ open, item: open ? restoreDialog.item : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复</AlertDialogTitle>
            <AlertDialogDescription>
              确定要恢复 "{restoreDialog.item?.resourceName}" 吗？
              恢复后资源将回到原来的位置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreDialog.item && handleRestore(restoreDialog.item)}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 永久删除确认对话框 */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">确认永久删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要永久删除 "{deleteDialog.item?.resourceName}" 吗？
              <br />
              <strong className="text-red-600">此操作不可恢复，数据将完全丢失！</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.item && handlePermanentDelete(deleteDialog.item)}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 详情对话框 */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, item: open ? detailDialog.item : null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>资源详情</DialogTitle>
          </DialogHeader>
          {detailDialog.item && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">资源名称</label>
                  <p className="mt-1">{detailDialog.item.resourceName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">资源类型</label>
                  <p className="mt-1">
                    <Badge className={RESOURCE_TYPE_CONFIG[detailDialog.item.resourceType]?.color}>
                      {RESOURCE_TYPE_CONFIG[detailDialog.item.resourceType]?.label}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">删除人</label>
                  <p className="mt-1">{detailDialog.item.deletedBy.realName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">删除时间</label>
                  <p className="mt-1">
                    {format(new Date(detailDialog.item.deletedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">过期时间</label>
                  <p className="mt-1">
                    {format(new Date(detailDialog.item.expiresAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">剩余时间</label>
                  <p className="mt-1">{getExpiryBadge(detailDialog.item.daysUntilExpiry)}</p>
                </div>
              </div>
              {detailDialog.item.deleteReason && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">删除原因</label>
                  <p className="mt-1 text-sm bg-muted p-2 rounded">{detailDialog.item.deleteReason}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDetailDialog({ open: false, item: null })}
                >
                  关闭
                </Button>
                <Button
                  variant="outline"
                  className="text-green-600 border-green-600 hover:bg-green-50"
                  onClick={() => {
                    setDetailDialog({ open: false, item: null });
                    setRestoreDialog({ open: true, item: detailDialog.item });
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  恢复
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailDialog({ open: false, item: null });
                    setDeleteDialog({ open: true, item: detailDialog.item });
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  永久删除
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RecycleBinPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">加载中...</div>
      </div>
    }>
      <RecycleBinContent />
    </Suspense>
  );
}

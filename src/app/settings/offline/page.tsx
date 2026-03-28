'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  HardDrive,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Download,
  Upload,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  initOfflineSync,
  stopOfflineSync,
  isOnline,
  onNetworkChange,
  getSyncStatus,
  onSyncStatusChange,
  syncPendingOperations,
  refreshCache,
  getOfflineStorageInfo,
  clearAllCache,
  recordOfflineOperation,
} from '@/lib/offline/sync';
import type { SyncStatus } from '@/lib/offline/sync';

export default function OfflineSettingsPage() {
  const [online, setOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState(0);
  const [storageInfo, setStorageInfo] = useState({
    usage: 0,
    quota: 0,
    available: 0,
    pendingOperations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // 格式化字节
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取存储信息
  const fetchStorageInfo = async () => {
    try {
      const info = await getOfflineStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('获取存储信息失败:', error);
    }
  };

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await initOfflineSync();
        setOnline(isOnline());
        setSyncStatus(getSyncStatus());
        await fetchStorageInfo();
      } catch (error) {
        console.error('初始化离线模式失败:', error);
      } finally {
        setLoading(false);
      }
    };

    init();

    // 监听网络状态
    const unsubscribe = onNetworkChange((isOnline) => {
      setOnline(isOnline);
    });

    // 监听同步状态
    const unsubscribeSync = onSyncStatusChange((status, progress) => {
      setSyncStatus(status);
      if (progress !== undefined) {
        setSyncProgress(Math.round(progress * 100));
      }
    });

    return () => {
      unsubscribe();
      unsubscribeSync();
      stopOfflineSync();
    };
  }, []);

  // 手动同步
  const handleSync = async () => {
    if (!online) {
      toast.error('离线状态下无法同步');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncPendingOperations();
      if (result.total > 0) {
        toast.success(`同步完成: ${result.success} 成功, ${result.failed} 失败`);
      } else {
        toast.success('没有需要同步的数据');
      }
      await fetchStorageInfo();
    } catch (error) {
      toast.error('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  // 刷新缓存
  const handleRefreshCache = async () => {
    if (!online) {
      toast.error('离线状态下无法刷新缓存');
      return;
    }

    setRefreshing(true);
    try {
      await refreshCache();
      toast.success('缓存已刷新');
      await fetchStorageInfo();
    } catch (error) {
      toast.error('刷新缓存失败');
    } finally {
      setRefreshing(false);
    }
  };

  // 清除缓存
  const handleClearCache = async () => {
    try {
      await clearAllCache();
      toast.success('缓存已清除');
      await fetchStorageInfo();
      setClearDialogOpen(false);
    } catch (error) {
      toast.error('清除缓存失败');
    }
  };

  const getSyncStatusBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return <Badge className="bg-blue-100 text-blue-800">同步中</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">同步错误</Badge>;
      case 'offline':
        return <Badge className="bg-gray-100 text-gray-800">离线</Badge>;
      default:
        return <Badge className="bg-green-100 text-green-800">已同步</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">离线模式设置</h1>
        <p className="text-muted-foreground">管理离线数据缓存和同步</p>
      </div>

      {/* 网络状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {online ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-600" />
            )}
            网络状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                {online ? '已连接网络' : '离线状态'}
              </div>
              <div className="text-sm text-muted-foreground">
                {online
                  ? '可以进行数据同步和在线操作'
                  : '离线模式已启用，部分功能可能不可用'}
              </div>
            </div>
            <Badge
              className={online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
            >
              {online ? '在线' : '离线'}
            </Badge>
          </div>

          {!online && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                您当前处于离线状态。离线时的操作将在网络恢复后自动同步。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 同步状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            数据同步
          </CardTitle>
          <CardDescription>同步离线操作和缓存数据</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">同步状态</div>
              <div className="text-sm text-muted-foreground">
                {storageInfo.pendingOperations > 0
                  ? `有 ${storageInfo.pendingOperations} 个待同步操作`
                  : '所有数据已同步'}
              </div>
            </div>
            {getSyncStatusBadge()}
          </div>

          {syncStatus === 'syncing' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>同步进度</span>
                <span>{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} />
            </div>
          )}

          <Separator />

          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={!online || syncing}
              className="flex-1"
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              同步数据
            </Button>
            <Button
              variant="outline"
              onClick={handleRefreshCache}
              disabled={!online || refreshing}
              className="flex-1"
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              刷新缓存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 存储信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            存储空间
          </CardTitle>
          <CardDescription>离线数据存储使用情况</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>已使用</span>
              <span>{formatBytes(storageInfo.usage)}</span>
            </div>
            <Progress
              value={storageInfo.quota > 0 ? (storageInfo.usage / storageInfo.quota) * 100 : 0}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>可用: {formatBytes(storageInfo.available)}</span>
              <span>总计: {formatBytes(storageInfo.quota)}</span>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-muted rounded-lg">
              <Database className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <div className="font-medium">缓存数据</div>
              <div className="text-sm text-muted-foreground">
                {formatBytes(storageInfo.usage)}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <div className="font-medium">待同步</div>
              <div className="text-sm text-muted-foreground">
                {storageInfo.pendingOperations} 条
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <div className="font-medium">同步状态</div>
              <div className="text-sm text-muted-foreground">
                {syncStatus === 'idle' ? '正常' : syncStatus}
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={() => setClearDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              清除所有缓存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 离线功能说明 */}
      <Card>
        <CardHeader>
          <CardTitle>离线功能说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">自动缓存</div>
                <div className="text-sm text-muted-foreground">
                  项目、文档、任务等数据会自动缓存到本地，离线时可查看
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">离线操作</div>
                <div className="text-sm text-muted-foreground">
                  部分操作支持离线执行，网络恢复后自动同步到服务器
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">自动同步</div>
                <div className="text-sm text-muted-foreground">
                  网络恢复后自动同步离线操作，无需手动干预
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <div className="font-medium">注意事项</div>
                <div className="text-sm text-muted-foreground">
                  离线模式下，部分实时功能（如即时消息）不可用
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 清除缓存确认对话框 */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认清除缓存</DialogTitle>
            <DialogDescription>
              这将清除所有离线缓存的数据和待同步的操作。清除后需要重新下载数据。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleClearCache}>
              确认清除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

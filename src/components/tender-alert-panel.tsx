'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Calendar,
  Building2 as _Building2,
  Check,
  Trash2 as _Trash2,
  AlertCircle as _AlertCircle,
  FileText as _FileText,
  MessageSquare,
  Send,
  Gavel,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================
// 类型定义
// ============================================

type AlertType = 'register_deadline' | 'question_deadline' | 'submission_deadline' | 'open_bid';

interface TenderAlert {
  id: number;
  tenderInfoId: number;
  alertType: AlertType;
  alertTitle: string;
  alertMessage: string;
  targetTime: string;
  scheduledTime: string;
  status: 'pending' | 'sent' | 'read' | 'dismissed';
  createdAt: string;
  tenderInfo?: {
    id: number;
    title: string;
    tenderOrganization: string | null;
    sourceUrl: string | null;
  };
}

// ============================================
// 常量
// ============================================

const ALERT_TYPE_CONFIG: Record<AlertType, { label: string; icon: typeof Clock; color: string }> = {
  register_deadline: { label: '报名截止', icon: Calendar, color: 'text-blue-500' },
  question_deadline: { label: '答疑截止', icon: MessageSquare, color: 'text-orange-500' },
  submission_deadline: { label: '投标截止', icon: Send, color: 'text-red-500' },
  open_bid: { label: '开标时间', icon: Gavel, color: 'text-purple-500' },
};

// ============================================
// 组件
// ============================================

export function TenderAlertPanel() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<TenderAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 获取预警列表
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/tender-alerts?pageSize=50');
      const data = await res.json();
      setAlerts(data.data || []);
    } catch (error) {
      console.error('获取预警列表失败:', error);
    }
  }, []);

  // 获取未读数量
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/tender-alerts?action=unread-count');
      const data = await res.json();
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error('获取未读数量失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchUnreadCount();

    // 每5分钟刷新一次
    const interval = setInterval(() => {
      fetchAlerts();
      fetchUnreadCount();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchAlerts, fetchUnreadCount]);

  // 标记为已读
  const markAsRead = async (alertId: number) => {
    try {
      await fetch(`/api/tender-alerts/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read' }),
      });
      fetchAlerts();
      fetchUnreadCount();
    } catch (error) {
      console.error('标记已读失败:', error);
      toast.error('操作失败');
    }
  };

  // 忽略预警
  const dismissAlert = async (alertId: number) => {
    try {
      await fetch(`/api/tender-alerts/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      });
      fetchAlerts();
      fetchUnreadCount();
      toast.success('已忽略');
    } catch (error) {
      console.error('忽略失败:', error);
      toast.error('操作失败');
    }
  };

  // 全部标记已读
  const markAllAsRead = async () => {
    try {
      setLoading(true);
      await fetch('/api/tender-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
      fetchAlerts();
      fetchUnreadCount();
      toast.success('已全部标记为已读');
    } catch (error) {
      console.error('批量标记失败:', error);
      toast.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 查看详情
  const viewDetail = (alert: TenderAlert) => {
    markAsRead(alert.id);
    router.push(`/tender-crawl?tenderId=${alert.tenderInfoId}`);
    setOpen(false);
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff < 0) {
      return '已过期';
    }
    if (days > 0) {
      return `${days}天${hours}小时后`;
    }
    return `${hours}小时后`;
  };

  // 按类型分组
  const groupedAlerts = alerts.reduce((acc, alert) => {
    const type = alert.alertType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(alert);
    return acc;
  }, {} as Record<AlertType, TenderAlert[]>);

  return (
    <>
      {/* 预警按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* 预警面板 */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                招标预警
              </SheetTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={loading}
                >
                  <Check className="mr-2 h-4 w-4" />
                  全部已读
                </Button>
              )}
            </div>
            <SheetDescription>
              共 {alerts.length} 条预警，{unreadCount} 条未读
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-180px)] mt-4">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
                <p>暂无预警</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedAlerts).map(([type, typeAlerts]) => {
                  const config = ALERT_TYPE_CONFIG[type as AlertType];
                  const Icon = config.icon;

                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className={cn('h-4 w-4', config.color)} />
                        {config.label}预警
                        <Badge variant="secondary" className="text-xs">
                          {typeAlerts.length}
                        </Badge>
                      </div>

                      {typeAlerts.map((alert) => {
                        const isUnread = alert.status === 'sent';

                        return (
                          <div
                            key={alert.id}
                            className={cn(
                              'p-3 rounded-lg border transition-colors cursor-pointer',
                              isUnread
                                ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                                : 'bg-muted/50 hover:bg-muted'
                            )}
                            onClick={() => viewDetail(alert)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {alert.alertTitle}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {alert.alertMessage}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(alert.targetTime)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dismissAlert(alert.id);
                                  }}
                                >
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>

                            {alert.tenderInfo?.sourceUrl && (
                              <div className="mt-2 pt-2 border-t">
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(alert.tenderInfo!.sourceUrl!, '_blank');
                                  }}
                                >
                                  <ExternalLink className="mr-1 h-3 w-3" />
                                  查看原文
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                router.push('/tender-subscriptions');
                setOpen(false);
              }}
            >
              <Bell className="mr-2 h-4 w-4" />
              管理订阅规则
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// 导出一个简单的预警统计组件
export function TenderAlertBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/tender-alerts?action=unread-count');
        const data = await res.json();
        setCount(data.count || 0);
      } catch (error) {
        console.error('获取未读数量失败:', error);
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <Badge variant="destructive" className="ml-2">
      {count > 99 ? '99+' : count}
    </Badge>
  );
}

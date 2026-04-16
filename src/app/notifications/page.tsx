'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader as _CardHeader,
  CardTitle as _CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea as _ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  ArrowLeft,
  Filter as _Filter,
  Settings as _Settings,
  FileText,
  Workflow,
  CheckCircle,
  Clock,
  Building2,
  AlertCircle as _AlertCircle,
  AtSign,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  priority: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  senderName: string | null;
}

interface NotificationListResponse {
  data: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

// 通知类型图标映射
const typeIcons: Record<string, any> = {
  system: Bell,
  workflow: Workflow,
  approval: CheckCircle,
  milestone: Calendar,
  document: FileText,
  project: Building2,
  mention: AtSign,
  deadline: Clock,
};

// 通知类型名称映射
const typeNames: Record<string, string> = {
  system: '系统通知',
  workflow: '工作流',
  approval: '审批',
  milestone: '里程碑',
  document: '文档',
  project: '项目',
  mention: '@提醒',
  deadline: '截止提醒',
};

// 优先级颜色映射
const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filter, setFilter] = useState({
    type: '',
    priority: '',
  });
  const [notifications, setNotifications] = useState<NotificationListResponse>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    byType: {},
    byPriority: {},
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // 获取通知列表
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.append('page', notifications.page.toString());
      params.append('pageSize', notifications.pageSize.toString());

      if (activeTab === 'unread') {
        params.append('isRead', 'false');
      }
      if (filter.type) {
        params.append('type', filter.type);
      }
      if (filter.priority) {
        params.append('priority', filter.priority);
      }

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (!response.ok) throw new Error('获取失败');

      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error('获取通知列表失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
      toast.error('获取通知列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/notifications?action=stats');
      if (!response.ok) throw new Error('获取失败');

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [activeTab, filter.type, filter.priority, notifications.page]);

  // 标记单个已读
  const handleMarkRead = async (id: number) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', notificationId: id }),
      });

      if (!response.ok) throw new Error('操作失败');

      toast.success('已标记为已读');
      fetchNotifications();
      fetchStats();
    } catch (error) {
      console.error('标记已读失败:', error);
      toast.error('操作失败');
    }
  };

  // 批量标记已读
  const handleBatchMarkRead = async () => {
    if (selectedIds.length === 0) {
      toast.error('请选择通知');
      return;
    }

    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: selectedIds }),
      });

      if (!response.ok) throw new Error('操作失败');

      toast.success('已批量标记为已读');
      setSelectedIds([]);
      fetchNotifications();
      fetchStats();
    } catch (error) {
      console.error('批量标记失败:', error);
      toast.error('操作失败');
    }
  };

  // 全部标记已读
  const handleMarkAllRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });

      if (!response.ok) throw new Error('操作失败');

      toast.success('已全部标记为已读');
      fetchNotifications();
      fetchStats();
    } catch (error) {
      console.error('全部标记失败:', error);
      toast.error('操作失败');
    }
  };

  // 删除通知
  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('删除失败');

      toast.success('删除成功');
      fetchNotifications();
      fetchStats();
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    }
  };

  // 清空已读通知
  const handleClearRead = async () => {
    if (!confirm('确定要清空所有已读通知吗？')) return;

    try {
      const response = await fetch('/api/notifications?action=clearRead', {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('操作失败');

      toast.success('已清空已读通知');
      fetchNotifications();
      fetchStats();
    } catch (error) {
      console.error('清空失败:', error);
      toast.error('操作失败');
    }
  };

  // 切换选择
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // 全选当前页
  const toggleSelectAll = () => {
    if (selectedIds.length === notifications.data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.data.map((n) => n.id));
    }
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">消息中心</h1>
            <p className="text-gray-500 text-sm">管理系统通知、工作流提醒等消息</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleClearRead}>
            <Trash2 className="h-4 w-4 mr-2" />
            清空已读
          </Button>
          <Button variant="outline" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            全部已读
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">全部消息</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">未读消息</p>
            <p className="text-2xl font-bold text-red-500">{stats.unread}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">工作流</p>
            <p className="text-2xl font-bold">{stats.byType?.workflow || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">审批通知</p>
            <p className="text-2xl font-bold">{stats.byType?.approval || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500">系统通知</p>
            <p className="text-2xl font-bold">{stats.byType?.system || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4 mb-4">
        <Select
          value={filter.type || 'all'}
          onValueChange={(v) => setFilter({ ...filter, type: v === 'all' ? '' : v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="消息类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="workflow">工作流</SelectItem>
            <SelectItem value="approval">审批</SelectItem>
            <SelectItem value="milestone">里程碑</SelectItem>
            <SelectItem value="document">文档</SelectItem>
            <SelectItem value="project">项目</SelectItem>
            <SelectItem value="system">系统</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filter.priority || 'all'}
          onValueChange={(v) => setFilter({ ...filter, priority: v === 'all' ? '' : v })}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="优先级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="urgent">紧急</SelectItem>
            <SelectItem value="high">高</SelectItem>
            <SelectItem value="normal">普通</SelectItem>
            <SelectItem value="low">低</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tab切换 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            全部消息
            {stats.total > 0 && (
              <Badge className="ml-2" variant="secondary">
                {stats.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread">
            未读消息
            {stats.unread > 0 && <Badge className="ml-2 bg-red-500">{stats.unread}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {/* 批量操作栏 */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-blue-50 rounded-lg">
              <span className="text-sm">已选择 {selectedIds.length} 条</span>
              <Button size="sm" variant="outline" onClick={handleBatchMarkRead}>
                <Check className="h-4 w-4 mr-1" />
                标记已读
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>
                取消选择
              </Button>
            </div>
          )}

          {/* 消息列表 */}
          <Card>
            <CardContent className="p-0">
              {error ? (
                <ListStateBlock state="error" error={error} onRetry={fetchNotifications} />
              ) : loading ? (
                <ListStateBlock state="loading" />
              ) : notifications.data.length === 0 ? (
                <ListStateBlock state="empty" emptyText="暂无消息" />
              ) : (
                <div className="divide-y">
                  {/* 全选 */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50">
                    <Checkbox
                      checked={selectedIds.length === notifications.data.length}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm text-gray-500">全选当前页</span>
                  </div>

                  {/* 消息项 */}
                  {notifications.data.map((notification) => {
                    const TypeIcon = typeIcons[notification.type] || Bell;

                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          'flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors',
                          !notification.isRead && 'bg-blue-50/50'
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.includes(notification.id)}
                          onCheckedChange={() => toggleSelect(notification.id)}
                        />

                        <div
                          className={cn(
                            'p-2 rounded-lg',
                            notification.type === 'system' && 'bg-purple-100',
                            notification.type === 'workflow' && 'bg-blue-100',
                            notification.type === 'approval' && 'bg-green-100',
                            notification.type === 'milestone' && 'bg-orange-100',
                            notification.type === 'document' && 'bg-cyan-100',
                            notification.type === 'project' && 'bg-indigo-100'
                          )}
                        >
                          <TypeIcon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn('font-medium', !notification.isRead && 'text-blue-600')}
                            >
                              {notification.title}
                            </span>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                            <Badge className={cn('text-xs', priorityColors[notification.priority])}>
                              {notification.priority === 'urgent' && '紧急'}
                              {notification.priority === 'high' && '高'}
                              {notification.priority === 'normal' && '普通'}
                              {notification.priority === 'low' && '低'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {notification.content}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span>{typeNames[notification.type] || notification.type}</span>
                            {notification.senderName && (
                              <span>来自: {notification.senderName}</span>
                            )}
                            <span>{formatTime(notification.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {notification.link && (
                            <Link href={notification.link}>
                              <Button variant="ghost" size="icon">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkRead(notification.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(notification.id)}
                          >
                            <Trash2 className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 分页 */}
          {notifications.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">共 {notifications.total} 条消息</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={notifications.page === 1}
                  onClick={() =>
                    setNotifications({ ...notifications, page: notifications.page - 1 })
                  }
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={notifications.page === notifications.totalPages}
                  onClick={() =>
                    setNotifications({ ...notifications, page: notifications.page + 1 })
                  }
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

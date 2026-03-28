'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Target,
  Plus,
} from 'lucide-react';

// ============================================
// 类型定义
// ============================================

interface CalendarEvent {
  id: string;
  type: 'deadline' | 'openbid' | 'milestone' | 'question';
  title: string;
  projectName: string;
  projectId: number;
  date: string;
  priority: 'high' | 'medium' | 'low';
  status?: string;
}

interface Project {
  id: number;
  name: string;
  code: string;
  status: string;
  submissionDeadline: string | null;
  openBidDate: string | null;
  publishDate: string | null;
  questionDeadline: string | null;
}

const eventTypeConfig = {
  deadline: { label: '投标截止', color: 'bg-red-500', icon: Clock },
  openbid: { label: '开标日期', color: 'bg-purple-500', icon: Target },
  milestone: { label: '里程碑', color: 'bg-blue-500', icon: CheckCircle },
  question: { label: '答疑截止', color: 'bg-orange-500', icon: FileText },
};

const priorityConfig = {
  high: { label: '紧急', className: 'border-l-red-500' },
  medium: { label: '普通', className: 'border-l-yellow-500' },
  low: { label: '一般', className: 'border-l-blue-500' },
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [viewType, setViewType] = useState<'month' | 'week'>('month');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  async function fetchCalendarData() {
    setLoading(true);
    try {
      // 获取项目数据
      const response = await fetch('/api/projects');
      const data = await response.json();
      
      // 转换为日历事件
      const calendarEvents: CalendarEvent[] = [];
      
      (data.projects || []).forEach((project: Project) => {
        // 投标截止日期
        if (project.submissionDeadline) {
          calendarEvents.push({
            id: `deadline-${project.id}`,
            type: 'deadline',
            title: `${project.name} - 投标截止`,
            projectName: project.name,
            projectId: project.id,
            date: project.submissionDeadline,
            priority: 'high',
            status: project.status,
          });
        }
        
        // 开标日期
        if (project.openBidDate) {
          calendarEvents.push({
            id: `openbid-${project.id}`,
            type: 'openbid',
            title: `${project.name} - 开标`,
            projectName: project.name,
            projectId: project.id,
            date: project.openBidDate,
            priority: 'medium',
            status: project.status,
          });
        }
        
        // 答疑截止
        if (project.questionDeadline) {
          calendarEvents.push({
            id: `question-${project.id}`,
            type: 'question',
            title: `${project.name} - 答疑截止`,
            projectName: project.name,
            projectId: project.id,
            date: project.questionDeadline,
            priority: 'low',
            status: project.status,
          });
        }
      });
      
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setLoading(false);
    }
  }

  // 获取月份信息
  const monthInfo = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // 周日开始
    
    const days: Date[] = [];
    
    // 上个月的填充天数
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push(date);
    }
    
    // 当月天数
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    // 下个月的填充天数（填满6行）
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return { year, month, days, firstDay, lastDay };
  }, [currentDate]);

  // 获取某天的事件
  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDate = new Date(event.date).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  };

  // 过滤事件
  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter(e => e.type === filterType);
  }, [events, filterType]);

  // 月份导航
  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  // 跳转到今天
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // 判断是否是今天
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // 判断是否是当月
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === monthInfo.month;
  };

  // 获取即将到来的事件（未来7天）
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return events
      .filter(e => {
        const eventDate = new Date(e.date);
        return eventDate >= now && eventDate <= weekLater;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [events]);

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">投标日历</h1>
          <p className="text-muted-foreground">可视化时间轴管理投标节点</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="筛选类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="deadline">投标截止</SelectItem>
              <SelectItem value="openbid">开标日期</SelectItem>
              <SelectItem value="question">答疑截止</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* 日历主体 */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <h2 className="text-xl font-semibold">
                  {monthInfo.year}年{monthInfo.month + 1}月
                </h2>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday}>
                今天
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 42 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {/* 星期标题 */}
                {weekdays.map(day => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
                
                {/* 日期格子 */}
                {monthInfo.days.map((date, index) => {
                  const dayEvents = getEventsForDate(date);
                  const today = isToday(date);
                  const currentMonth = isCurrentMonth(date);
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-[80px] p-1 border rounded-lg ${
                        !currentMonth ? 'bg-muted/30' : 'bg-background'
                      } ${today ? 'ring-2 ring-primary' : ''}`}
                    >
                      <div className={`text-sm mb-1 ${!currentMonth ? 'text-muted-foreground' : ''}`}>
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                          today ? 'bg-primary text-primary-foreground font-bold' : ''
                        }`}>
                          {date.getDate()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map(event => {
                          const config = eventTypeConfig[event.type];
                          const Icon = config.icon;
                          
                          return (
                            <div
                              key={event.id}
                              className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${config.color} text-white truncate`}
                              onClick={() => setSelectedEvent(event)}
                            >
                              <span className="flex items-center gap-1">
                                <Icon className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{event.projectName}</span>
                              </span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-muted-foreground text-center">
                            +{dayEvents.length - 2} 更多
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 即将到来 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                即将到来
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  未来7天暂无重要节点
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(event => {
                    const config = eventTypeConfig[event.type];
                    const Icon = config.icon;
                    const daysUntil = Math.ceil(
                      (new Date(event.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    
                    return (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg border-l-4 cursor-pointer hover:bg-muted/50 ${priorityConfig[event.priority].className}`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {event.projectName}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={daysUntil <= 1 ? 'destructive' : daysUntil <= 3 ? 'default' : 'secondary'}>
                              {daysUntil === 0 ? '今天' : daysUntil === 1 ? '明天' : `${daysUntil}天后`}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 图例 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">图例说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(eventTypeConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <div className={`w-3 h-3 rounded ${config.color}`} />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{config.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">本月统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">
                    {events.filter(e => {
                      const eventDate = new Date(e.date);
                      return eventDate.getMonth() === monthInfo.month && e.type === 'deadline';
                    }).length}
                  </p>
                  <p className="text-xs text-muted-foreground">投标截止</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-500">
                    {events.filter(e => {
                      const eventDate = new Date(e.date);
                      return eventDate.getMonth() === monthInfo.month && e.type === 'openbid';
                    }).length}
                  </p>
                  <p className="text-xs text-muted-foreground">开标日期</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 事件详情弹窗 */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && (
                <>
                  <div className={`w-3 h-3 rounded ${eventTypeConfig[selectedEvent.type].color}`} />
                  {eventTypeConfig[selectedEvent.type].label}
                </>
              )}
            </DialogTitle>
            <DialogDescription>{selectedEvent?.title}</DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">项目名称</p>
                  <p className="font-medium">{selectedEvent.projectName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">日期</p>
                  <p className="font-medium">
                    {new Date(selectedEvent.date).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">优先级</p>
                  <Badge variant={selectedEvent.priority === 'high' ? 'destructive' : 'secondary'}>
                    {priorityConfig[selectedEvent.priority].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">状态</p>
                  <Badge>{selectedEvent.status || '进行中'}</Badge>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <a href={`/projects/${selectedEvent.projectId}`}>查看项目</a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

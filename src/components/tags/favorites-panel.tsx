'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle as _CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Star,
  Clock,
  MoreVertical,
  Trash2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface FavoriteItem {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string | null;
  note: string | null;
  createdAt: string;
  entityDetail: {
    id: number;
    name: string;
    color: string;
    type?: string;
    useCount?: number;
    description?: string;
  } | null;
}

interface RecentVisit {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string | null;
  visitCount: number;
  lastVisitedAt: string;
  entityDetail: {
    id: number;
    name: string;
    color: string;
    type?: string;
  } | null;
}

interface FavoritesPanelProps {
  onSelectTag?: (tagId: number) => void;
  onSelectCategory?: (categoryId: number) => void;
}

// ============================================
// Main Component
// ============================================

export function FavoritesPanel({
  onSelectTag,
  onSelectCategory,
}: FavoritesPanelProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'favorites' | 'recent'>('favorites');

  // 加载收藏和最近访问
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [favRes, recentRes] = await Promise.all([
          fetch('/api/tags/favorites'),
          fetch('/api/tags/recent'),
        ]);
        const [favData, recentData] = await Promise.all([
          favRes.json(),
          recentRes.json(),
        ]);
        setFavorites(favData.items || []);
        setRecentVisits(recentData.items || []);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 取消收藏
  const handleRemoveFavorite = async (id: number) => {
    try {
      await fetch(`/api/tags/favorites?id=${id}`, {
        method: 'DELETE',
      });
      setFavorites(favorites.filter((f) => f.id !== id));
    } catch (error) {
      console.error('取消收藏失败:', error);
    }
  };

  // 清除最近访问
  const handleClearRecent = async () => {
    try {
      await fetch('/api/tags/recent?clearAll=true', {
        method: 'DELETE',
      });
      setRecentVisits([]);
    } catch (error) {
      console.error('清除最近访问失败:', error);
    }
  };

  // 点击实体
  const handleEntityClick = (item: FavoriteItem | RecentVisit) => {
    if (item.entityType === 'tag' && onSelectTag) {
      onSelectTag(item.entityId);
    } else if (item.entityType === 'category' && onSelectCategory) {
      onSelectCategory(item.entityId);
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
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <button
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium transition-colors',
                activeTab === 'favorites'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('favorites')}
            >
              <Star className="h-4 w-4" />
              收藏
              {favorites.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {favorites.length}
                </Badge>
              )}
            </button>
            <button
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium transition-colors',
                activeTab === 'recent'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('recent')}
            >
              <Clock className="h-4 w-4" />
              最近访问
              {recentVisits.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {recentVisits.length}
                </Badge>
              )}
            </button>
          </div>
          {activeTab === 'recent' && recentVisits.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleClearRecent}
            >
              清除
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeTab === 'favorites' ? (
            favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Star className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">暂无收藏</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {favorites.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => handleEntityClick(item)}
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{
                        backgroundColor: item.entityDetail?.color || '#6366f1',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium truncate">
                          {item.entityDetail?.name || item.entityName || '未知'}
                        </span>
                        {item.entityType === 'category' && (
                          <Badge variant="outline" className="text-xs">
                            分类
                          </Badge>
                        )}
                      </div>
                      {item.note && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.note}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEntityClick(item)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFavorite(item.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          取消收藏
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )
          ) : recentVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">暂无访问记录</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {recentVisits.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => handleEntityClick(item)}
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{
                      backgroundColor: item.entityDetail?.color || '#6366f1',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium truncate">
                        {item.entityDetail?.name || item.entityName || '未知'}
                      </span>
                      {item.entityType === 'category' && (
                        <Badge variant="outline" className="text-xs">
                          分类
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      访问 {item.visitCount} 次 · {formatTime(item.lastVisitedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3,
  TrendingUp,
  Hash,
  FolderTree,
  Tag as TagIcon,
  Users,
  Calendar,
  Activity,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface OverviewStats {
  totalTags: number;
  totalCategories: number;
  totalRelations: number;
  systemTags: number;
  recentTags: number;
  typeStats: Record<string, number>;
}

interface UsageStats {
  topUsed: Array<{
    id: number;
    name: string;
    color: string;
    useCount: number;
    category: { name: string; color: string } | null;
  }>;
  distribution: Array<{
    range: string;
    count: number;
  }>;
}

interface HotTags {
  hotTags: Array<{
    id: number;
    name: string;
    color: string;
    hotScore: number;
  }>;
  recentHot: Array<{
    id: number;
    name: string;
    color: string;
    recentUseCount: number;
  }>;
}

interface CategoryStats {
  categories: Array<{
    id: number;
    name: string;
    color: string;
    tagCount: number;
    totalUseCount: number;
  }>;
}

interface EntityStats {
  entityTypeStats: Array<{
    entityType: string;
    tagCount: number;
    relationCount: number;
  }>;
}

// ============================================
// Main Component
// ============================================

export function StatisticsPanel() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [hot, setHot] = useState<HotTags | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStats | null>(null);
  const [entityStats, setEntityStats] = useState<EntityStats | null>(null);

  // 加载统计数据
  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const [overviewRes, usageRes, hotRes, categoryRes, entityRes] = await Promise.all([
          fetch('/api/tags/statistics?type=overview'),
          fetch('/api/tags/statistics?type=usage'),
          fetch('/api/tags/statistics?type=hot'),
          fetch('/api/tags/statistics?type=category'),
          fetch('/api/tags/statistics?type=entity'),
        ]);
        
        const [overviewData, usageData, hotData, categoryData, entityData] = await Promise.all([
          overviewRes.json(),
          usageRes.json(),
          hotRes.json(),
          categoryRes.json(),
          entityRes.json(),
        ]);
        
        setOverview(overviewData.overview);
        setUsage(usageData);
        setHot(hotData);
        setCategoryStats(categoryData);
        setEntityStats(entityData);
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadStats();
  }, []);

  // 实体类型名称映射
  const entityTypeNameMap: Record<string, string> = {
    project: '项目',
    document: '文档',
    template: '模板',
    scheme: '方案',
    bid: '投标',
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          数据统计
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-9">
            <TabsTrigger value="overview" className="text-xs">概览</TabsTrigger>
            <TabsTrigger value="usage" className="text-xs">使用</TabsTrigger>
            <TabsTrigger value="hot" className="text-xs">热度</TabsTrigger>
            <TabsTrigger value="entity" className="text-xs">关联</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[280px]">
            {/* 概览统计 */}
            <TabsContent value="overview" className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <TagIcon className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">标签总数</p>
                    <p className="text-lg font-semibold">{overview?.totalTags || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <FolderTree className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">分类总数</p>
                    <p className="text-lg font-semibold">{overview?.totalCategories || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Activity className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">关联总数</p>
                    <p className="text-lg font-semibold">{overview?.totalRelations || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Calendar className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">近7天新增</p>
                    <p className="text-lg font-semibold">{overview?.recentTags || 0}</p>
                  </div>
                </div>
              </div>

              {/* 类型分布 */}
              {overview?.typeStats && Object.keys(overview.typeStats).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">类型分布</p>
                  <div className="space-y-2">
                    {Object.entries(overview.typeStats).map(([type, count]) => {
                      const total = overview.totalTags || 1;
                      const percent = Math.round((count / total) * 100);
                      return (
                        <div key={type} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{type === 'tag' ? '标签' : '目录'}</span>
                            <span>{count} ({percent}%)</span>
                          </div>
                          <Progress value={percent} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 使用统计 */}
            <TabsContent value="usage" className="p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">热门标签</p>
                {usage?.topUsed?.slice(0, 5).map((tag, index) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                  >
                    <span className="text-xs text-muted-foreground w-4">
                      {index + 1}
                    </span>
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm flex-1 truncate">{tag.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {tag.useCount} 次
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">使用次数分布</p>
                {usage?.distribution?.map((item) => (
                  <div
                    key={item.range}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{item.range}</span>
                    <span>{item.count}</span>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* 热度统计 */}
            <TabsContent value="hot" className="p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  综合热度
                </p>
                {hot?.hotTags?.slice(0, 5).map((tag, index) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                  >
                    <span className="text-xs text-muted-foreground w-4">
                      {index + 1}
                    </span>
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm flex-1 truncate">{tag.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(tag.hotScore)}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">近30天热门</p>
                {hot?.recentHot?.slice(0, 5).map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-md"
                  >
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm flex-1 truncate">{tag.name}</span>
                    <Badge variant="outline" className="text-xs">
                      +{tag.recentUseCount}
                    </Badge>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* 实体关联统计 */}
            <TabsContent value="entity" className="p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">实体类型分布</p>
                {entityStats?.entityTypeStats?.map((item) => (
                  <div
                    key={item.entityType}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">
                        {entityTypeNameMap[item.entityType] || item.entityType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {item.tagCount} 标签
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {item.relationCount} 关联
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">分类使用情况</p>
                {categoryStats?.categories?.slice(0, 5).map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-2 p-2 rounded-md"
                  >
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm flex-1 truncate">{cat.name}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {cat.tagCount}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({cat.totalUseCount}次)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * 投标文档统计页面
 * 提供多维度的文档统计数据
 */

'use client';

import { useState, useEffect, useCallback as _useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge as _Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3 as _BarChart3,
  PieChart as _PieChart,
  TrendingUp,
  FileText,
  CheckCircle,
  Clock as _Clock,
  Users as _Users,
  Calendar as _Calendar,
  RefreshCw,
  Download,
} from 'lucide-react';

interface DocumentStatistics {
  chapters: {
    total: number;
    completed: number;
    totalWords: number;
  };
  generations: {
    total: number;
    completed: number;
  };
  reviews: {
    total: number;
    completed: number;
  };
  compliance: {
    total: number;
    passed: number;
    failed: number;
  };
}

interface ProjectDocumentStatistics {
  totalDocuments: number;
  statusDistribution: {
    draft: number;
    editing: number;
    reviewing: number;
    approved: number;
    published: number;
  };
  totalChapters: number;
  completedChapters: number;
  totalWords: number;
}

export default function BidStatisticsPage() {
  const _router = useRouter();
  const params = useParams();
  const documentId = params.id as string;
  const [stats, setStats] = useState<DocumentStatistics | null>(null);
  const [_projectStats, _setProjectStats] = useState<ProjectDocumentStatistics | null>(null);
  const [_loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>('all');

  useEffect(() => {
    if (documentId) {
      loadStatistics();
    }
  }, [documentId, timeRange]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bid/documents/statistics?documentId=${documentId}&timeRange=${timeRange}`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusProgress = (current: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((current / total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文档统计</h1>
          <p className="text-gray-500 mt-1">查看文档的详细统计数据</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部时间</SelectItem>
              <SelectItem value="7d">近7天</SelectItem>
              <SelectItem value="30d">近30天</SelectItem>
              <SelectItem value="90d">近90天</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadStatistics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            导出报告
          </Button>
        </div>
      </div>

      {/* 主要统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">
                总章节数
              </CardTitle>
              <FileText className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.chapters.total || 0}</div>
            <div className="text-sm text-gray-500 mt-1">
              已完成 {stats?.chapters.completed || 0}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{
                  width: `${getStatusProgress(
                    stats?.chapters.completed || 0,
                    stats?.chapters.total || 0
                  )}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">
                总字数
              </CardTitle>
              <FileText className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((stats?.chapters.totalWords || 0) / 1000).toFixed(1)}K
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {stats?.chapters.totalWords?.toLocaleString() || 0} 字
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">
                生成次数
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.generations.total || 0}</div>
            <div className="text-sm text-gray-500 mt-1">
              已完成 {stats?.generations.completed || 0}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{
                  width: `${getStatusProgress(
                    stats?.generations.completed || 0,
                    stats?.generations.total || 0
                  )}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">
                审查次数
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.reviews.total || 0}</div>
            <div className="text-sm text-gray-500 mt-1">
              已完成 {stats?.reviews.completed || 0}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-purple-600 h-2 rounded-full"
                style={{
                  width: `${getStatusProgress(
                    stats?.reviews.completed || 0,
                    stats?.reviews.total || 0
                  )}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计 */}
      <Tabs defaultValue="chapters">
        <TabsList>
          <TabsTrigger value="chapters">章节统计</TabsTrigger>
          <TabsTrigger value="generations">生成历史</TabsTrigger>
          <TabsTrigger value="reviews">审查统计</TabsTrigger>
          <TabsTrigger value="compliance">合规检查</TabsTrigger>
        </TabsList>

        <TabsContent value="chapters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>章节完成情况</CardTitle>
              <CardDescription>文档各章节的完成状态统计</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-blue-600 rounded" />
                    <span>已完成章节</span>
                  </div>
                  <span className="font-medium">{stats?.chapters.completed || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-gray-200 rounded" />
                    <span>未完成章节</span>
                  </div>
                  <span className="font-medium">
                    {(stats?.chapters.total || 0) - (stats?.chapters.completed || 0)}
                  </span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">完成率</span>
                    <span className="text-2xl font-bold">
                      {getStatusProgress(
                        stats?.chapters.completed || 0,
                        stats?.chapters.total || 0
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full"
                      style={{
                        width: `${getStatusProgress(
                          stats?.chapters.completed || 0,
                          stats?.chapters.total || 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>生成历史</CardTitle>
              <CardDescription>文档生成的历史记录和统计</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats?.generations.total || 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">总生成次数</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {stats?.generations.completed || 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">成功次数</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {(stats?.generations.total || 0) - (stats?.generations.completed || 0)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">失败次数</div>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">成功率</span>
                    <span className="text-2xl font-bold">
                      {getStatusProgress(
                        stats?.generations.completed || 0,
                        stats?.generations.total || 0
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full"
                      style={{
                        width: `${getStatusProgress(
                          stats?.generations.completed || 0,
                          stats?.generations.total || 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>审查统计</CardTitle>
              <CardDescription>文档审查的统计信息</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {stats?.reviews.total || 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">总审查次数</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {stats?.reviews.completed || 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">已完成</div>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">完成率</span>
                    <span className="text-2xl font-bold">
                      {getStatusProgress(
                        stats?.reviews.completed || 0,
                        stats?.reviews.total || 0
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-purple-600 h-3 rounded-full"
                      style={{
                        width: `${getStatusProgress(
                          stats?.reviews.completed || 0,
                          stats?.reviews.total || 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>合规检查</CardTitle>
              <CardDescription>文档合规性的检查统计</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {stats?.compliance.total || 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">总检查项</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {stats?.compliance.passed || 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">通过</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {stats?.compliance.failed || 0}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">未通过</div>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">通过率</span>
                    <span className="text-2xl font-bold">
                      {getStatusProgress(
                        stats?.compliance.passed || 0,
                        stats?.compliance.total || 0
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full"
                      style={{
                        width: `${getStatusProgress(
                          stats?.compliance.passed || 0,
                          stats?.compliance.total || 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

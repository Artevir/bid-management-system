/**
 * 投标文档概览面板
 * 展示投标文档的完整信息和操作入口
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  History,
  Shield,
  Download,
  Edit,
  Eye,
  MoreHorizontal,
  Plus,
  Settings,
} from 'lucide-react';

interface DocumentOverview {
  id: number;
  name: string;
  status: string;
  version: number;
  progress: number;
  totalChapters: number;
  completedChapters: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DocumentDetail extends DocumentOverview {
  projectId: number;
  chapters: Array<{
    id: number;
    title: string;
    type: string | null;
    wordCount: number;
    isCompleted: boolean;
    isRequired: boolean;
  }>;
  approvalFlows: Array<{
    id: number;
    level: number;
    status: string;
    assigneeName: string;
    assignedAt: string;
    dueDate: string | null;
    completedAt: string | null;
  }>;
  generationHistories: Array<{
    id: number;
    generationConfig: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    createdAt: string;
  }>;
  reviews: Array<{
    id: number;
    type: string;
    score: number | null;
    status: string;
    reviewedAt: string | null;
    createdAt: string;
  }>;
}

interface DocumentOverviewPanelProps {
  documentId: number;
}

export function DocumentOverviewPanel({ documentId }: DocumentOverviewPanelProps) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDocumentDetail();
  }, [documentId]);

  const loadDocumentDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bid/documents/${documentId}`);
      const data = await response.json();
      if (data.success) {
        setDetail(data.data);
      }
    } catch (error) {
      console.error('Failed to load document detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500',
      editing: 'bg-blue-500',
      reviewing: 'bg-yellow-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500',
      published: 'bg-purple-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '草稿',
      editing: '编辑中',
      reviewing: '审批中',
      approved: '已通过',
      rejected: '已拒绝',
      published: '已发布',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">未找到文档信息</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 文档标题栏 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{detail.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            <Badge className={getStatusColor(detail.status)}>
              {getStatusLabel(detail.status)}
            </Badge>
            <span className="text-sm text-gray-500">版本 {detail.version}</span>
            <span className="text-sm text-gray-500">
              创建于 {new Date(detail.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            编辑
          </Button>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            预览
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 文档进度卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              总体进度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{detail.progress}%</div>
            <Progress value={detail.progress} className="mt-2" />
            <p className="text-xs text-gray-500 mt-2">
              {detail.completedChapters}/{detail.totalChapters} 章节
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              章节数量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{detail.totalChapters}</div>
            <p className="text-xs text-gray-500 mt-2">
              {detail.completedChapters} 已完成
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              总字数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(detail.wordCount / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {detail.wordCount.toLocaleString()} 字
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              生成次数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {detail.generationHistories.length}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {detail.generationHistories.filter((h) => h.status === 'completed').length} 完成
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 详细信息标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="chapters">章节</TabsTrigger>
          <TabsTrigger value="approval">审批</TabsTrigger>
          <TabsTrigger value="generation">生成</TabsTrigger>
          <TabsTrigger value="review">审查</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>文档概览</CardTitle>
              <CardDescription>
                文档的基本信息和当前状态
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">文档名称</p>
                  <p className="font-medium">{detail.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">文档状态</p>
                  <Badge className={getStatusColor(detail.status)}>
                    {getStatusLabel(detail.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">创建时间</p>
                  <p className="font-medium">
                    {new Date(detail.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">更新时间</p>
                  <p className="font-medium">
                    {new Date(detail.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="h-20 flex-col">
                  <FileText className="h-6 w-6 mb-2" />
                  <span>查看解读</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Plus className="h-6 w-6 mb-2" />
                  <span>添加章节</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col">
                  <Settings className="h-6 w-6 mb-2" />
                  <span>文档设置</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chapters" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>章节列表</CardTitle>
                <CardDescription>
                  文档的章节结构和内容
                </CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                添加章节
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {detail.chapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {chapter.isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">{chapter.title}</p>
                        <p className="text-sm text-gray-500">
                          {chapter.wordCount} 字
                          {chapter.isRequired && (
                            <Badge variant="outline" className="ml-2">
                              必填
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      编辑
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>审批流程</CardTitle>
              <CardDescription>
                文档的审批状态和历史记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {detail.approvalFlows.map((flow) => (
                  <div
                    key={flow.id}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    <div className="flex flex-col items-center">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        flow.status === 'completed' ? 'bg-green-100 text-green-600' :
                        flow.status === 'pending' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {flow.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : flow.status === 'pending' ? (
                          <Clock className="h-5 w-5" />
                        ) : (
                          <AlertCircle className="h-5 w-5" />
                        )}
                      </div>
                      {flow.level < detail.approvalFlows.length && (
                        <div className="w-0.5 h-12 bg-gray-200 mt-2" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            第 {flow.level} 级审批
                          </p>
                          <p className="text-sm text-gray-500">
                            审批人: {flow.assigneeName}
                          </p>
                        </div>
                        <Badge
                          variant={
                            flow.status === 'completed' ? 'default' :
                            flow.status === 'pending' ? 'secondary' :
                            'destructive'
                          }
                        >
                          {flow.status === 'completed' ? '已完成' :
                           flow.status === 'pending' ? '待审批' :
                           '已拒绝'}
                        </Badge>
                      </div>
                      {flow.dueDate && (
                        <p className="text-sm text-gray-500 mt-2">
                          截止时间: {new Date(flow.dueDate).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>生成历史</CardTitle>
              <CardDescription>
                文档的生成记录和状态
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {detail.generationHistories.map((history) => (
                  <div
                    key={history.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <History className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">
                          生成记录 #{history.id}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(history.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        history.status === 'completed' ? 'default' :
                        history.status === 'in_progress' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {history.status === 'completed' ? '已完成' :
                       history.status === 'in_progress' ? '生成中' :
                       '失败'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>审查记录</CardTitle>
              <CardDescription>
                文档的审查结果和评分
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {detail.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">{review.type}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(review.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {review.score !== null && (
                        <Badge variant="outline">
                          {review.score} 分
                        </Badge>
                      )}
                      <Badge
                        variant={
                          review.status === 'completed' ? 'default' : 'secondary'
                        }
                      >
                        {review.status === 'completed' ? '已完成' : '进行中'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>文档设置</CardTitle>
              <CardDescription>
                配置文档的各项参数
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">文档设置功能正在开发中...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * 投标文档概览面板
 * 展示投标文档的完整信息和操作入口
 */

'use client';

import { useState } from 'react';
import { useDocument } from '@/hooks/use-bid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Download,
  Edit,
  Eye,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { BID_STATUS_MAP } from '@/lib/constants/bid-ui';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface DocumentOverviewPanelProps {
  documentId: number;
}

export function DocumentOverviewPanel({ documentId }: DocumentOverviewPanelProps) {
  const { data: detail, isLoading: loading } = useDocument(documentId);
  const [activeTab, setActiveTab] = useState('overview');

  const getStatusInfo = (status: string) => {
    return BID_STATUS_MAP[status] || { label: status, color: 'bg-gray-500' };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
        <p>未找到文档信息</p>
      </div>
    );
  }

  const statusInfo = getStatusInfo(detail.status);

  return (
    <div className="space-y-6">
      {/* 文档标题栏 */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{detail.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Badge className={cn(statusInfo.color, "text-white border-none")}>
              {statusInfo.label}
            </Badge>
            <span className="text-sm text-muted-foreground">版本 {detail.version}</span>
            <span className="text-sm text-muted-foreground">
              创建于 {new Date(detail.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/bid/${detail.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              编辑
            </Link>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              总体进度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{detail.progress}%</div>
            <Progress value={detail.progress} className="mt-3 h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-2">
              {detail.completedChapters}/{detail.totalChapters} 章节已完成
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              章节结构
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{detail.totalChapters}</div>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] text-muted-foreground">{detail.completedChapters} 已完成</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              内容字数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(detail.wordCount / 1000).toFixed(1)}K
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              共 {detail.wordCount.toLocaleString()} 字
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              AI 生成
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {detail.generationHistories.length}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {detail.generationHistories.filter((h) => h.status === 'completed').length} 次成功生成
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 详细信息标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-card rounded-lg border shadow-sm">
        <div className="px-4 pt-4">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto p-1 bg-muted/50">
            <TabsTrigger value="overview" className="py-2">概览</TabsTrigger>
            <TabsTrigger value="chapters" className="py-2">章节</TabsTrigger>
            <TabsTrigger value="approval" className="py-2">审批</TabsTrigger>
            <TabsTrigger value="generation" className="py-2">生成</TabsTrigger>
            <TabsTrigger value="review" className="py-2">审查</TabsTrigger>
            <TabsTrigger value="settings" className="py-2">设置</TabsTrigger>
          </TabsList>
        </div>

        <div className="p-6">
          <TabsContent value="overview" className="mt-0 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  基本信息
                </h3>
                <div className="grid grid-cols-2 gap-y-4 text-sm bg-accent/5 p-4 rounded-lg border">
                  <div>
                    <p className="text-muted-foreground mb-1">文档名称</p>
                    <p className="font-medium">{detail.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">当前状态</p>
                    <Badge className={cn(statusInfo.color, "text-white")}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">创建时间</p>
                    <p className="font-medium">
                      {new Date(detail.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">更新时间</p>
                    <p className="font-medium">
                      {new Date(detail.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  快速操作
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild>
                    <Link href={`/bid/${detail.id}/edit`}>
                      <Edit className="w-4 h-4 mr-2" />
                      <div className="text-left">
                        <div className="text-xs font-bold">继续编辑</div>
                        <div className="text-[10px] text-muted-foreground">进入编辑器</div>
                      </div>
                    </Link>
                  </Button>
                  {/* 其他快捷操作按钮... */}
                </div>
              </section>
            </div>
          </TabsContent>
          
          {/* 其他 TabsContent 逻辑可按需实现或拆分为子组件 */}
        </div>
      </Tabs>
    </div>
  );
}

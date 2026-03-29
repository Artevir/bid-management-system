'use client';

import { useState, useEffect, useCallback as _useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { generationProgressService, type GenerationProgress } from '@/lib/services/generation-progress-service';

interface GenerationProgressDisplayProps {
  documentId: number;
  onComplete?: (progress: GenerationProgress) => void;
  onError?: (error: string) => void;
}

export function GenerationProgressDisplay({
  documentId,
  onComplete,
  onError,
}: GenerationProgressDisplayProps) {
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/bid/documents/${documentId}/generation-progress`
    );

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.data) {
          setProgress(update.data);

          // 处理完成状态
          if (update.data.status === 'completed') {
            eventSource.close();
            onComplete?.(update.data);
          }

          // 处理失败状态
          if (update.data.status === 'failed') {
            eventSource.close();
            onError?.('生成失败');
          }
        }
      } catch (error) {
        console.error('Parse SSE error:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [documentId, onComplete, onError]);

  if (!progress) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">正在连接生成服务...</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = () => {
    switch (progress.status) {
      case 'preparing':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            准备中
          </Badge>
        );
      case 'generating':
        return (
          <Badge variant="default" className="bg-blue-500">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            生成中
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            已完成
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            失败
          </Badge>
        );
      default:
        return <Badge variant="outline">{progress.status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文档生成进度
          </CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription>{progress.currentStep}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>总体进度</span>
            <span>{progress.percentage}%</span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
        </div>

        {/* 当前章节 */}
        {progress.currentChapter && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium">正在生成章节</div>
            <div className="text-lg mt-1">{progress.currentChapter.title}</div>
            <div className="text-sm text-muted-foreground mt-1">
              第 {progress.currentChapter.index} / {progress.currentChapter.total} 章
            </div>
          </div>
        )}

        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">已生成章节</div>
            <div className="text-lg font-medium">
              {progress.statistics.generatedChapters} / {progress.statistics.totalChapters}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">总字数</div>
            <div className="text-lg font-medium">
              {progress.statistics.totalWordCount.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">已用时间</div>
            <div className="text-lg font-medium">
              {generationProgressService.formatElapsedTime(progress.statistics.elapsedTime)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">预计剩余</div>
            <div className="text-lg font-medium">
              {generationProgressService.formatRemainingTime(progress.statistics.estimatedRemaining)}
            </div>
          </div>
        </div>

        {/* 错误列表 */}
        {progress.errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>生成警告 ({progress.errors.length})</span>
            </div>
            <ScrollArea className="h-24 rounded border p-2">
              {progress.errors.map((error, index) => (
                <div key={index} className="text-xs py-1 border-b last:border-0">
                  <div className="font-medium">{error.chapterTitle}</div>
                  <div className="text-muted-foreground">{error.error}</div>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        {/* 连接状态 */}
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          {connected ? '实时连接' : '连接断开'}
        </div>
      </CardContent>
    </Card>
  );
}

export default GenerationProgressDisplay;

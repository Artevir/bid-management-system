/**
 * 流式内容渲染组件
 * 支持打字机效果和实时更新
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Pause,
  Play,
  Copy,
  Check,
  FileText,
} from 'lucide-react';
import type { StreamIssue } from '@/hooks/use-stream-llm';

// ============================================
// 流式内容显示组件
// ============================================

interface StreamContentProps {
  content: string;
  isStreaming: boolean;
  progress?: number;
  currentPhase?: string | null;
  error?: string | null;
  wordCount?: number;
  title?: string;
  placeholder?: string;
  className?: string;
  showProgress?: boolean;
  onAbort?: () => void;
}

export function StreamContent({
  content,
  isStreaming,
  progress = 0,
  currentPhase,
  error,
  wordCount,
  title = 'AI生成内容',
  placeholder = '等待AI生成内容...',
  className,
  showProgress = true,
  onAbort,
}: StreamContentProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className={cn('relative', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{title}</CardTitle>
            {isStreaming && (
              <Badge variant="secondary" className="animate-pulse">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                生成中
              </Badge>
            )}
            {!isStreaming && content && (
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                完成
              </Badge>
            )}
            {error && (
              <Badge variant="destructive">
                <AlertCircle className="mr-1 h-3 w-3" />
                错误
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {wordCount && wordCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {wordCount} 字
              </span>
            )}
            {content && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-2"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {isStreaming && onAbort && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAbort}
                className="h-8"
              >
                <Pause className="mr-1 h-3 w-3" />
                停止
              </Button>
            )}
          </div>
        </div>
        {showProgress && isStreaming && (
          <div className="mt-2 space-y-1">
            {currentPhase && (
              <p className="text-sm text-muted-foreground">{currentPhase}</p>
            )}
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
            <p className="font-medium">生成失败</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : content ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap">
              {content}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            {isStreaming ? (
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>{placeholder}</p>
              </div>
            ) : (
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{placeholder}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// 流式审校结果组件
// ============================================

interface StreamReviewResultProps {
  issues: StreamIssue[];
  isStreaming: boolean;
  progress?: number;
  currentPhase?: string | null;
  score?: number;
  error?: string | null;
  className?: string;
  onAbort?: () => void;
}

export function StreamReviewResult({
  issues,
  isStreaming,
  progress = 0,
  currentPhase,
  score,
  error,
  className,
  onAbort,
}: StreamReviewResultProps) {
  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');
  const infos = issues.filter((i) => i.type === 'info');

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">审校结果</CardTitle>
            {isStreaming && (
              <Badge variant="secondary" className="animate-pulse">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                审校中
              </Badge>
            )}
            {!isStreaming && score !== undefined && (
              <Badge
                variant={score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive'}
              >
                {score}分
              </Badge>
            )}
          </div>
          {isStreaming && onAbort && (
            <Button variant="outline" size="sm" onClick={onAbort}>
              <Pause className="mr-1 h-3 w-3" />
              停止
            </Button>
          )}
        </div>
        {isStreaming && (
          <div className="mt-2 space-y-1">
            {currentPhase && (
              <p className="text-sm text-muted-foreground">{currentPhase}</p>
            )}
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
            <p className="font-medium">审校失败</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : issues.length > 0 || isStreaming ? (
          <div className="space-y-4">
            {/* 统计信息 */}
            {!isStreaming && (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                  <p className="text-2xl font-bold text-red-600">{errors.length}</p>
                  <p className="text-sm text-muted-foreground">错误</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <p className="text-2xl font-bold text-yellow-600">{warnings.length}</p>
                  <p className="text-sm text-muted-foreground">警告</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <p className="text-2xl font-bold text-blue-600">{infos.length}</p>
                  <p className="text-sm text-muted-foreground">提示</p>
                </div>
              </div>
            )}

            {/* 问题列表 */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className={cn(
                    'p-3 rounded-lg border',
                    issue.type === 'error' && 'border-red-200 bg-red-50 dark:bg-red-950',
                    issue.type === 'warning' && 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950',
                    issue.type === 'info' && 'border-blue-200 bg-blue-50 dark:bg-blue-950'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {issue.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />}
                    {issue.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                    {issue.type === 'info' && <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />}
                    <div className="flex-1">
                      {issue.location.chapterTitle && (
                        <p className="text-sm font-medium text-muted-foreground">
                          {issue.location.chapterTitle}
                        </p>
                      )}
                      <p className="text-sm">{issue.message}</p>
                      {issue.suggestion && (
                        <p className="text-sm text-muted-foreground mt-1">
                          建议: {issue.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>审校完成，未发现问题</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// 流式生成控制面板组件
// ============================================

interface StreamControlPanelProps {
  isStreaming: boolean;
  onStart: () => void;
  onAbort?: () => void;
  onReset?: () => void;
  startLabel?: string;
  abortLabel?: string;
  resetLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function StreamControlPanel({
  isStreaming,
  onStart,
  onAbort,
  onReset,
  startLabel = '开始生成',
  abortLabel = '停止',
  resetLabel = '重置',
  disabled = false,
  className,
}: StreamControlPanelProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {!isStreaming ? (
        <Button onClick={onStart} disabled={disabled}>
          <Play className="mr-2 h-4 w-4" />
          {startLabel}
        </Button>
      ) : (
        onAbort && (
          <Button variant="destructive" onClick={onAbort}>
            <Pause className="mr-2 h-4 w-4" />
            {abortLabel}
          </Button>
        )
      )}
      {onReset && !isStreaming && (
        <Button variant="outline" onClick={onReset}>
          {resetLabel}
        </Button>
      )}
    </div>
  );
}

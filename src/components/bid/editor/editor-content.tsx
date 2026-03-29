'use client';

import { useState as _useState } from 'react';
import { ChapterTree } from '@/types/bid';
import { Card, CardContent, CardHeader as _CardHeader, CardTitle as _CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIInlineEditor } from '@/components/editor/ai-inline-editor';
import { Progress } from '@/components/ui/progress';
import { 
  Wand2, 
  Save, 
  RefreshCw, 
  Pause, 
  Clock as _Clock, 
  CheckCircle as _CheckCircle,
  FileText 
} from 'lucide-react';

interface EditorContentProps {
  chapter: ChapterTree | null;
  onUpdate: (data: Partial<ChapterTree>) => void;
  onGenerate: () => void;
  isSaving: boolean;
  isGenerating: boolean;
  streamingContent: string;
  streamProgress: number;
  onStopGeneration: () => void;
}

export function EditorContent({
  chapter,
  onUpdate,
  onGenerate,
  isSaving,
  isGenerating,
  streamingContent,
  streamProgress,
  onStopGeneration,
}: EditorContentProps) {
  
  if (!chapter) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-accent/5">
        <FileText className="w-12 h-12 mb-4 opacity-20" />
        <p>请从左侧选择一个章节进行编辑</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="p-4 border-b bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6">
            {chapter.serialNumber || '无编号'}
          </Badge>
          <h2 className="text-lg font-bold truncate max-w-[400px]">
            {chapter.title}
          </h2>
          {chapter.isCompleted ? (
            <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
              已完成
            </Badge>
          ) : (
            <Badge variant="secondary">编辑中</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            <Wand2 className="w-4 h-4 mr-2 text-primary" />
            AI 生成
          </Button>
          <Button
            size="sm"
            onClick={() => onUpdate({ isCompleted: !chapter.isCompleted })}
            disabled={isSaving}
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {chapter.isCompleted ? '取消完成' : '标记完成'}
          </Button>
        </div>
      </header>

      {isGenerating && (
        <div className="px-4 py-2 bg-primary/5 border-b shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <RefreshCw className="w-3 h-3 animate-spin" />
              AI 正在努力生成中...
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs text-destructive hover:bg-destructive/10"
              onClick={onStopGeneration}
            >
              <Pause className="w-3 h-3 mr-1" />
              停止生成
            </Button>
          </div>
          <Progress value={streamProgress} className="h-1" />
        </div>
      )}

      <main className="flex-1 overflow-hidden p-6 bg-accent/5">
        <Card className="h-full shadow-none border-none bg-transparent">
          <CardContent className="p-0 h-full">
            <AIInlineEditor
              value={(chapter as any).content || ''}
              onChange={(content) => onUpdate({ ...chapter, content } as any)}
              placeholder="请输入章节内容，或使用 AI 生成..."
              streamingContent={streamingContent}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

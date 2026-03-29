'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sparkles,
  Wand2,
  RefreshCw,
  Pause,
  Replace,
  Plus,
  MessageSquare,
  Bot,
  ChevronDown,
  X,
} from 'lucide-react';

interface AIAgent {
  id: number;
  name: string;
  code: string;
  description?: string;
  agentRole?: string;
  agentAvatar?: string;
  agentGreeting?: string;
  agentDescription?: string;
  agentSkills?: string;
}

interface AIInlineEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  chapterId?: number;
  chapterTitle?: string;
  streamingContent?: string;
}

// AI角色标签映射
const AGENT_ROLE_LABELS: Record<string, { label: string; color: string }> = {
  sales_director: { label: '销售总监', color: 'bg-blue-500' },
  presales_director: { label: '售前总监', color: 'bg-purple-500' },
  finance_director: { label: '财务总监', color: 'bg-green-500' },
  customer: { label: '客户', color: 'bg-orange-500' },
  auditor: { label: '审核员', color: 'bg-red-500' },
  technical_expert: { label: '技术专家', color: 'bg-cyan-500' },
  legal_advisor: { label: '法律顾问', color: 'bg-amber-500' },
  project_manager: { label: '项目经理', color: 'bg-indigo-500' },
  bid_specialist: { label: '投标专员', color: 'bg-pink-500' },
  custom: { label: '自定义', color: 'bg-gray-500' },
};

export function AIInlineEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  chapterId,
  chapterTitle,
  streamingContent: _externalStreamingContent,
}: AIInlineEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [showFloatingBar, setShowFloatingBar] = useState(false);
  const [floatingBarPos, setFloatingBarPos] = useState({ top: 0, left: 0 });
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [mode, setMode] = useState<'insert' | 'replace'>('insert');
  
  // AI生成相关状态
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 加载AI角色列表
  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/prompts/templates?isAgent=true&status=published&pageSize=100');
      const data = await res.json();
      if (data.items) {
        setAgents(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch AI agents:', error);
    }
  };

  // 监听文本选择
  const handleSelect = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    if (selectedText.length > 0) {
      setSelection({ start, end, text: selectedText });
      setShowFloatingBar(true);
      
      // 计算浮动栏位置
      const rect = textarea.getBoundingClientRect();
      const lines = value.substring(0, start).split('\n');
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
      const charWidth = 8; // 估算字符宽度
      const currentLine = lines.length;
      const currentCol = lines[lines.length - 1].length;
      
      setFloatingBarPos({
        top: rect.top + (currentLine * lineHeight) - textarea.scrollTop - 50,
        left: rect.left + Math.min(currentCol * charWidth, rect.width - 200),
      });
    } else {
      setShowFloatingBar(false);
      setSelection(null);
    }
  }, [value]);

  // 打开AI生成对话框
  const handleOpenAIDialog = (dialogMode: 'insert' | 'replace') => {
    setMode(dialogMode);
    setPrompt(dialogMode === 'replace' && selection ? `优化/改写选中的内容：${selection.text.substring(0, 100)}...` : '');
    setAiDialogOpen(true);
    setShowFloatingBar(false);
  };

  // 执行AI生成
  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setIsStreaming(true);
    setStreamingContent('');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/bid/ai-inline-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          context: {
            chapterId,
            chapterTitle,
            selectedText: selection?.text,
            surroundingContext: selection ? {
              before: value.substring(Math.max(0, selection.start - 200), selection.start),
              after: value.substring(selection.end, Math.min(value.length, selection.end + 200)),
            } : undefined,
          },
          agentId: selectedAgentId ? parseInt(selectedAgentId) : undefined,
          mode,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text' && data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === 'complete') {
                // 流式完成，插入/替换内容
                insertContent(fullContent);
              } else if (data.type === 'error') {
                alert(data.error || '生成失败');
              }
            } catch (e) {
              // 可能是纯文本
              const textContent = line.slice(6);
              if (textContent && !textContent.startsWith('{')) {
                fullContent += textContent;
                setStreamingContent(fullContent);
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Failed to generate:', error);
        alert('生成失败');
      }
    } finally {
      setGenerating(false);
      setIsStreaming(false);
      setAiDialogOpen(false);
    }
  };

  // 插入或替换内容
  const insertContent = (content: string) => {
    if (mode === 'replace' && selection) {
      // 替换选中内容
      const newValue = value.substring(0, selection.start) + content + value.substring(selection.end);
      onChange(newValue);
    } else {
      // 在光标位置插入
      const textarea = textareaRef.current;
      const cursorPos = textarea?.selectionStart ?? value.length;
      const newValue = value.substring(0, cursorPos) + content + value.substring(cursorPos);
      onChange(newValue);
    }
    setSelection(null);
  };

  // 停止生成
  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setGenerating(false);
      setIsStreaming(false);
    }
  };

  // 获取选中的AI角色信息
  const selectedAgent = agents.find(a => a.id.toString() === selectedAgentId);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onSelect={handleSelect}
        onClick={handleSelect}
        onKeyUp={handleSelect}
        placeholder={placeholder}
        className={className}
      />

      {/* 浮动工具栏 */}
      {showFloatingBar && selection && (
        <div
          className="fixed z-50 animate-in fade-in-0 zoom-in-95"
          style={{ top: floatingBarPos.top, left: floatingBarPos.left }}
        >
          <Card className="shadow-lg">
            <CardContent className="p-1.5 flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenAIDialog('replace')}
                className="h-8"
              >
                <Replace className="mr-1.5 h-3.5 w-3.5" />
                AI替换
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenAIDialog('insert')}
                className="h-8"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                AI插入
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFloatingBar(false)}
                className="h-8"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI生成对话框 */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              {mode === 'replace' ? 'AI替换内容' : 'AI生成内容'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'replace' && selection
                ? `将替换选中的 ${selection.text.length} 个字符`
                : '在光标位置插入AI生成的内容'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
              {/* AI角色选择 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI角色
                </Label>
                <Select
                  value={selectedAgentId}
                  onValueChange={setSelectedAgentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择AI角色（可选，不选则直接调用大模型）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">直接调用大模型</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        <div className="flex items-center gap-2">
                          {agent.agentRole && AGENT_ROLE_LABELS[agent.agentRole] && (
                            <span className={`w-2 h-2 rounded-full ${AGENT_ROLE_LABELS[agent.agentRole].color}`} />
                          )}
                          <span>{agent.name}</span>
                          {agent.agentRole && (
                            <Badge variant="outline" className="text-xs">
                              {AGENT_ROLE_LABELS[agent.agentRole]?.label || agent.agentRole}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAgent && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">{selectedAgent.name}</p>
                    {selectedAgent.agentDescription && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedAgent.agentDescription}
                      </p>
                    )}
                    {selectedAgent.agentSkills && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedAgent.agentSkills.split(',').map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {skill.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 提示词输入 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  生成指令
                </Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    mode === 'replace'
                      ? '描述如何改写选中的内容，例如：将这段内容改写得更专业、更简洁...'
                      : '描述你想生成的内容，例如：生成一段技术方案介绍...'
                  }
                  className="min-h-[120px]"
                />
              </div>

              {/* 选中的文本预览 */}
              {mode === 'replace' && selection && (
                <div className="space-y-2">
                  <Label>选中的内容</Label>
                  <div className="p-3 bg-muted/30 rounded-lg max-h-[100px] overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{selection.text}</p>
                  </div>
                </div>
              )}

              {/* 流式输出预览 */}
              {isStreaming && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>生成结果</Label>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleAbort}
                    >
                      <Pause className="mr-1 h-3 w-3" />
                      停止
                    </Button>
                  </div>
                  <Progress value={undefined} className="h-1 animate-pulse" />
                  <div className="p-3 bg-muted/50 rounded-lg min-h-[100px] max-h-[200px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm">
                      {streamingContent}
                      <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  开始生成
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

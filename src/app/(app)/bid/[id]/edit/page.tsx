'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  ChevronRight,
  ChevronDown,
  FileText,
  Plus,
  Trash2,
  Wand2,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  Save,
  Eye,
  Pause,
  Copy,
  Building,
  Tag,
  Sparkles,
  Bot,
} from 'lucide-react';
import { AIInlineEditor } from '@/components/editor/ai-inline-editor';

interface Chapter {
  id: number;
  documentId: number;
  parentId?: number;
  serialNumber?: string;
  title: string;
  content?: string;
  type?: string;
  level: number;
  order: number;
  isRequired: boolean;
  isCompleted: boolean;
  children?: Chapter[];
}

interface Document {
  id: number;
  projectId: number;
  project?: { id: number; name: string };
  name: string;
  type: string;
  status: string;
  version: number;
}

interface PromptTemplate {
  id: number;
  name: string;
  code: string;
  description?: string;
  modelProvider?: string;
  modelName?: string;
}

interface Company {
  id: number;
  name: string;
  shortName?: string;
}

interface Tag {
  id: number;
  name: string;
  color?: string;
}

export default function BidEditorPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = parseInt(params.id as string);

  const [document, setDocument] = useState<Document | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamProgress, setStreamProgress] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  
  // AI生成配置 - 增强版
  const [aiConfig, setAiConfig] = useState({
    style: 'formal',
    useKnowledge: true,
    templateId: '' as string,
    parameters: {} as Record<string, string>,
    companyId: '' as string,
    tags: [] as string[],
  });
  
  // 可选项数据
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    fetchDocument();
    fetchChapters();
  }, [documentId]);

  useEffect(() => {
    // 当打开AI对话框时，加载选项数据
    if (aiDialogOpen) {
      fetchOptions();
    }
  }, [aiDialogOpen]);

  async function fetchDocument() {
    try {
      const response = await fetch(`/api/bid/documents/${documentId}`);
      const data = await response.json();
      setDocument(data.document);
    } catch (error) {
      console.error('Failed to fetch document:', error);
    }
  }

  async function fetchChapters() {
    try {
      const response = await fetch(`/api/bid/documents/${documentId}/chapters`);
      const data = await response.json();
      setChapters(data.chapters || []);
    } catch (error) {
      console.error('Failed to fetch chapters:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOptions() {
    setLoadingOptions(true);
    try {
      // 并行获取提示词模板、公司列表、标签列表
      const [templatesRes, companiesRes, tagsRes] = await Promise.all([
        fetch('/api/bid/chapters/1/generate'), // 使用任意章节ID获取模板列表
        fetch('/api/companies?pageSize=100'),
        fetch('/api/tags?pageSize=100'),
      ]);

      const templatesData = await templatesRes.json();
      const companiesData = await companiesRes.json();
      const tagsData = await tagsRes.json();

      if (templatesData.success) {
        setTemplates(templatesData.data || []);
      }
      if (companiesData.success) {
        setCompanies(companiesData.data?.list || []);
      }
      if (tagsData.success) {
        setAvailableTags(tagsData.data?.list || []);
      }
    } catch (error) {
      console.error('Failed to fetch options:', error);
    } finally {
      setLoadingOptions(false);
    }
  }

  async function handleCreateChapter(parentId?: number) {
    const title = prompt('请输入章节标题:');
    if (!title) return;

    try {
      const response = await fetch('/api/bid/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          parentId,
          title,
          level: parentId ? 2 : 1,
        }),
      });

      if (response.ok) {
        fetchChapters();
      }
    } catch (error) {
      console.error('Failed to create chapter:', error);
    }
  }

  async function handleUpdateChapter(chapter: Chapter) {
    setSaving(true);
    try {
      await fetch(`/api/bid/chapters/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: chapter.title,
          content: chapter.content,
          serialNumber: chapter.serialNumber,
          isRequired: chapter.isRequired,
          isCompleted: chapter.isCompleted,
        }),
      });

      // 更新本地状态
      setChapters((prev) =>
        prev.map((c) => (c.id === chapter.id ? chapter : c))
      );
    } catch (error) {
      console.error('Failed to update chapter:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteChapter(chapterId: number) {
    if (!confirm('确定要删除此章节吗？')) return;

    try {
      await fetch(`/api/bid/chapters/${chapterId}`, { method: 'DELETE' });
      setSelectedChapter(null);
      fetchChapters();
    } catch (error) {
      console.error('Failed to delete chapter:', error);
    }
  }

  async function handleGenerateContent() {
    if (!selectedChapter) return;

    setGenerating(true);
    setIsStreaming(true);
    setStreamingContent('');
    setStreamProgress(0);
    setAiDialogOpen(false);

    // 创建AbortController用于取消请求
    abortControllerRef.current = new AbortController();

    try {
      // 使用新的章节生成API
      const response = await fetch(`/api/bid/chapters/${selectedChapter.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: selectedChapter.id,
          templateId: aiConfig.templateId ? parseInt(aiConfig.templateId) : undefined,
          parameters: aiConfig.parameters,
          companyId: aiConfig.companyId ? parseInt(aiConfig.companyId) : undefined,
          tags: aiConfig.tags.map(id => parseInt(id)),
          useKnowledge: aiConfig.useKnowledge,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析SSE消息
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
                // 流式完成，保存内容
                setSelectedChapter({
                  ...selectedChapter,
                  content: fullContent,
                });
                await handleUpdateChapter({
                  ...selectedChapter,
                  content: fullContent,
                });
              } else if (data.type === 'error') {
                alert(data.error || '生成失败');
              }
            } catch (e) {
              // 可能是纯文本内容
              if (line.startsWith('data: ')) {
                const textContent = line.slice(6);
                if (textContent && !textContent.startsWith('{')) {
                  fullContent += textContent;
                  setStreamingContent(fullContent);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Failed to generate content:', error);
        alert('生成失败');
      }
    } finally {
      setGenerating(false);
      setIsStreaming(false);
      setStreamProgress(0);
    }
  }

  function handleAbortGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setGenerating(false);
      setIsStreaming(false);
    }
  }

  async function handleOptimizeContent(type: string) {
    if (!selectedChapter || !selectedChapter.content) return;

    setGenerating(true);
    setIsStreaming(true);
    setStreamingContent('');
    setStreamProgress(0);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/bid/generate?action=optimize&stream=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: selectedChapter.id,
          optimizationType: type,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
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
                setSelectedChapter({
                  ...selectedChapter,
                  content: fullContent,
                });
                await handleUpdateChapter({
                  ...selectedChapter,
                  content: fullContent,
                });
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', line);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to optimize content:', error);
      }
    } finally {
      setGenerating(false);
      setIsStreaming(false);
      setStreamProgress(0);
    }
  }

  async function handleSubmitForApproval() {
    if (!confirm('确定要提交审核吗？')) return;

    try {
      const response = await fetch('/api/bid/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (response.ok) {
        router.push(`/bid/${documentId}`);
      }
    } catch (error) {
      console.error('Failed to submit for approval:', error);
    }
  }

  function toggleExpand(chapterId: number) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }

  function renderChapterTree(chapters: Chapter[], level = 0): React.ReactNode[] {
    return chapters.map((chapter) => {
      const isExpanded = expandedChapters.has(chapter.id);
      const hasChildren = chapter.children && chapter.children.length > 0;
      const isSelected = selectedChapter?.id === chapter.id;

      return (
        <div key={chapter.id}>
          <div
            className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-accent ${
              isSelected ? 'bg-accent' : ''
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => setSelectedChapter(chapter)}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(chapter.id);
                }}
                className="p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">
              {chapter.serialNumber && `${chapter.serialNumber} `}
              {chapter.title}
            </span>
            {chapter.isRequired && (
              <span className="text-xs text-red-500">必填</span>
            )}
            {chapter.isCompleted && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </div>
          {hasChildren && isExpanded && renderChapterTree(chapter.children!, level + 1)}
        </div>
      );
    });
  }

  // 切换标签选择
  function toggleTag(tagId: string) {
    setAiConfig(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }));
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* 头部 */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">{document?.name}</h1>
          <Badge variant="outline">
            {document?.project?.name || '未关联项目'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/bid/${documentId}`)}>
            <Eye className="mr-2 h-4 w-4" />
            预览
          </Button>
          <Button onClick={handleSubmitForApproval}>
            <Send className="mr-2 h-4 w-4" />
            提交审核
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧章节树 */}
        <div className="w-64 border-r overflow-y-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <span className="font-medium text-sm">章节结构</span>
            <Button size="sm" variant="ghost" onClick={() => handleCreateChapter()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="py-2">
            {renderChapterTree(chapters)}
            {chapters.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无章节
              </div>
            )}
          </div>
        </div>

        {/* 右侧编辑区 */}
        <div className="flex-1 flex flex-col">
          {selectedChapter ? (
            <>
              <div className="border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Input
                    value={selectedChapter.serialNumber || ''}
                    onChange={(e) =>
                      setSelectedChapter({
                        ...selectedChapter,
                        serialNumber: e.target.value,
                      })
                    }
                    onBlur={() => handleUpdateChapter(selectedChapter)}
                    placeholder="章节编号"
                    className="w-24"
                  />
                  <Input
                    value={selectedChapter.title}
                    onChange={(e) =>
                      setSelectedChapter({
                        ...selectedChapter,
                        title: e.target.value,
                      })
                    }
                    onBlur={() => handleUpdateChapter(selectedChapter)}
                    placeholder="章节标题"
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-4">
                    <Label className="text-sm">必填</Label>
                    <Switch
                      checked={selectedChapter.isRequired}
                      onCheckedChange={(checked) => {
                        setSelectedChapter({
                          ...selectedChapter,
                          isRequired: checked,
                        });
                        handleUpdateChapter({
                          ...selectedChapter,
                          isRequired: checked,
                        });
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAiDialogOpen(true)}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    AI生成
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteChapter(selectedChapter.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="content" className="flex-1 flex flex-col">
                <div className="border-b px-6">
                  <TabsList>
                    <TabsTrigger value="content">内容编辑</TabsTrigger>
                    <TabsTrigger value="optimize">AI优化</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="content" className="flex-1 p-6 m-0 relative">
                  {/* 流式内容显示 */}
                  {isStreaming && (
                    <div className="absolute inset-0 bg-background/80 z-10 flex flex-col">
                      <div className="flex-1 p-6 overflow-y-auto">
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <div className="whitespace-pre-wrap">
                            {streamingContent}
                            <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border-t bg-background">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-sm">AI正在生成内容...</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-48">
                              <Progress value={streamProgress} className="h-1.5" />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {streamingContent.length} 字
                            </span>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleAbortGeneration}
                            >
                              <Pause className="mr-1 h-3 w-3" />
                              停止
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* AI增强编辑器 - 支持选中文字后AI生成/替换 */}
                  <AIInlineEditor
                    value={selectedChapter.content || ''}
                    onChange={(value) =>
                      setSelectedChapter({
                        ...selectedChapter,
                        content: value,
                      })
                    }
                    onBlur={() => handleUpdateChapter(selectedChapter)}
                    placeholder="请输入章节内容，选中文本可使用AI生成或替换..."
                    className="h-full resize-none"
                    chapterId={selectedChapter.id}
                    chapterTitle={selectedChapter.title}
                  />
                </TabsContent>

                <TabsContent value="optimize" className="flex-1 p-6 m-0">
                  {/* 流式优化内容显示 */}
                  {isStreaming && (
                    <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm">AI正在优化内容...</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAbortGeneration}
                        >
                          <Pause className="mr-1 h-3 w-3" />
                          停止
                        </Button>
                      </div>
                      <Progress value={streamProgress} className="h-1.5 mb-3" />
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <div className="whitespace-pre-wrap">
                          {streamingContent}
                          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid gap-4">
                    <p className="text-sm text-muted-foreground">
                      选择优化类型，AI将自动优化当前内容
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        onClick={() => handleOptimizeContent('expand')}
                        disabled={generating || !selectedChapter.content}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                        扩充内容
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleOptimizeContent('simplify')}
                        disabled={generating || !selectedChapter.content}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                        精简内容
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleOptimizeContent('polish')}
                        disabled={generating || !selectedChapter.content}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                        润色优化
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleOptimizeContent('format')}
                        disabled={generating || !selectedChapter.content}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                        格式优化
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>选择左侧章节开始编辑</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI生成对话框 - 增强版 */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI辅助生成
            </DialogTitle>
            <DialogDescription>
              选择提示词模板、关联公司和标签，AI将自动生成章节内容
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 py-4">
              {/* 提示词模板选择 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  提示词模板
                </Label>
                <Select
                  value={aiConfig.templateId}
                  onValueChange={(value) =>
                    setAiConfig({ ...aiConfig, templateId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择提示词模板（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">不使用模板（默认生成）</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                        {template.modelProvider && (
                          <span className="text-muted-foreground ml-2">
                            ({template.modelProvider})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {aiConfig.templateId && (
                  <p className="text-xs text-muted-foreground">
                    {templates.find(t => t.id.toString() === aiConfig.templateId)?.description}
                  </p>
                )}
              </div>

              {/* 公司归属 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  归属公司
                </Label>
                <Select
                  value={aiConfig.companyId}
                  onValueChange={(value) =>
                    setAiConfig({ ...aiConfig, companyId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择归属公司（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">不指定公司</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                        {company.shortName && (
                          <span className="text-muted-foreground ml-2">
                            ({company.shortName})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  选择公司后，AI会结合公司信息生成内容
                </p>
              </div>

              {/* 标签选择 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  关联标签
                </Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
                  {availableTags.length === 0 ? (
                    <span className="text-sm text-muted-foreground">暂无可用标签</span>
                  ) : (
                    availableTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={aiConfig.tags.includes(tag.id.toString()) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        style={tag.color ? { backgroundColor: aiConfig.tags.includes(tag.id.toString()) ? tag.color : 'transparent', borderColor: tag.color } : {}}
                        onClick={() => toggleTag(tag.id.toString())}
                      >
                        {tag.name}
                      </Badge>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  点击标签进行选择，已选 {aiConfig.tags.length} 个
                </p>
              </div>

              {/* 写作风格（仅在不使用模板时显示） */}
              {!aiConfig.templateId && (
                <div className="space-y-2">
                  <Label>写作风格</Label>
                  <Select
                    value={aiConfig.style}
                    onValueChange={(value) =>
                      setAiConfig({ ...aiConfig, style: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">正式规范</SelectItem>
                      <SelectItem value="professional">专业严谨</SelectItem>
                      <SelectItem value="persuasive">有说服力</SelectItem>
                      <SelectItem value="technical">技术详尽</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 使用知识库 */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label>使用知识库</Label>
                  <p className="text-sm text-muted-foreground">
                    从知识库检索相关内容作为参考
                  </p>
                </div>
                <Switch
                  checked={aiConfig.useKnowledge}
                  onCheckedChange={(checked) =>
                    setAiConfig({ ...aiConfig, useKnowledge: checked })
                  }
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleGenerateContent} disabled={generating || loadingOptions}>
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
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

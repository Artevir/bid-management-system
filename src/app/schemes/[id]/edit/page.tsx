'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import {
  Card as _Card,
  CardContent as _CardContent,
  CardHeader as _CardHeader,
  CardTitle as _CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Save,
  Send,
  Sparkles,
  Plus,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Edit as _Edit,
  Trash2,
  FileText,
  Folder as _Folder,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator as _DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// 章节接口
interface Chapter {
  id: number;
  schemeId: number;
  parentId: number | null;
  title: string;
  content: string;
  serialNumber: string;
  sortOrder: number;
  status: 'draft' | 'editing' | 'review' | 'final';
  wordCount: number;
  children?: Chapter[];
}

// 方案接口
interface Scheme {
  id: number;
  title: string;
  categoryId: number | null;
  category?: { id: number; name: string };
  stage: 'draft' | 'editing' | 'review' | 'final';
  source: 'manual' | 'upload' | 'ai_generate';
  isTemplate: boolean;
  version: number;
  status: 'active' | 'archived';
  description: string;
  tags?: Array<{ id: number; name: string }>;
  chapters?: Chapter[];
}

// 阶段配置
const stageConfig: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  editing: { label: '编辑中', color: 'bg-blue-100 text-blue-700' },
  review: { label: '审核中', color: 'bg-yellow-100 text-yellow-700' },
  final: { label: '定稿', color: 'bg-green-100 text-green-700' },
};

export default function SchemeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const _router = useRouter();
  const schemeId = parseInt(id, 10);

  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');

  // 章节对话框
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [chapterForm, setChapterForm] = useState({
    title: '',
    parentId: null as number | null,
    serialNumber: '',
  });

  // AI生成对话框
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiForm, setAiForm] = useState({
    mode: 'default' as 'default' | 'llm',
    prompt: '',
    chapterId: null as number | null,
  });
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    loadScheme();
    loadChapters();
  }, [schemeId]);

  const loadScheme = async () => {
    try {
      const res = await fetch(`/api/schemes/${schemeId}`);
      const data = await res.json();
      if (data.scheme) {
        setScheme(data.scheme);
      }
    } catch (error) {
      console.error('加载方案失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const loadChapters = async () => {
    try {
      const res = await fetch(`/api/schemes/${schemeId}?chapters=true`);
      const data = await res.json();
      if (data.chapters) {
        // 构建树形结构
        const tree = buildChapterTree(data.chapters);
        setChapters(tree);
      }
    } catch (error) {
      console.error('加载章节失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    }
  };

  const buildChapterTree = (chapters: Chapter[]): Chapter[] => {
    const map = new Map<number, Chapter>();
    const roots: Chapter[] = [];

    chapters.forEach((ch) => {
      map.set(ch.id, { ...ch, children: [] });
    });

    chapters.forEach((ch) => {
      const node = map.get(ch.id)!;
      if (ch.parentId === null) {
        roots.push(node);
      } else {
        const parent = map.get(ch.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      }
    });

    return roots;
  };

  const handleSelectChapter = async (chapter: Chapter) => {
    if (selectedChapter && content !== selectedChapter.content) {
      // 保存当前编辑内容
      await handleSaveContent();
    }

    setSelectedChapter(chapter);
    setContent(chapter.content || '');
  };

  const handleSaveContent = async () => {
    if (!selectedChapter) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/schemes/chapters/${selectedChapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.success) {
        // 更新本地状态
        setSelectedChapter({ ...selectedChapter, content });
      }
    } catch (error) {
      console.error('保存失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateChapter = async () => {
    if (!chapterForm.title.trim()) return;

    try {
      const res = await fetch('/api/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createChapter',
          schemeId,
          ...chapterForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChapterDialogOpen(false);
        setChapterForm({ title: '', parentId: null, serialNumber: '' });
        loadChapters();
      }
    } catch (error) {
      console.error('创建章节失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    }
  };

  const handleDeleteChapter = async (chapterId: number) => {
    if (!confirm('确定要删除此章节吗？')) return;

    try {
      const res = await fetch(`/api/schemes/chapters/${chapterId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        loadChapters();
        if (selectedChapter?.id === chapterId) {
          setSelectedChapter(null);
        }
      }
    } catch (error) {
      console.error('删除章节失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    }
  };

  const handleAIGenerate = async () => {
    if (!aiForm.prompt.trim()) {
      alert('请输入生成提示');
      return;
    }

    setAiGenerating(true);
    try {
      // TODO: 集成真实的 AI 生成接口
      // 这里需要根据技能文档集成 LLM 服务
      const res = await fetch('/api/schemes/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId,
          chapterId: aiForm.chapterId,
          prompt: aiForm.prompt,
          mode: aiForm.mode,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      let generatedContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        generatedContent += chunk;
        setContent(generatedContent);
      }

      setAiDialogOpen(false);
      setAiForm({ mode: 'default', prompt: '', chapterId: null });
    } catch (error) {
      console.error('AI生成失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
      alert('生成失败，请重试');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleUpdateStage = async (stage: Scheme['stage']) => {
    try {
      const res = await fetch(`/api/schemes/${schemeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (data.success) {
        setScheme({ ...scheme!, stage });
      }
    } catch (error) {
      console.error('更新状态失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    }
  };

  const toggleChapterExpand = (chapterId: number) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  // 渲染章节树
  const renderChapterTree = (nodes: Chapter[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedChapters.has(node.id);
      const isSelected = selectedChapter?.id === node.id;
      const hasChildren = node.children && node.children.length > 0;

      return (
        <div key={node.id}>
          <div
            className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md hover:bg-gray-100 ${
              isSelected ? 'bg-blue-50 text-blue-700' : ''
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => handleSelectChapter(node)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleChapterExpand(node.id);
                }}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {!hasChildren && <span className="w-5" />}
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm flex-1 truncate">
              {node.serialNumber && `${node.serialNumber} `}
              {node.title}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDeleteChapter(node.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {hasChildren && isExpanded && renderChapterTree(node.children!, level + 1)}
        </div>
      );
    });
  };

  if (error) {
    return <ListStateBlock state="error" error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">方案不存在</div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* 顶部工具栏 */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/schemes">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{scheme.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={stageConfig[scheme.stage]?.color}>
                  {stageConfig[scheme.stage]?.label}
                </Badge>
                {scheme.isTemplate && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-700">
                    模板
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={scheme.stage} onValueChange={(value) => handleUpdateStage(value as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="editing">编辑中</SelectItem>
                <SelectItem value="review">审核中</SelectItem>
                <SelectItem value="final">定稿</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSaveContent} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button>
              <Send className="h-4 w-4 mr-2" />
              提交审核
            </Button>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧章节树 */}
        <div className="w-64 border-r bg-white flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="font-medium text-sm">章节目录</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setChapterForm({ ...chapterForm, parentId: null });
                setChapterDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto py-2">
            {chapters.length === 0 ? (
              <ListStateBlock state="empty" emptyText="暂无章节" />
            ) : (
              renderChapterTree(chapters)
            )}
          </div>
        </div>

        {/* 右侧编辑区 */}
        <div className="flex-1 flex flex-col">
          {selectedChapter ? (
            <>
              <div className="p-3 border-b bg-white">
                <h2 className="font-medium">
                  {selectedChapter.serialNumber && `${selectedChapter.serialNumber} `}
                  {selectedChapter.title}
                </h2>
                <div className="text-sm text-gray-500 mt-1">字数：{content.length}</div>
              </div>
              <div className="flex-1 p-4">
                <Tabs defaultValue="edit" className="h-full flex flex-col">
                  <TabsList className="mb-2">
                    <TabsTrigger value="edit">编辑</TabsTrigger>
                    <TabsTrigger value="preview">预览</TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit" className="flex-1">
                    <div className="h-full flex flex-col">
                      <div className="mb-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiForm({ ...aiForm, chapterId: selectedChapter.id });
                            setAiDialogOpen(true);
                          }}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          AI 生成
                        </Button>
                      </div>
                      <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="请输入内容..."
                        className="flex-1 resize-none"
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="preview" className="flex-1">
                    <div className="prose max-w-none p-4 border rounded-md min-h-full bg-white">
                      {content || <span className="text-gray-400">暂无内容</span>}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <p>请选择章节进行编辑</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 创建章节对话框 */}
      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建章节</DialogTitle>
            <DialogDescription>添加新的方案章节</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="chapter-title">章节标题 *</Label>
              <Input
                id="chapter-title"
                value={chapterForm.title}
                onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                placeholder="请输入章节标题"
              />
            </div>
            <div>
              <Label htmlFor="chapter-serial">章节编号</Label>
              <Input
                id="chapter-serial"
                value={chapterForm.serialNumber}
                onChange={(e) => setChapterForm({ ...chapterForm, serialNumber: e.target.value })}
                placeholder="如：1.1、2.1.1"
              />
            </div>
            <div>
              <Label htmlFor="chapter-parent">父级章节</Label>
              <Select
                value={chapterForm.parentId?.toString() || 'none'}
                onValueChange={(value) =>
                  setChapterForm({
                    ...chapterForm,
                    parentId: value === 'none' ? null : parseInt(value),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="不选择父级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不选择父级</SelectItem>
                  {chapters.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id.toString()}>
                      {ch.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateChapter}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 生成对话框 */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 生成内容</DialogTitle>
            <DialogDescription>使用 AI 智能生成章节内容</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ai-mode">生成模式</Label>
              <Select
                value={aiForm.mode}
                onValueChange={(value) => setAiForm({ ...aiForm, mode: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">系统默认</SelectItem>
                  <SelectItem value="llm">调用大模型</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ai-prompt">生成提示 *</Label>
              <Textarea
                id="ai-prompt"
                value={aiForm.prompt}
                onChange={(e) => setAiForm({ ...aiForm, prompt: e.target.value })}
                placeholder="描述你想要生成的内容，例如：根据项目背景，编写技术实施方案章节..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAIGenerate} disabled={aiGenerating}>
              {aiGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
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

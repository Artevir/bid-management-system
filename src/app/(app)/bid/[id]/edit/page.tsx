'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  useDocument, 
  useChapters, 
  useUpdateChapter, 
  useCreateChapter, 
  useDeleteChapter 
} from '@/hooks/use-bid';
import { ChapterSidebar } from '@/components/bid/editor/chapter-sidebar';
import { EditorContent } from '@/components/bid/editor/editor-content';
import { AIConfigDialog } from '@/components/bid/editor/ai-config-dialog';
import { ChapterTree } from '@/types/bid';
import { Skeleton } from '@/components/ui/skeleton';
import { bidService } from '@/lib/api/bid-service';
import { toast } from 'sonner';

export default function BidEditorPage() {
  const params = useParams();
  const documentId = parseInt(params.id as string);

  // --- 服务端状态 (TanStack Query) ---
  const { data: document, isLoading: loadingDoc } = useDocument(documentId);
  const { data: chapters = [], isLoading: loadingChapters } = useChapters(documentId);
  
  const updateChapterMutation = useUpdateChapter();
  const createChapterMutation = useCreateChapter();
  const deleteChapterMutation = useDeleteChapter();

  // --- 本地交互状态 ---
  const [selectedChapter, setSelectedChapter] = useState<ChapterTree | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  
  // AI 生成流式状态
  const [streamingContent, setStreamingContent] = useState('');
  const [streamProgress, setStreamProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 模拟选项数据 (实际项目中应从 API 获取)
  const [options, setOptions] = useState({
    templates: [],
    companies: [],
    availableTags: []
  });

  // 加载选项数据
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [companiesRes, tagsRes] = await Promise.all([
          fetch('/api/companies?pageSize=100').then(res => res.json()),
          fetch('/api/tags?pageSize=100').then(res => res.json()),
        ]);
        setOptions({
          templates: [{ id: 1, name: '通用投标响应模板' }],
          companies: companiesRes.data?.list || [],
          availableTags: tagsRes.data?.list || [],
        });
      } catch (e) {
        console.error('Failed to fetch editor options', e);
      }
    };
    fetchOptions();
  }, []);

  // --- 事件处理 ---
  const handleToggleExpand = (id: number) => {
    const newSet = new Set(expandedChapters);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedChapters(newSet);
  };

  const handleUpdateChapter = async (data: Partial<ChapterTree>) => {
    if (!selectedChapter) return;
    await updateChapterMutation.mutateAsync({
      id: selectedChapter.id,
      documentId,
      data
    });
    // 更新选中的章节状态，以便 UI 即时反馈
    setSelectedChapter({ ...selectedChapter, ...data } as ChapterTree);
  };

  const handleCreateChapter = async (parentId?: number) => {
    const title = prompt('请输入章节标题:');
    if (!title) return;
    await createChapterMutation.mutateAsync({
      documentId,
      parentId,
      title,
    });
  };

  const handleDeleteChapter = async (id: number) => {
    if (!confirm('确定要删除此章节及其所有子章节吗？')) return;
    await deleteChapterMutation.mutateAsync({ id, documentId });
    if (selectedChapter?.id === id) setSelectedChapter(null);
  };

  // --- AI 生成逻辑 (流式处理优化) ---
  const handleGenerate = async (config: any) => {
    if (!selectedChapter) return;

    setIsGenerating(true);
    setStreamingContent('');
    setStreamProgress(0);
    
    abortControllerRef.current = new AbortController();

    try {
      const response = await bidService.generateChapter(
        selectedChapter.id, 
        config, 
        abortControllerRef.current.signal
      );

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullText += chunk;
        setStreamingContent(fullText);
        setStreamProgress(prev => Math.min(prev + 5, 95)); // 模拟进度

        // 增量快照保存 (每 500 字保存一次到本地，防止丢失)
        if (fullText.length % 500 < chunk.length) {
          localStorage.setItem(`bid_stream_snapshot_${selectedChapter.id}`, fullText);
        }
      }

      // 生成完成，保存内容
      await handleUpdateChapter({ content: fullText } as any);
      setStreamProgress(100);
      localStorage.removeItem(`bid_stream_snapshot_${selectedChapter.id}`);
      toast.success('AI 生成内容已同步');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // 如果是中途停止，询问是否保留已生成的部分
        const snapshot = localStorage.getItem(`bid_stream_snapshot_${selectedChapter.id}`) || streamingContent;
        if (snapshot && confirm('生成已停止，是否保留已生成的内容？')) {
          await handleUpdateChapter({ content: snapshot } as any);
        }
        toast.info('AI 生成已停止');
      } else {
        toast.error('AI 生成失败: ' + error.message);
      }
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
    }
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  if (loadingDoc || loadingChapters) {
    return (
      <div className="flex h-[calc(100vh-64px)] gap-4 p-4">
        <Skeleton className="w-64 h-full" />
        <Skeleton className="flex-1 h-full" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* 左侧侧边栏 */}
      <aside className="w-72 shrink-0">
        <ChapterSidebar
          chapters={chapters}
          selectedId={selectedChapter?.id}
          expandedIds={expandedChapters}
          onSelect={setSelectedChapter}
          onToggleExpand={handleToggleExpand}
          onCreateChapter={handleCreateChapter}
          onDeleteChapter={handleDeleteChapter}
        />
      </aside>

      {/* 右侧主编辑区 */}
      <main className="flex-1 min-w-0">
        <EditorContent
          chapter={selectedChapter}
          onUpdate={handleUpdateChapter}
          onGenerate={() => setAiDialogOpen(true)}
          isSaving={updateChapterMutation.isPending}
          isGenerating={isGenerating}
          streamingContent={streamingContent}
          streamProgress={streamProgress}
          onStopGeneration={handleStopGeneration}
        />
      </main>

      {/* AI 配置弹窗 */}
      <AIConfigDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onGenerate={handleGenerate}
        templates={options.templates}
        companies={options.companies}
        availableTags={options.availableTags}
      />
    </div>
  );
}

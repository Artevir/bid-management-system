'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader as _DialogHeader,
  DialogTitle as _DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  FolderOpen,
  BookOpen,
  CheckCircle,
  Search,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'project' | 'document' | 'knowledge' | 'approval';
  title: string;
  description?: string;
  href: string;
  icon: React.ElementType;
}

// 模拟搜索结果
const mockSearchResults: SearchResult[] = [
  {
    id: '1',
    type: 'project',
    title: '某市智慧城市建设项目',
    description: '投标截止: 2026-03-25',
    href: '/projects/1',
    icon: FolderOpen,
  },
  {
    id: '2',
    type: 'document',
    title: '技术方案书.docx',
    description: '项目: 智慧城市建设',
    href: '/bid/1/edit',
    icon: FileText,
  },
  {
    id: '3',
    type: 'knowledge',
    title: '智慧城市技术架构模板',
    description: '技术方案 · 已审核',
    href: '/knowledge/1',
    icon: BookOpen,
  },
  {
    id: '4',
    type: 'approval',
    title: '待审核: 商务标书',
    description: '提交人: 张三 · 2小时前',
    href: '/approval',
    icon: CheckCircle,
  },
];

const recentSearches = [
  '智慧城市',
  '技术方案',
  '商务标书',
];

const typeColors: Record<string, string> = {
  project: 'bg-blue-500',
  document: 'bg-green-500',
  knowledge: 'bg-purple-500',
  approval: 'bg-orange-500',
};

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 监听打开搜索的事件
  React.useEffect(() => {
    const handleOpenSearch = () => setOpen(true);
    window.addEventListener('open-search', handleOpenSearch);
    return () => window.removeEventListener('open-search', handleOpenSearch);
  }, []);

  // 监听关闭弹窗事件
  React.useEffect(() => {
    const handleCloseModal = () => setOpen(false);
    window.addEventListener('close-modal', handleCloseModal);
    return () => window.removeEventListener('close-modal', handleCloseModal);
  }, []);

  // 打开时聚焦输入框
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // 搜索
  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchTimer = setTimeout(() => {
      setLoading(true);
      // 模拟搜索
      const filtered = mockSearchResults.filter(
        item =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
      setLoading(false);
      setSelectedIndex(0);
    }, 200);

    return () => clearTimeout(searchTimer);
  }, [query]);

  // 键盘导航
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    router.push(result.href);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        {/* 搜索输入框 */}
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索项目、文档、知识库..."
            className="border-0 focus-visible:ring-0 px-0 text-base"
          />
          <Badge variant="secondary" className="ml-2">
            ESC
          </Badge>
        </div>

        {/* 搜索结果或快捷入口 */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : query.trim() ? (
            results.length > 0 ? (
              <div className="p-2">
                {results.map((result, index) => {
                  const Icon = result.icon;
                  return (
                    <div
                      key={result.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                        index === selectedIndex
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className={cn('p-2 rounded-lg', typeColors[result.type])}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.title}</p>
                        {result.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {result.description}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>未找到匹配 "{query}" 的结果</p>
              </div>
            )
          ) : (
            <div className="p-4">
              {/* 快捷入口 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  快捷入口
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <QuickLink
                    icon={FolderOpen}
                    label="项目管理"
                    href="/projects"
                    onClick={() => setOpen(false)}
                  />
                  <QuickLink
                    icon={FileText}
                    label="标书文档"
                    href="/bid"
                    onClick={() => setOpen(false)}
                  />
                  <QuickLink
                    icon={BookOpen}
                    label="知识库"
                    href="/knowledge"
                    onClick={() => setOpen(false)}
                  />
                  <QuickLink
                    icon={CheckCircle}
                    label="审核中心"
                    href="/approval"
                    onClick={() => setOpen(false)}
                  />
                </div>
              </div>

              {/* 最近搜索 */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  最近搜索
                </h4>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <Badge
                      key={term}
                      variant="secondary"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleRecentClick(term)}
                    >
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd>
              导航
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd>
              选择
            </span>
          </div>
          <span className="text-muted-foreground">
            Ctrl + K 打开搜索
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 快捷入口组件
function QuickLink({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  onClick: () => void;
}) {
  const router = useRouter();

  return (
    <div
      className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
      onClick={() => {
        onClick();
        router.push(href);
      }}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

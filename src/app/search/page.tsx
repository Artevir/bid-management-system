'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  ArrowLeft,
  FolderOpen,
  FileText,
  BookOpen,
  User,
  File,
  Clock,
  TrendingUp,
  X,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// 类型定义
interface SearchResult {
  id: number;
  type: 'project' | 'document' | 'chapter' | 'knowledge' | 'user';
  title: string;
  description: string;
  url: string;
  highlights?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface SearchResponse {
  data: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  aggregations: {
    byType: Record<string, number>;
  };
}

// 类型图标映射
const typeIcons: Record<string, any> = {
  project: FolderOpen,
  document: FileText,
  chapter: File,
  knowledge: BookOpen,
  user: User,
};

// 类型名称映射
const typeNames: Record<string, string> = {
  project: '项目',
  document: '文档',
  chapter: '章节',
  knowledge: '知识库',
  user: '用户',
};

// 类型颜色映射
const typeColors: Record<string, string> = {
  project: 'bg-blue-100 text-blue-600',
  document: 'bg-green-100 text-green-600',
  chapter: 'bg-purple-100 text-purple-600',
  knowledge: 'bg-orange-100 text-orange-600',
  user: 'bg-cyan-100 text-cyan-600',
};

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hotSearches, setHotSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 加载热门搜索
  useEffect(() => {
    fetchHotSearches();
  }, []);

  // 输入防抖 - 获取搜索建议
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (keyword.length >= 2) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions();
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [keyword]);

  const fetchHotSearches = async () => {
    try {
      const response = await fetch('/api/search?action=hot');
      if (response.ok) {
        const data = await response.json();
        setHotSearches(data);
      }
    } catch (error) {
      console.error('获取热门搜索失败:', error);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`/api/search?action=suggestions&keyword=${encodeURIComponent(keyword)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      }
    } catch (error) {
      console.error('获取搜索建议失败:', error);
    }
  };

  const handleSearch = async (searchKeyword?: string) => {
    const actualKeyword = searchKeyword || keyword;
    if (!actualKeyword.trim()) {
      toast.error('请输入搜索关键词');
      return;
    }

    setLoading(true);
    setShowSuggestions(false);
    setHasSearched(true);

    try {
      const types = searchType === 'all' ? '' : searchType;
      const response = await fetch(
        `/api/search?keyword=${encodeURIComponent(actualKeyword)}&types=${types}&pageSize=50`
      );

      if (!response.ok) throw new Error('搜索失败');

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('搜索失败:', error);
      toast.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setKeyword(suggestion);
    setShowSuggestions(false);
    handleSearch(suggestion);
  };

  const clearSearch = () => {
    setKeyword('');
    setResults(null);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  // 高亮关键词
  const highlightKeyword = (text: string, key: string) => {
    if (!keyword || !text) return text;

    const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === keyword.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 页面头部 */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">全文检索</h1>
          <p className="text-gray-500 text-sm">
            搜索项目、文档、知识库等内容
          </p>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="max-w-3xl mx-auto mb-6">
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                ref={inputRef}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="输入关键词搜索..."
                className="pl-10 pr-10 h-12 text-lg"
              />
              {keyword && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger className="w-32 h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="project">项目</SelectItem>
                <SelectItem value="document">文档</SelectItem>
                <SelectItem value="chapter">章节</SelectItem>
                <SelectItem value="knowledge">知识库</SelectItem>
                <SelectItem value="user">用户</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="lg"
              className="h-12 px-6"
              onClick={() => handleSearch()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : '搜索'}
            </Button>
          </div>

          {/* 搜索建议 */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-24 mt-1 bg-white border rounded-lg shadow-lg z-50">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <Search className="h-4 w-4 text-gray-400" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 热门搜索 */}
      {!hasSearched && (
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-3 text-gray-600">
            <TrendingUp className="h-4 w-4" />
            <span className="font-medium">热门搜索</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {hotSearches.map((hot, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => {
                  setKeyword(hot);
                  handleSearch(hot);
                }}
              >
                {hot}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      {hasSearched && (
        <div className="max-w-3xl mx-auto">
          {/* 结果统计 */}
          {results && (
            <div className="mb-4">
              <p className="text-gray-600">
                找到 <span className="font-bold text-blue-600">{results.total}</span> 条结果
              </p>
              {/* 类型聚合 */}
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge
                  variant={searchType === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSearchType('all')}
                >
                  全部 ({Object.values(results.aggregations.byType).reduce((a, b) => a + b, 0)})
                </Badge>
                {Object.entries(results.aggregations.byType).map(([type, count]) => (
                  count > 0 && (
                    <Badge
                      key={type}
                      variant={searchType === type ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSearchType(type)}
                    >
                      {typeNames[type]} ({count})
                    </Badge>
                  )
                ))}
              </div>
            </div>
          )}

          {/* 结果列表 */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">搜索中...</p>
            </div>
          ) : results?.data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>未找到相关结果</p>
              <p className="text-sm mt-1">请尝试其他关键词</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results?.data.map((result, index) => {
                const TypeIcon = typeIcons[result.type] || File;

                return (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={result.url}
                    className="block"
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn('p-2 rounded-lg', typeColors[result.type])}>
                            <TypeIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-blue-600 hover:underline truncate">
                                {highlightKeyword(result.title, keyword)}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {typeNames[result.type]}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {highlightKeyword(result.description, keyword)}
                            </p>
                            {result.highlights && (
                              <p className="text-sm text-gray-500 mt-1 bg-yellow-50 p-1 rounded">
                                ...{highlightKeyword(result.highlights, keyword)}...
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(result.updatedAt).toLocaleDateString()}
                              </span>
                              {result.tags && result.tags.length > 0 && (
                                <div className="flex gap-1">
                                  {result.tags.slice(0, 3).map((tag, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {/* 分页 */}
          {results && results.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={results.page === 1}
                onClick={() => handleSearch()}
              >
                上一页
              </Button>
              <span className="text-sm text-gray-500">
                第 {results.page} / {results.totalPages} 页
              </span>
              <Button
                variant="outline"
                disabled={results.page === results.totalPages}
                onClick={() => handleSearch()}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

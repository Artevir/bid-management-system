'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BookOpen,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Tag,
  Calendar as _Calendar,
  FolderTree,
  TrendingUp,
  Eye as EyeIcon,
  Users,
} from 'lucide-react';

interface KnowledgeEntry {
  id: number;
  categoryId: number | null;
  category?: { id: number; name: string };
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  source?: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeCategory {
  id: number;
  name: string;
  description?: string;
  parentId: number | null;
  _count?: { entries: number };
}

export default function KnowledgePage() {
  const router = useRouter();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [trending, setTrending] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState({
    title: '',
    content: '',
    categoryId: '',
    tags: '',
    source: '',
  });

  useEffect(() => {
    fetchEntries();
    fetchCategories();
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const [overviewRes, trendingRes] = await Promise.all([
        fetch('/api/knowledge/stats?type=overview'),
        fetch('/api/knowledge/stats?type=trending&topK=5'),
      ]);
      const overviewData = await overviewRes.json();
      const trendingData = await trendingRes.json();
      if (overviewData.success) setStats(overviewData.stats);
      if (trendingData.success) setTrending(trendingData.trending);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }

  async function fetchCategories() {
    try {
      const response = await fetch('/api/knowledge/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }

  async function fetchEntries() {
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const response = await fetch(`/api/knowledge/entries?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setEntries(data.entries || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      fetchEntries();
      return;
    }

    try {
      const response = await fetch(`/api/knowledge/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setEntries(data.results || []);
    } catch (error) {
      console.error('Failed to search:', error);
    }
  }

  async function handleCreateEntry() {
    try {
      const response = await fetch('/api/knowledge/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          tags: createForm.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        setCreateForm({
          title: '',
          content: '',
          categoryId: '',
          tags: '',
          source: '',
        });
        fetchEntries();
      }
    } catch (error) {
      console.error('Failed to create entry:', error);
    }
  }

  async function handleDeleteEntry(id: number) {
    if (!confirm('确定要删除此知识条目吗？')) return;

    try {
      await fetch(`/api/knowledge/entries/${id}`, { method: 'DELETE' });
      fetchEntries();
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  }

  const filteredEntries = entries.filter((entry) => {
    if (selectedCategory !== 'all' && entry.categoryId !== parseInt(selectedCategory)) {
      return false;
    }
    return true;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">知识条目</p>
                  <p className="text-2xl font-bold">{stats.totalItems}</p>
                </div>
                <BookOpen className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总浏览量</p>
                  <p className="text-2xl font-bold">{stats.totalViews}</p>
                </div>
                <EyeIcon className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总使用量</p>
                  <p className="text-2xl font-bold">{stats.totalUses}</p>
                </div>
                <Users className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">热门知识</p>
                  <p className="text-lg font-bold">{trending[0]?.title?.slice(0, 10) || '-'}...</p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">知识库</h1>
          <p className="text-muted-foreground">管理和检索知识资产</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新建条目
        </Button>
      </div>

      {/* 搜索和分类筛选 */}
      <div className="flex gap-4">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="搜索知识条目..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button variant="outline" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 分类概览 */}
      <div className="grid gap-4 md:grid-cols-4">
        {categories.slice(0, 4).map((category) => (
          <Card
            key={category.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedCategory(category.id.toString())}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <FolderTree className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {category._count?.entries || 0} 条条目
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 知识条目列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            知识条目
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ListStateBlock state="loading" />
          ) : filteredEntries.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无知识条目" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>标签</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.title}</TableCell>
                    <TableCell>
                      {entry.category?.name || (
                        <span className="text-muted-foreground">未分类</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {entry.tags?.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {entry.tags?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{entry.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>v{entry.version}</TableCell>
                    <TableCell>{new Date(entry.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedEntry(entry);
                              setViewDialogOpen(true);
                              fetch(`/api/knowledge/track`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ itemId: entry.id, action: 'view' }),
                              });
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            查看
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/knowledge/${entry.id}/edit`)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建条目对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建知识条目</DialogTitle>
            <DialogDescription>创建一个新的知识条目</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="请输入标题"
              />
            </div>
            <div className="space-y-2">
              <Label>分类</Label>
              <Select
                value={createForm.categoryId}
                onValueChange={(value) => setCreateForm({ ...createForm, categoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea
                value={createForm.content}
                onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                placeholder="请输入知识内容"
                rows={8}
              />
            </div>
            <div className="space-y-2">
              <Label>标签</Label>
              <Input
                value={createForm.tags}
                onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                placeholder="用逗号分隔多个标签"
              />
            </div>
            <div className="space-y-2">
              <Label>来源</Label>
              <Input
                value={createForm.source}
                onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
                placeholder="知识来源（可选）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateEntry} disabled={!createForm.title || !createForm.content}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看条目对话框 */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEntry?.title}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-4 mt-2">
                {selectedEntry?.category && (
                  <Badge variant="outline">{selectedEntry.category.name}</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  版本 v{selectedEntry?.version}
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                {selectedEntry?.content}
              </pre>
            </div>
            {selectedEntry?.tags && selectedEntry.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-4">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-1 flex-wrap">
                  {selectedEntry.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Folder,
  Tag,
  FolderTree,
  Hash,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  X,
  Loader2,
  Settings,
  Layers,
  Star,
  StarOff,
  History,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdvancedSearchPanel } from '@/components/tags/advanced-search-panel';
import { FavoritesPanel } from '@/components/tags/favorites-panel';
import { StatisticsPanel } from '@/components/tags/statistics-panel';

// ============================================
// Types
// ============================================

interface Category {
  id: number;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  color: string;
  entityType: string;
  parentId: number | null;
  sortOrder: number;
  tagCount: number;
  children?: Category[];
}

interface Tag {
  id: number;
  name: string;
  code: string | null;
  slug: string | null;
  categoryId: number | null;
  category: {
    id: number;
    name: string;
    color: string;
  } | null;
  parentId: number | null;
  type: string;
  color: string;
  icon: string | null;
  description: string | null;
  useCount: number;
  isSystem: boolean;
  sortOrder: number;
  children?: Tag[];
  isFavorite?: boolean;
}

interface SearchFilters {
  keyword: string;
  categoryIds: number[];
  types: string[];
  colors: string[];
  entityTypes: string[];
  useCountRange: { min?: number; max?: number };
  dateRange: { start?: string; end?: string };
  isSystem?: boolean;
  hasChildren?: boolean;
  sortBy: string;
  sortOrder: string;
}

// ============================================
// Main Component
// ============================================

export default function TagsManagementPage() {
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  
  // Dialog States
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'category' | 'tag'; id: number; name: string } | null>(null);
  const [viewingTagVersions, setViewingTagVersions] = useState<Tag | null>(null);
  
  // Form States
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: '',
    color: '#6366f1',
    entityType: 'project',
    parentId: '',
    sortOrder: 0,
  });
  
  const [tagForm, setTagForm] = useState({
    name: '',
    code: '',
    slug: '',
    categoryId: '',
    parentId: '',
    type: 'tag',
    color: '#6366f1',
    icon: '',
    description: '',
    entityTypes: [] as string[],
    sortOrder: 0,
  });

  // ============================================
  // Data Fetching
  // ============================================

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/tags/categories?tree=true');
      const data = await response.json();
      setCategories(data.items || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  const fetchTags = useCallback(async (filters?: SearchFilters) => {
    setLoading(true);
    try {
      if (filters && Object.keys(filters).some(key => {
        const k = key as keyof SearchFilters;
        const v = filters[k];
        if (k === 'keyword' || k === 'sortBy' || k === 'sortOrder') return false;
        if (typeof v === 'string') return v !== '' && v !== 'name' && v !== 'asc';
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
        return v !== undefined;
      })) {
        // 使用高级搜索
        const response = await fetch('/api/tags/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...filters,
            page: 1,
            pageSize: 100,
          }),
        });
        const data = await response.json();
        setTags(data.items || []);
      } else {
        // 使用普通搜索
        const params = new URLSearchParams();
        if (selectedCategory) {
          params.set('categoryId', selectedCategory.id.toString());
        }
        if (filters?.keyword || searchKeyword) {
          params.set('keyword', filters?.keyword || searchKeyword);
        }
        params.set('pageSize', '100');

        const response = await fetch(`/api/tags?${params.toString()}`);
        const data = await response.json();
        setTags(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchKeyword]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // 记录访问
  const recordVisit = async (entityType: string, entityId: number, entityName: string) => {
    try {
      await fetch('/api/tags/recent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          entityName,
        }),
      });
    } catch (error) {
      console.error('记录访问失败:', error);
    }
  };

  // ============================================
  // Category Operations
  // ============================================

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      code: '',
      description: '',
      color: '#6366f1',
      entityType: 'project',
      parentId: '',
      sortOrder: 0,
    });
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      code: category.code,
      description: category.description || '',
      color: category.color,
      entityType: category.entityType,
      parentId: category.parentId?.toString() || '',
      sortOrder: category.sortOrder,
    });
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    try {
      const url = editingCategory
        ? '/api/tags/categories'
        : '/api/tags/categories';
      
      const method = editingCategory ? 'PUT' : 'POST';
      const body = editingCategory
        ? { id: editingCategory.id, ...categoryForm }
        : categoryForm;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '操作失败');
      }

      setCategoryDialogOpen(false);
      fetchCategories();
    } catch (error: any) {
      alert(error.message || '操作失败');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingItem) return;

    try {
      const response = await fetch(`/api/tags/categories?id=${deletingItem.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      setDeleteDialogOpen(false);
      setDeletingItem(null);
      fetchCategories();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  // ============================================
  // Tag Operations
  // ============================================

  const handleCreateTag = () => {
    setEditingTag(null);
    setTagForm({
      name: '',
      code: '',
      slug: '',
      categoryId: selectedCategory?.id.toString() || '',
      parentId: '',
      type: 'tag',
      color: '#6366f1',
      icon: '',
      description: '',
      entityTypes: [],
      sortOrder: 0,
    });
    setTagDialogOpen(true);
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setTagForm({
      name: tag.name,
      code: tag.code || '',
      slug: tag.slug || '',
      categoryId: tag.categoryId?.toString() || '',
      parentId: tag.parentId?.toString() || '',
      type: tag.type,
      color: tag.color,
      icon: tag.icon || '',
      description: tag.description || '',
      entityTypes: [],
      sortOrder: tag.sortOrder,
    });
    setTagDialogOpen(true);
  };

  const handleSaveTag = async () => {
    try {
      const url = editingTag ? '/api/tags' : '/api/tags';
      const method = editingTag ? 'PUT' : 'POST';
      const body = editingTag
        ? { id: editingTag.id, ...tagForm }
        : tagForm;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '操作失败');
      }

      const data = await response.json();
      
      // 记录访问
      recordVisit('tag', data.item.id, data.item.name);
      
      setTagDialogOpen(false);
      fetchTags();
    } catch (error: any) {
      alert(error.message || '操作失败');
    }
  };

  const handleDeleteTag = async () => {
    if (!deletingItem) return;

    try {
      const response = await fetch(`/api/tags?id=${deletingItem.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      setDeleteDialogOpen(false);
      setDeletingItem(null);
      fetchTags();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedTags.length === 0) return;

    try {
      const response = await fetch(`/api/tags?ids=${selectedTags.join(',')}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '批量删除失败');
      }

      setSelectedTags([]);
      fetchTags();
    } catch (error: any) {
      alert(error.message || '批量删除失败');
    }
  };

  // 收藏/取消收藏
  const handleToggleFavorite = async (tag: Tag) => {
    try {
      if (tag.isFavorite) {
        await fetch(`/api/tags/favorites?entityType=tag&entityId=${tag.id}`, {
          method: 'DELETE',
        });
      } else {
        await fetch('/api/tags/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: 'tag',
            entityId: tag.id,
            entityName: tag.name,
          }),
        });
      }
      
      // 更新本地状态
      setTags(tags.map(t => 
        t.id === tag.id ? { ...t, isFavorite: !t.isFavorite } : t
      ));
    } catch (error) {
      console.error('收藏操作失败:', error);
    }
  };

  // 查看版本历史
  const handleViewVersions = async (tag: Tag) => {
    setViewingTagVersions(tag);
    setVersionDialogOpen(true);
  };

  // 高级搜索
  const handleAdvancedSearch = (filters: SearchFilters) => {
    fetchTags(filters);
  };

  // 选择分类时记录访问
  const handleSelectCategory = (category: Category | null) => {
    setSelectedCategory(category);
    if (category) {
      recordVisit('category', category.id, category.name);
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">标签管理</h1>
            <p className="text-sm text-muted-foreground">
              管理标签分类、标签和实体关联，支持高级搜索、收藏和数据统计
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              高级搜索
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidePanel(!showSidePanel)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {showSidePanel ? '隐藏面板' : '显示面板'}
            </Button>
            <Button variant="outline" onClick={handleCreateCategory}>
              <FolderTree className="h-4 w-4 mr-2" />
              新建分类
            </Button>
            <Button onClick={handleCreateTag}>
              <Plus className="h-4 w-4 mr-2" />
              新建标签
            </Button>
          </div>
        </div>
      </div>

      {/* Advanced Search Panel */}
      {showAdvancedSearch && (
        <div className="border-b px-6 py-4">
          <AdvancedSearchPanel
            categories={categories}
            onSearch={handleAdvancedSearch}
            loading={loading}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Categories */}
        <div className="w-72 border-r bg-muted/30">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              标签分类
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {/* All Tags */}
              <button
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  !selectedCategory
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted'
                )}
                onClick={() => handleSelectCategory(null)}
              >
                <Layers className="h-4 w-4" />
                <span>全部标签</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {tags.length}
                </span>
              </button>

              {/* Category Tree */}
              {categories.map((category) => (
                <CategoryTreeItem
                  key={category.id}
                  category={category}
                  selectedCategory={selectedCategory}
                  onSelect={handleSelectCategory}
                  onEdit={handleEditCategory}
                  onDelete={(cat) => {
                    setDeletingItem({ type: 'category', id: cat.id, name: cat.name });
                    setDeleteDialogOpen(true);
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Center Panel - Tags */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标签..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>

            {selectedTags.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  已选择 {selectedTags.length} 个标签
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTags([])}
                >
                  取消选择
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDelete}
                >
                  批量删除
                </Button>
              </div>
            )}
          </div>

          {/* Tags List */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tags.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Tag className="h-12 w-12 mb-4 opacity-50" />
                <p>暂无标签</p>
                <Button variant="link" onClick={handleCreateTag}>
                  创建第一个标签
                </Button>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tags.map((tag) => (
                  <TagCard
                    key={tag.id}
                    tag={tag}
                    selected={selectedTags.includes(tag.id)}
                    onSelect={(selected) => {
                      if (selected) {
                        setSelectedTags([...selectedTags, tag.id]);
                      } else {
                        setSelectedTags(selectedTags.filter((id) => id !== tag.id));
                      }
                    }}
                    onEdit={handleEditTag}
                    onDelete={(t) => {
                      setDeletingItem({ type: 'tag', id: t.id, name: t.name });
                      setDeleteDialogOpen(true);
                    }}
                    onToggleFavorite={() => handleToggleFavorite(tag)}
                    onViewVersions={() => handleViewVersions(tag)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Panel - Favorites & Stats */}
        {showSidePanel && (
          <div className="w-80 border-l bg-muted/30 flex flex-col">
            <Tabs defaultValue="favorites" className="flex-1 flex flex-col">
              <TabsList className="w-full grid grid-cols-2 m-2">
                <TabsTrigger value="favorites" className="text-xs">
                  <Star className="h-3 w-3 mr-1" />
                  收藏与访问
                </TabsTrigger>
                <TabsTrigger value="stats" className="text-xs">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  数据统计
                </TabsTrigger>
              </TabsList>
              <TabsContent value="favorites" className="flex-1 mt-0">
                <FavoritesPanel
                  onSelectTag={(tagId) => {
                    const tag = tags.find(t => t.id === tagId);
                    if (tag) handleEditTag(tag);
                  }}
                  onSelectCategory={(categoryId) => {
                    const category = categories.find(c => c.id === categoryId);
                    handleSelectCategory(category || null);
                  }}
                />
              </TabsContent>
              <TabsContent value="stats" className="flex-1 mt-0 p-2">
                <StatisticsPanel />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? '编辑分类' : '新建分类'}
            </DialogTitle>
            <DialogDescription>
              创建标签分类，用于组织和管理标签
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">名称 *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">代码</Label>
              <Input
                value={categoryForm.code}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, code: e.target.value })
                }
                placeholder="可选，唯一标识"
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">实体类型</Label>
              <Select
                value={categoryForm.entityType}
                onValueChange={(value) =>
                  setCategoryForm({ ...categoryForm, entityType: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">项目</SelectItem>
                  <SelectItem value="document">文档</SelectItem>
                  <SelectItem value="template">模板</SelectItem>
                  <SelectItem value="scheme">方案</SelectItem>
                  <SelectItem value="bid">投标</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">颜色</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, color: e.target.value })
                  }
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={categoryForm.color}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, color: e.target.value })
                  }
                  className="flex-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">描述</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, description: e.target.value })
                }
                placeholder="分类描述"
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveCategory}>
              {editingCategory ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? '编辑标签' : '新建标签'}
            </DialogTitle>
            <DialogDescription>
              创建标签，用于分类和检索实体
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">名称 *</Label>
              <Input
                value={tagForm.name}
                onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">代码</Label>
              <Input
                value={tagForm.code}
                onChange={(e) => setTagForm({ ...tagForm, code: e.target.value })}
                placeholder="可选，唯一标识"
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">分类</Label>
              <Select
                value={tagForm.categoryId}
                onValueChange={(value) =>
                  setTagForm({ ...tagForm, categoryId: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">无分类</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">类型</Label>
              <Select
                value={tagForm.type}
                onValueChange={(value) => setTagForm({ ...tagForm, type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag">标签</SelectItem>
                  <SelectItem value="directory">目录</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">颜色</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  type="color"
                  value={tagForm.color}
                  onChange={(e) =>
                    setTagForm({ ...tagForm, color: e.target.value })
                  }
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={tagForm.color}
                  onChange={(e) =>
                    setTagForm({ ...tagForm, color: e.target.value })
                  }
                  className="flex-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">描述</Label>
              <Textarea
                value={tagForm.description}
                onChange={(e) =>
                  setTagForm({ ...tagForm, description: e.target.value })
                }
                placeholder="标签描述"
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveTag}>
              {editingTag ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除{deletingItem?.type === 'category' ? '分类' : '标签'} "
              {deletingItem?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={
                deletingItem?.type === 'category'
                  ? handleDeleteCategory
                  : handleDeleteTag
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// Sub Components
// ============================================

interface CategoryTreeItemProps {
  category: Category;
  selectedCategory: Category | null;
  onSelect: (category: Category) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  depth?: number;
}

function CategoryTreeItem({
  category,
  selectedCategory,
  onSelect,
  onEdit,
  onDelete,
  depth = 0,
}: CategoryTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;
  const isSelected = selectedCategory?.id === category.id;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors',
          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-muted-foreground/10 rounded"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {!hasChildren && <span className="w-5" />}

        <div
          className="flex-1 flex items-center gap-2"
          onClick={() => onSelect(category)}
        >
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: category.color }}
          />
          <span className="flex-1 truncate">{category.name}</span>
          <span className="text-xs text-muted-foreground">
            {category.tagCount}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted-foreground/10 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(category)}>
              <Edit className="h-4 w-4 mr-2" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(category)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && expanded && (
        <div>
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              selectedCategory={selectedCategory}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TagCardProps {
  tag: Tag;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
  onToggleFavorite: () => void;
  onViewVersions: () => void;
}

function TagCard({
  tag,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onToggleFavorite,
  onViewVersions,
}: TagCardProps) {
  return (
    <Card
      className={cn(
        'group relative cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary'
      )}
    >
      <div className="absolute top-2 left-2">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <CardHeader className="pb-2 pt-8">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-sm"
            style={{ backgroundColor: tag.color }}
          />
          <CardTitle className="text-base">{tag.name}</CardTitle>
          {tag.isSystem && (
            <Badge variant="secondary" className="text-xs">
              系统
            </Badge>
          )}
          {tag.isFavorite && (
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          {tag.category && (
            <div className="flex items-center gap-2">
              <Folder className="h-3.5 w-3.5" />
              <span>{tag.category.name}</span>
            </div>
          )}

          {tag.code && (
            <div className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">{tag.code}</span>
            </div>
          )}

          {tag.description && (
            <p className="text-xs line-clamp-2">{tag.description}</p>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Badge variant="outline" className="text-xs">
              {tag.type === 'tag' ? '标签' : '目录'}
            </Badge>
            <span className="text-xs ml-auto">
              使用 {tag.useCount} 次
            </span>
          </div>
        </div>

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(tag)}>
                <Edit className="h-4 w-4 mr-2" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleFavorite}>
                {tag.isFavorite ? (
                  <>
                    <StarOff className="h-4 w-4 mr-2" />
                    取消收藏
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4 mr-2" />
                    收藏
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewVersions}>
                <History className="h-4 w-4 mr-2" />
                版本历史
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(tag)}
                disabled={tag.isSystem}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

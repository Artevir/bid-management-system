'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Plus,
  Search,
  Folder,
  FileText,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Archive,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  FolderOpen,
} from 'lucide-react';

// 分类树节点
interface CategoryNode {
  id: number;
  name: string;
  code: string | null;
  parentId: number | null;
  type: 'root' | 'industry' | 'product' | 'template' | 'other';
  children?: CategoryNode[];
}

// 方案
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
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ id: number; name: string }>;
}

// 阶段配置
const stageConfig: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  editing: { label: '编辑中', color: 'bg-blue-100 text-blue-700' },
  review: { label: '审核中', color: 'bg-yellow-100 text-yellow-700' },
  final: { label: '定稿', color: 'bg-green-100 text-green-700' },
};

// 来源配置
const sourceConfig: Record<string, { label: string; color: string }> = {
  manual: { label: '手动创建', color: 'bg-gray-100 text-gray-700' },
  upload: { label: '上传文档', color: 'bg-purple-100 text-purple-700' },
  ai_generate: { label: 'AI生成', color: 'bg-cyan-100 text-cyan-700' },
};

export default function SchemesPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState('all');

  // 分类对话框
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: '',
    parentId: null as number | null,
    type: 'root' as CategoryNode['type'],
  });

  // 创建方案对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [schemeForm, setSchemeForm] = useState({
    title: '',
    categoryId: null as number | null,
    description: '',
    isTemplate: false,
  });

  useEffect(() => {
    loadCategories();
    loadSchemes();
  }, []);

  useEffect(() => {
    loadSchemes();
  }, [selectedCategory, stageFilter, sourceFilter, templateFilter, searchQuery]);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/schemes/categories');
      const data = await res.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const loadSchemes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory.toString());
      if (stageFilter !== 'all') params.append('stage', stageFilter);
      if (sourceFilter !== 'all') params.append('source', sourceFilter);
      if (templateFilter !== 'all') params.append('isTemplate', templateFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/schemes?${params.toString()}`);
      const data = await res.json();
      if (data.schemes) {
        setSchemes(data.schemes);
      }
    } catch (error) {
      console.error('加载方案失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) return;

    try {
      const res = await fetch('/api/schemes/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();
      if (data.success) {
        setCategoryDialogOpen(false);
        setCategoryForm({ name: '', code: '', description: '', parentId: null, type: 'root' });
        loadCategories();
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('创建分类失败:', error);
      alert('创建失败');
    }
  };

  const handleCreateScheme = async () => {
    if (!schemeForm.title.trim()) return;

    try {
      const res = await fetch('/api/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...schemeForm,
          source: 'manual',
          stage: 'draft',
        }),
      });
      const data = await res.json();
      if (data.success && data.scheme) {
        setCreateDialogOpen(false);
        setSchemeForm({ title: '', categoryId: null, description: '', isTemplate: false });
        // 跳转到编辑页面
        window.location.href = `/schemes/${data.scheme.id}/edit`;
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('创建方案失败:', error);
      alert('创建失败');
    }
  };

  const handleDeleteScheme = async (id: number) => {
    if (!confirm('确定要删除此方案吗？删除后无法恢复。')) return;

    try {
      const res = await fetch(`/api/schemes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadSchemes();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除方案失败:', error);
      alert('删除失败');
    }
  };

  const handleArchiveScheme = async (id: number) => {
    try {
      const res = await fetch(`/api/schemes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });
      const data = await res.json();
      if (data.success) {
        loadSchemes();
      } else {
        alert(data.error || '归档失败');
      }
    } catch (error) {
      console.error('归档方案失败:', error);
      alert('归档失败');
    }
  };

  const toggleCategoryExpand = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // 渲染分类树
  const renderCategoryTree = (nodes: CategoryNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedCategories.has(node.id);
      const isSelected = selectedCategory === node.id;
      const hasChildren = node.children && node.children.length > 0;

      return (
        <div key={node.id}>
          <div
            className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md hover:bg-gray-100 ${
              isSelected ? 'bg-blue-50 text-blue-700' : ''
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => setSelectedCategory(node.id)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategoryExpand(node.id);
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
            <Folder className="h-4 w-4 text-yellow-600" />
            <span className="text-sm">{node.name}</span>
          </div>
          {hasChildren && isExpanded && renderCategoryTree(node.children!, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="h-[calc(100vh-80px)] flex">
      {/* 左侧分类树 */}
      <div className="w-64 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">方案分类</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCategoryForm({ ...categoryForm, parentId: selectedCategory });
                setCategoryDialogOpen(true);
              }}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sm"
            onClick={() => setSelectedCategory(null)}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            全部方案
          </Button>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {renderCategoryTree(categories)}
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部工具栏 */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜索方案..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="阶段" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部阶段</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="editing">编辑中</SelectItem>
                  <SelectItem value="review">审核中</SelectItem>
                  <SelectItem value="final">定稿</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  <SelectItem value="manual">手动创建</SelectItem>
                  <SelectItem value="upload">上传文档</SelectItem>
                  <SelectItem value="ai_generate">AI生成</SelectItem>
                </SelectContent>
              </Select>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="true">模板</SelectItem>
                  <SelectItem value="false">普通方案</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新建方案
            </Button>
          </div>
        </div>

        {/* 方案列表 */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : schemes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileText className="h-12 w-12 mb-4" />
              <p>暂无方案</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                创建第一个方案
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schemes.map((scheme) => (
                <Card key={scheme.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base font-medium">
                          <Link href={`/schemes/${scheme.id}/edit`} className="hover:text-blue-600">
                            {scheme.title}
                          </Link>
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {scheme.category?.name || '未分类'}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/schemes/${scheme.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              编辑
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            复制
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleArchiveScheme(scheme.id)}>
                            <Archive className="h-4 w-4 mr-2" />
                            归档
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteScheme(scheme.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline" className={stageConfig[scheme.stage]?.color}>
                        {stageConfig[scheme.stage]?.label}
                      </Badge>
                      <Badge variant="outline" className={sourceConfig[scheme.source]?.color}>
                        {sourceConfig[scheme.source]?.label}
                      </Badge>
                      {scheme.isTemplate && (
                        <Badge variant="outline" className="bg-purple-100 text-purple-700">
                          模板
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {scheme.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag.id} variant="secondary" className="text-xs">
                          {tag.name}
                        </Badge>
                      ))}
                      {scheme.tags && scheme.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{scheme.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                      更新于 {new Date(scheme.updatedAt).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 创建分类对话框 */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分类</DialogTitle>
            <DialogDescription>创建新的方案分类，支持多级分类结构</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">分类名称 *</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="请输入分类名称"
              />
            </div>
            <div>
              <Label htmlFor="category-code">分类编码</Label>
              <Input
                id="category-code"
                value={categoryForm.code}
                onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                placeholder="选填，用于系统标识"
              />
            </div>
            <div>
              <Label htmlFor="category-type">分类类型</Label>
              <Select
                value={categoryForm.type}
                onValueChange={(value) => setCategoryForm({ ...categoryForm, type: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">根分类</SelectItem>
                  <SelectItem value="industry">行业分类</SelectItem>
                  <SelectItem value="product">产品分类</SelectItem>
                  <SelectItem value="template">模板分类</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category-desc">描述</Label>
              <Textarea
                id="category-desc"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="选填"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateCategory}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建方案对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建方案</DialogTitle>
            <DialogDescription>创建新的投标方案文档</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="scheme-title">方案标题 *</Label>
              <Input
                id="scheme-title"
                value={schemeForm.title}
                onChange={(e) => setSchemeForm({ ...schemeForm, title: e.target.value })}
                placeholder="请输入方案标题"
              />
            </div>
            <div>
              <Label htmlFor="scheme-category">所属分类</Label>
              <Select
                value={schemeForm.categoryId?.toString() || 'none'}
                onValueChange={(value) =>
                  setSchemeForm({ ...schemeForm, categoryId: value === 'none' ? null : parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不选择分类</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="scheme-desc">描述</Label>
              <Textarea
                id="scheme-desc"
                value={schemeForm.description}
                onChange={(e) => setSchemeForm({ ...schemeForm, description: e.target.value })}
                placeholder="选填"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="scheme-template"
                checked={schemeForm.isTemplate}
                onChange={(e) => setSchemeForm({ ...schemeForm, isTemplate: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="scheme-template" className="cursor-pointer">
                设为模板
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateScheme}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

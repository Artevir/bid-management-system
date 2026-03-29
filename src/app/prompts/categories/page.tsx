'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader as _CardHeader, CardTitle as _CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FolderTree,
  Plus,
  Search as _Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Tag,
  FileText as _FileText,
  Folder,
} from 'lucide-react';

interface PromptCategory {
  id: number;
  name: string;
  code: string;
  type: string;
  description?: string;
  icon?: string;
  parentId?: number;
  parent?: PromptCategory;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  children?: PromptCategory[];
}

export default function PromptCategoriesPage() {
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [flatCategories, setFlatCategories] = useState<PromptCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState<string>('all');
  const [_treeView, _setTreeView] = useState(true);
  
  // Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'general',
    description: '',
    icon: '',
    parentId: '',
    sortOrder: 0,
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [keyword, type]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      if (type && type !== 'all') params.set('type', type);
      params.set('tree', 'true');

      const res = await fetch(`/api/prompts/categories?${params.toString()}`);
      const data = await res.json();
      
      if (data.items) {
        setCategories(data.items);
        // Also flatten for parent selection
        flattenCategories(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const flattenCategories = (items: PromptCategory[], result: PromptCategory[] = []) => {
    items.forEach((item) => {
      result.push(item);
      if (item.children && item.children.length > 0) {
        flattenCategories(item.children, result);
      }
    });
    setFlatCategories(result);
  };

  const handleCreate = () => {
    setSelectedCategory(null);
    setFormData({
      name: '',
      code: '',
      type: 'general',
      description: '',
      icon: '',
      parentId: '',
      sortOrder: 0,
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (category: PromptCategory) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      code: category.code,
      type: category.type,
      description: category.description || '',
      icon: category.icon || '',
      parentId: category.parentId?.toString() || '',
      sortOrder: category.sortOrder,
    });
    setEditDialogOpen(true);
  };

  const handleDelete = async (category: PromptCategory) => {
    if (!confirm(`确定要删除分类"${category.name}"吗？`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/prompts/categories/${category.id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        fetchCategories();
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleSubmit = async () => {
    setFormLoading(true);
    try {
      const body = {
        ...formData,
        parentId: formData.parentId ? parseInt(formData.parentId) : null,
      };

      const res = await fetch('/api/prompts/categories', {
        method: selectedCategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditDialogOpen(false);
        fetchCategories();
      }
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
      general: { variant: 'secondary', label: '通用' },
      bid: { variant: 'default', label: '投标' },
      technical: { variant: 'outline', label: '技术' },
      business: { variant: 'outline', label: '商务' },
    };
    const config = variants[type] || variants.general;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const renderCategoryRow = (category: PromptCategory, level: number = 0): React.ReactNode => {
    return (
      <>
        <TableRow key={category.id}>
          <TableCell>
            <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
              {category.children && category.children.length > 0 ? (
                <Folder className="mr-2 h-4 w-4 text-yellow-500" />
              ) : (
                <Tag className="mr-2 h-4 w-4 text-blue-500" />
              )}
              {category.name}
            </div>
          </TableCell>
          <TableCell>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {category.code}
            </code>
          </TableCell>
          <TableCell>{getTypeBadge(category.type)}</TableCell>
          <TableCell className="text-muted-foreground">
            {category.description || '-'}
          </TableCell>
          <TableCell className="text-center">{category.sortOrder}</TableCell>
          <TableCell>
            <Badge variant={category.isActive ? 'default' : 'secondary'}>
              {category.isActive ? '启用' : '禁用'}
            </Badge>
          </TableCell>
          <TableCell>
            {new Date(category.createdAt).toLocaleDateString()}
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(category)}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(category)} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        {category.children && category.children.length > 0 && (
          category.children.map((child) => renderCategoryRow(child, level + 1))
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">提示词分类管理</h1>
          <p className="text-muted-foreground">管理提示词模板的分类和标签</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新建分类
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="搜索分类名称..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="general">通用</SelectItem>
                <SelectItem value="bid">投标</SelectItem>
                <SelectItem value="technical">技术</SelectItem>
                <SelectItem value="business">商务</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FolderTree className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>暂无分类数据</p>
              <Button variant="link" onClick={handleCreate}>
                创建第一个分类
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>分类名称</TableHead>
                  <TableHead>代码</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="text-center">排序</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => renderCategoryRow(category))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? '编辑分类' : '新建分类'}
            </DialogTitle>
            <DialogDescription>
              配置提示词分类信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="输入分类名称"
                />
              </div>
              <div className="space-y-2">
                <Label>分类代码 *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="唯一标识符"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用</SelectItem>
                    <SelectItem value="bid">投标</SelectItem>
                    <SelectItem value="technical">技术</SelectItem>
                    <SelectItem value="business">商务</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>父级分类</Label>
                <Select 
                  value={formData.parentId} 
                  onValueChange={(v) => setFormData({ ...formData, parentId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择父级分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">无（顶级分类）</SelectItem>
                    {flatCategories
                      .filter((c) => c.id !== selectedCategory?.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="分类用途说明"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>图标</Label>
                <Input
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="图标名称或URL"
                />
              </div>
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

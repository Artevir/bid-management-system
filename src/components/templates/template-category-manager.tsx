'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Edit,
  Trash2,
  FolderOpen,
  Loader2,
  Palette as _Palette,
} from 'lucide-react';
import { extractErrorMessage } from '@/lib/error-message';

interface TemplateCategory {
  id: number;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  templateCount: number;
  createdAt: string;
  updatedAt: string;
}

export function TemplateCategoryManager() {
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TemplateCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<TemplateCategory | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    icon: 'Folder',
    color: '#6366f1',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    try {
      const response = await fetch('/api/frameworks/templates/categories');
      const data = await response.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setEditingCategory(null);
    setForm({ name: '', code: '', description: '', icon: 'Folder', color: '#6366f1' });
    setDialogOpen(true);
  }

  function handleEdit(category: TemplateCategory) {
    setEditingCategory(category);
    setForm({
      name: category.name,
      code: category.code,
      description: category.description || '',
      icon: category.icon || 'Folder',
      color: category.color,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.code) {
      alert('请填写分类名称和编码');
      return;
    }

    setSaving(true);
    try {
      const url = '/api/frameworks/templates/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      const body = editingCategory
        ? { id: editingCategory.id, ...form }
        : form;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(extractErrorMessage(data, '操作失败'));
      }

      setDialogOpen(false);
      fetchCategories();
    } catch (error: any) {
      alert(error.message || '操作失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingCategory) return;

    try {
      const response = await fetch(`/api/frameworks/templates/categories?id=${deletingCategory.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(extractErrorMessage(data, '删除失败'));
      }

      setDeleteDialogOpen(false);
      setDeletingCategory(null);
      fetchCategories();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  }

  const colorOptions = [
    { value: '#3b82f6', label: '蓝色' },
    { value: '#10b981', label: '绿色' },
    { value: '#f59e0b', label: '橙色' },
    { value: '#ef4444', label: '红色' },
    { value: '#8b5cf6', label: '紫色' },
    { value: '#6366f1', label: '靛蓝' },
    { value: '#6b7280', label: '灰色' },
  ];

  const iconOptions = ['Folder', 'FileText', 'Settings', 'Award', 'File', 'BookOpen', 'LayoutTemplate'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              章节模板分类
            </CardTitle>
            <CardDescription>管理章节模板的分类，如商务标、技术标等</CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新建分类
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>暂无分类</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>编码</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>颜色</TableHead>
                <TableHead>模板数</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {category.code}
                    </code>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {category.description || '-'}
                  </TableCell>
                  <TableCell>
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: category.color }}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{category.templateCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        category.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }
                    >
                      {category.isActive ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingCategory(category);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={category.templateCount > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? '编辑分类' : '新建分类'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? '修改模板分类信息' : '创建新的章节模板分类'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">名称 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：商务标"
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">编码 *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="如：business"
                className="col-span-3"
                disabled={!!editingCategory}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">描述</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="分类描述"
                className="col-span-3"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">图标</Label>
              <div className="col-span-3 flex flex-wrap gap-2">
                {iconOptions.map((icon) => (
                  <Button
                    key={icon}
                    type="button"
                    variant={form.icon === icon ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setForm({ ...form, icon })}
                  >
                    {icon}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">颜色</Label>
              <div className="col-span-3 flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${
                      form.color === color.value ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setForm({ ...form, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCategory ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除分类"{deletingCategory?.name}"吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

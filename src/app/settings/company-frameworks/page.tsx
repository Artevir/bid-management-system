'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Plus,
  Building2,
  MoreHorizontal,
  FileText,
  Edit,
  Trash2,
  Star,
  StarOff,
  ChevronRight,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// 类型定义
// ============================================

interface Company {
  id: number;
  name: string;
  shortName: string | null;
}

interface FrameworkChapter {
  id: number;
  title: string;
  titleNumber: string | null;
  level: number;
  order: number;
  isRequired: boolean;
  description: string | null;
  children?: FrameworkChapter[];
}

interface Framework {
  id: number;
  name: string;
  description: string | null;
  documentType: string;
  sourceType: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  company?: { id: number; name: string };
  chapters: FrameworkChapter[];
}

// ============================================
// 章节编辑组件
// ============================================

interface ChapterEditorProps {
  chapters: FrameworkChapter[];
  onChange: (chapters: FrameworkChapter[]) => void;
}

function ChapterEditor({ chapters, onChange }: ChapterEditorProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const addChapter = (parentId: number | null, level: number) => {
    const newChapter: FrameworkChapter = {
      id: -Date.now(),
      title: '新章节',
      titleNumber: '',
      level,
      order: chapters.filter((c) => c.level === level).length + 1,
      isRequired: true,
      description: '',
      children: [],
    };

    if (parentId === null) {
      onChange([...chapters, newChapter]);
    } else {
      const addToParent = (items: FrameworkChapter[]): FrameworkChapter[] => {
        return items.map((item) => {
          if (item.id === parentId) {
            return {
              ...item,
              children: [...(item.children || []), newChapter],
            };
          }
          if (item.children) {
            return { ...item, children: addToParent(item.children) };
          }
          return item;
        });
      };
      onChange(addToParent(chapters));
    }
  };

  const updateChapter = (id: number, field: keyof FrameworkChapter, value: any) => {
    const update = (items: FrameworkChapter[]): FrameworkChapter[] => {
      return items.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        if (item.children) {
          return { ...item, children: update(item.children) };
        }
        return item;
      });
    };
    onChange(update(chapters));
  };

  const deleteChapter = (id: number) => {
    const remove = (items: FrameworkChapter[]): FrameworkChapter[] => {
      return items
        .filter((item) => item.id !== id)
        .map((item) => {
          if (item.children) {
            return { ...item, children: remove(item.children) };
          }
          return item;
        });
    };
    onChange(remove(chapters));
  };

  const renderChapters = (items: FrameworkChapter[], depth = 0) => {
    return items.map((chapter, index) => (
      <div key={chapter.id}>
        <div
          className={cn(
            'flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50 group',
            depth > 0 && 'ml-6'
          )}
        >
          {chapter.children && chapter.children.length > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => toggleExpand(chapter.id)}
            >
              {expandedIds.has(chapter.id) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <span className="w-5" />
          )}
          <Input
            value={chapter.titleNumber || ''}
            onChange={(e) => updateChapter(chapter.id, 'titleNumber', e.target.value)}
            placeholder="编号"
            className="w-20 h-7 text-xs"
          />
          <Input
            value={chapter.title}
            onChange={(e) => updateChapter(chapter.id, 'title', e.target.value)}
            placeholder="章节标题"
            className="flex-1 h-7"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={() => addChapter(chapter.id, chapter.level + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
            onClick={() => deleteChapter(chapter.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        {chapter.children && chapter.children.length > 0 && expandedIds.has(chapter.id) && (
          <div>{renderChapters(chapter.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>章节结构</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addChapter(null, 1)}
        >
          <Plus className="h-3 w-3 mr-1" />
          添加一级章节
        </Button>
      </div>
      <ScrollArea className="h-[300px] border rounded-lg p-2">
        {chapters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            点击"添加一级章节"开始创建框架
          </div>
        ) : (
          renderChapters(chapters)
        )}
      </ScrollArea>
    </div>
  );
}

// ============================================
// 主页面
// ============================================

export default function CompanyFrameworkPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  // 创建/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFramework, setEditingFramework] = useState<Framework | null>(null);
  const [saving, setSaving] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    documentType: '投标文件',
    isDefault: false,
    chapters: [] as FrameworkChapter[],
  });

  // 加载公司列表
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      setCompanies(data.companies || []);
      if (data.companies?.length > 0) {
        setSelectedCompanyId(data.companies[0].id);
      }
    } catch (error) {
      console.error('Load companies error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载框架列表
  useEffect(() => {
    if (selectedCompanyId) {
      loadFrameworks();
    }
  }, [selectedCompanyId]);

  const loadFrameworks = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/companies/${selectedCompanyId}/frameworks`
      );
      const data = await res.json();
      setFrameworks(data.frameworks || []);
    } catch (error) {
      console.error('Load frameworks error:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingFramework(null);
    setFormData({
      name: '',
      description: '',
      documentType: '投标文件',
      isDefault: false,
      chapters: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (framework: Framework) => {
    setEditingFramework(framework);
    setFormData({
      name: framework.name,
      description: framework.description || '',
      documentType: framework.documentType,
      isDefault: framework.isDefault,
      chapters: framework.chapters || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCompanyId || !formData.name) return;

    setSaving(true);
    try {
      const url = editingFramework
        ? `/api/companies/${selectedCompanyId}/frameworks/${editingFramework.id}`
        : `/api/companies/${selectedCompanyId}/frameworks`;

      const method = editingFramework ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setDialogOpen(false);
        loadFrameworks();
      }
    } catch (error) {
      console.error('Save framework error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (frameworkId: number) => {
    if (!confirm('确定要删除此框架吗？')) return;

    try {
      const res = await fetch(
        `/api/companies/${selectedCompanyId}/frameworks/${frameworkId}`,
        { method: 'DELETE' }
      );

      const data = await res.json();
      if (data.success) {
        loadFrameworks();
      }
    } catch (error) {
      console.error('Delete framework error:', error);
    }
  };

  const handleSetDefault = async (frameworkId: number, isDefault: boolean) => {
    try {
      const res = await fetch(
        `/api/companies/${selectedCompanyId}/frameworks/${frameworkId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isDefault }),
        }
      );

      const data = await res.json();
      if (data.success) {
        loadFrameworks();
      }
    } catch (error) {
      console.error('Set default error:', error);
    }
  };

  const getDocumentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      投标文件: 'bg-blue-100 text-blue-800',
      技术方案: 'bg-green-100 text-green-800',
      商务文件: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colors[type] || 'bg-gray-100 text-gray-800'}>
        {type}
      </Badge>
    );
  };

  const countChapters = (chapters: FrameworkChapter[]): number => {
    let count = chapters.length;
    chapters.forEach((c) => {
      if (c.children) {
        count += countChapters(c.children);
      }
    });
    return count;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">公司文档框架</h1>
          <p className="text-muted-foreground">
            管理各公司的标准文档框架模板，支持在创建投标文件时进行框架合并
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={!selectedCompanyId}>
          <Plus className="mr-2 h-4 w-4" />
          新建框架
        </Button>
      </div>

      {/* 公司选择 */}
      <div className="flex items-center gap-4">
        <Label>选择公司：</Label>
        <Select
          value={selectedCompanyId?.toString() || ''}
          onValueChange={(v) => setSelectedCompanyId(parseInt(v))}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="选择公司" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id.toString()}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {company.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* 框架列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedCompanyId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            请选择一个公司查看文档框架
          </CardContent>
        </Card>
      ) : frameworks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            该公司暂无文档框架，点击"新建框架"创建
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {frameworks.map((framework) => (
            <Card key={framework.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {framework.name}
                      {framework.isDefault && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {framework.description || '无描述'}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(framework)}>
                        <Edit className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSetDefault(framework.id, !framework.isDefault)}
                      >
                        {framework.isDefault ? (
                          <>
                            <StarOff className="mr-2 h-4 w-4" />
                            取消默认
                          </>
                        ) : (
                          <>
                            <Star className="mr-2 h-4 w-4" />
                            设为默认
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(framework.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {getDocumentTypeBadge(framework.documentType)}
                  <div className="flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    {countChapters(framework.chapters)} 章节
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingFramework ? '编辑文档框架' : '创建文档框架'}
            </DialogTitle>
            <DialogDescription>
              创建公司标准文档框架，可在创建投标文件时选择合并
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">框架名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：标准投标文件框架"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentType">文档类型</Label>
                <Select
                  value={formData.documentType}
                  onValueChange={(v) => setFormData({ ...formData, documentType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="投标文件">投标文件</SelectItem>
                    <SelectItem value="技术方案">技术方案</SelectItem>
                    <SelectItem value="商务文件">商务文件</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">框架描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="描述框架的用途、适用场景等"
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isDefault">设为公司默认框架</Label>
            </div>

            <Separator />

            <ChapterEditor
              chapters={formData.chapters}
              onChange={(chapters) => setFormData({ ...formData, chapters })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

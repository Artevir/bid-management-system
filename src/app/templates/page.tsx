'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
import {
  FileText,
  Plus,
  Search,
  Eye,
  ArrowRight,
  LayoutTemplate,
  Building,
  Star,
  Sparkles,
  FolderOpen,
  Zap,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: number;
  name: string;
  code: string;
  category?: string;
  industry?: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  useCount: number;
  createdAt: string;
}

interface TemplateDetail extends Template {
  content?: {
    chapters: Array<{
      serialNumber?: string;
      title: string;
      type?: string;
      level: number;
      isRequired: boolean;
      children?: any[];
    }>;
  };
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    category: '',
    industry: '',
    description: '',
    content: '',
  });

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  async function fetchTemplates() {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);

      const response = await fetch(`/api/templates?${params.toString()}`);
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const response = await fetch('/api/templates?action=categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }

  async function handleCreateTemplate() {
    try {
      let content = null;
      if (createForm.content) {
        try {
          content = JSON.parse(createForm.content);
        } catch (e) {
          alert('模板内容JSON格式错误');
          return;
        }
      }

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          code: createForm.code,
          category: createForm.category,
          industry: createForm.industry,
          description: createForm.description,
          content,
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        setCreateForm({
          name: '',
          code: '',
          category: '',
          industry: '',
          description: '',
          content: '',
        });
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  }

  async function handleViewTemplate(id: number) {
    try {
      const response = await fetch(`/api/templates/${id}`);
      const data = await response.json();
      setSelectedTemplate(data.template);
      setViewDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch template:', error);
    }
  }

  async function handleUseTemplate(template: Template) {
    // 跳转到创建投标文件页面，带上模板参数
    router.push(`/bidding-documents/create?templateId=${template.id}`);
  }

  const categoryLabels: Record<string, string> = {
    technical: '技术标',
    business: '商务标',
    comprehensive: '综合标',
  };

  const categoryColors: Record<string, string> = {
    technical: 'bg-blue-500/10 text-blue-600 border-blue-200',
    business: 'bg-green-500/10 text-green-600 border-green-200',
    comprehensive: 'bg-purple-500/10 text-purple-600 border-purple-200',
  };

  // 热门模板（按使用次数排序）
  const hotTemplates = [...templates]
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, 6);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">快速模板</h1>
          <p className="text-muted-foreground">选择模板快速创建标书，或前往文档框架进行详细配置</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/frameworks')}>
            <Layers className="mr-2 h-4 w-4" />
            文档框架
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建模板
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索模板..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTemplates()}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={fetchTemplates}>
            搜索
          </Button>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="选择分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {categoryLabels[cat] || cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hot Templates Section */}
      {!searchQuery && categoryFilter === 'all' && hotTemplates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">热门模板</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotTemplates.map((template) => (
              <Card
                key={template.id}
                className="group cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                onClick={() => handleUseTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base group-hover:text-primary transition-colors">
                          {template.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {template.code}
                        </CardDescription>
                      </div>
                    </div>
                    {template.isSystem && (
                      <Badge variant="secondary" className="text-xs">系统</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {template.description || '暂无描述'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {template.category && (
                        <Badge variant="outline" className={cn('text-xs', categoryColors[template.category])}>
                          {categoryLabels[template.category] || template.category}
                        </Badge>
                      )}
                      {template.industry && (
                        <Badge variant="outline" className="text-xs">
                          {template.industry}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {template.useCount} 次使用
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    立即使用
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Templates Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">全部模板</h2>
          <Badge variant="secondary" className="ml-2">{templates.length}</Badge>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <LayoutTemplate className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">暂无模板</p>
            <p className="text-sm mt-1">点击"新建模板"创建您的第一个模板</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="group cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                    </div>
                    {template.isSystem && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">系统</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2 min-h-[32px]">
                    {template.description || '暂无描述'}
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      {template.category && (
                        <Badge variant="outline" className={cn('text-[10px]', categoryColors[template.category])}>
                          {categoryLabels[template.category] || template.category}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {template.useCount} 次
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewTemplate(template.id);
                      }}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      预览
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseTemplate(template);
                      }}
                    >
                      使用
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新建标书模板</DialogTitle>
            <DialogDescription>创建一个新的标书模板</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>模板名称 *</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  placeholder="请输入模板名称"
                />
              </div>
              <div className="space-y-2">
                <Label>模板编码 *</Label>
                <Input
                  value={createForm.code}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, code: e.target.value })
                  }
                  placeholder="如：TECH-001"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类</Label>
                <Select
                  value={createForm.category}
                  onValueChange={(value) =>
                    setCreateForm({ ...createForm, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">技术标</SelectItem>
                    <SelectItem value="business">商务标</SelectItem>
                    <SelectItem value="comprehensive">综合标</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>行业</Label>
                <Input
                  value={createForm.industry}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, industry: e.target.value })
                  }
                  placeholder="如：IT、建筑"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                placeholder="模板描述（可选）"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>章节结构（JSON格式）</Label>
              <Textarea
                value={createForm.content}
                onChange={(e) =>
                  setCreateForm({ ...createForm, content: e.target.value })
                }
                placeholder={`{
  "chapters": [
    {
      "serialNumber": "1",
      "title": "公司简介",
      "level": 1,
      "isRequired": true
    }
  ]
}`}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                章节结构为JSON格式，包含chapters数组
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={!createForm.name || !createForm.code}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Template Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-4 mt-2">
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {selectedTemplate?.code}
                </code>
                {selectedTemplate?.category && (
                  <Badge variant="outline">
                    {categoryLabels[selectedTemplate.category] || selectedTemplate.category}
                  </Badge>
                )}
                {selectedTemplate?.isSystem && (
                  <Badge variant="secondary">系统模板</Badge>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedTemplate?.description && (
              <p className="text-sm text-muted-foreground mb-4">
                {selectedTemplate.description}
              </p>
            )}
            {selectedTemplate?.content?.chapters && (
              <div className="space-y-2">
                <Label>章节结构</Label>
                <div className="border rounded-lg p-4 bg-muted/50 max-h-[400px] overflow-y-auto">
                  <pre className="text-sm">
                    {JSON.stringify(selectedTemplate.content.chapters, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewDialogOpen(false)}
            >
              关闭
            </Button>
            <Button
              onClick={() => {
                if (selectedTemplate) {
                  handleUseTemplate(selectedTemplate);
                  setViewDialogOpen(false);
                }
              }}
            >
              <Zap className="mr-2 h-4 w-4" />
              使用此模板
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

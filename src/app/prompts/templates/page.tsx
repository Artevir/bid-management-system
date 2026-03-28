'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Play,
  Eye,
  Filter,
  Tag,
  Sparkles,
  Code,
  Braces,
} from 'lucide-react';

interface PromptCategory {
  id: number;
  name: string;
  code: string;
  type: string;
  description?: string;
}

interface PromptParameter {
  id: number;
  name: string;
  code: string;
  type: string;
  defaultValue?: string;
  description?: string;
  required: boolean;
}

interface PromptTemplate {
  id: number;
  name: string;
  code: string;
  description?: string;
  categoryId?: number;
  category?: PromptCategory;
  content: string;
  systemPrompt?: string;
  modelProvider?: string;
  modelName?: string;
  temperature?: string;
  maxTokens?: number;
  status: string;
  isSystem: boolean;
  version: number;
  parameters?: PromptParameter[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export default function PromptTemplatesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <PromptTemplatesContent />
    </Suspense>
  );
}

function PromptTemplatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  
  // Filters
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  
  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    categoryId: '',
    content: '',
    systemPrompt: '',
    modelProvider: 'doubao',
    modelName: '',
    temperature: '0.7',
    maxTokens: 4096,
    // AI角色配置
    isAgent: false,
    agentRole: '',
    agentAvatar: '',
    agentGreeting: '',
    agentDescription: '',
    agentSkills: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  // Fetch categories
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch templates when filters change
  useEffect(() => {
    fetchTemplates();
  }, [page, categoryId, status, keyword]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/prompts/categories');
      const data = await res.json();
      if (data.items) {
        setCategories(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      if (categoryId && categoryId !== 'all') params.set('categoryId', categoryId);
      if (status && status !== 'all') params.set('status', status);
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());

      const res = await fetch(`/api/prompts/templates?${params.toString()}`);
      const data = await res.json();
      
      if (data.items) {
        setTemplates(data.items);
        setTotal(data.total || data.items.length);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchTemplates();
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      categoryId: '',
      content: '',
      systemPrompt: '',
      modelProvider: 'doubao',
      modelName: '',
      temperature: '0.7',
      maxTokens: 4096,
      // AI角色配置
      isAgent: false,
      agentRole: '',
      agentAvatar: '',
      agentGreeting: '',
      agentDescription: '',
      agentSkills: '',
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      code: template.code,
      description: template.description || '',
      categoryId: template.categoryId?.toString() || '',
      content: template.content,
      systemPrompt: template.systemPrompt || '',
      modelProvider: template.modelProvider || 'doubao',
      modelName: template.modelName || '',
      temperature: template.temperature || '0.7',
      maxTokens: template.maxTokens || 4096,
      // AI角色配置
      isAgent: (template as any).isAgent || false,
      agentRole: (template as any).agentRole || '',
      agentAvatar: (template as any).agentAvatar || '',
      agentGreeting: (template as any).agentGreeting || '',
      agentDescription: (template as any).agentDescription || '',
      agentSkills: (template as any).agentSkills || '',
    });
    setEditDialogOpen(true);
  };

  const handleDuplicate = async (template: PromptTemplate) => {
    try {
      const res = await fetch('/api/prompts/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.name} (副本)`,
          code: `${template.code}_copy_${Date.now()}`,
          description: template.description,
          categoryId: template.categoryId,
          content: template.content,
          systemPrompt: template.systemPrompt,
          modelProvider: template.modelProvider,
          modelName: template.modelName,
          temperature: template.temperature,
          maxTokens: template.maxTokens,
        }),
      });
      
      if (res.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const handleDelete = async (template: PromptTemplate) => {
    if (!confirm(`确定要删除模板"${template.name}"吗？此操作不可恢复。`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/prompts/templates/${template.id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handlePreview = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  const handleGenerate = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setGenerateDialogOpen(true);
  };

  const handleSubmit = async () => {
    setFormLoading(true);
    try {
      const url = selectedTemplate
        ? `/api/prompts/templates/${selectedTemplate.id}`
        : '/api/prompts/templates';
      
      const body = {
        ...formData,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
        temperature: formData.temperature || '0.7',
        maxTokens: formData.maxTokens || 4096,
      };

      const res = await fetch(url, {
        method: selectedTemplate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditDialogOpen(false);
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: '草稿' },
      published: { variant: 'default', label: '已发布' },
      archived: { variant: 'outline', label: '已归档' },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getModelProviderLabel = (provider?: string) => {
    const labels: Record<string, string> = {
      doubao: '豆包',
      deepseek: 'DeepSeek',
      qwen: '千问',
      wenxin: '文心一言',
      spark: '讯飞星火',
    };
    return labels[provider || ''] || provider || '-';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">提示词模板管理</h1>
          <p className="text-muted-foreground">管理提示词模板，支持参数化配置和版本控制</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新建模板
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="搜索模板名称、代码、描述..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-[180px]">
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
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>暂无模板数据</p>
              <Button variant="link" onClick={handleCreate}>
                创建第一个模板
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模板名称</TableHead>
                  <TableHead>代码</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>参数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {template.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      {template.category?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{getModelProviderLabel(template.modelProvider)}</div>
                        {template.modelName && (
                          <div className="text-muted-foreground">{template.modelName}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.parameters && template.parameters.length > 0 ? (
                        <Badge variant="outline">
                          <Braces className="mr-1 h-3 w-3" />
                          {template.parameters.length} 个参数
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(template.status)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">v{template.version}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(template.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePreview(template)}>
                            <Eye className="mr-2 h-4 w-4" />
                            预览
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGenerate(template)}>
                            <Play className="mr-2 h-4 w-4" />
                            生成方案
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(template)}>
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                            <Copy className="mr-2 h-4 w-4" />
                            复制
                          </DropdownMenuItem>
                          {!template.isSystem && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(template)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </>
                          )}
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

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? '编辑模板' : '新建模板'}
            </DialogTitle>
            <DialogDescription>
              配置提示词模板，支持参数占位符 {'{{param_name}}'} 语法
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>模板名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入模板名称"
              />
            </div>
            <div className="space-y-2">
              <Label>模板代码 *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="唯一标识符，如：bid_technical_proposal"
                disabled={!!selectedTemplate}
              />
            </div>
            <div className="space-y-2">
              <Label>分类</Label>
              <Select 
                value={formData.categoryId} 
                onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
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
              <Label>模型提供商</Label>
              <Select 
                value={formData.modelProvider} 
                onValueChange={(v) => setFormData({ ...formData, modelProvider: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择模型提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doubao">豆包</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="qwen">千问</SelectItem>
                  <SelectItem value="wenxin">文心一言</SelectItem>
                  <SelectItem value="spark">讯飞星火</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>描述</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="模板用途说明"
              />
            </div>
          </div>

          <Tabs defaultValue="content" className="w-full">
            <TabsList>
              <TabsTrigger value="content">提示词内容</TabsTrigger>
              <TabsTrigger value="system">系统提示词</TabsTrigger>
              <TabsTrigger value="agent">AI角色配置</TabsTrigger>
              <TabsTrigger value="settings">模型设置</TabsTrigger>
            </TabsList>
            
            <TabsContent value="content" className="mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>提示词内容 *</Label>
                  <span className="text-xs text-muted-foreground">
                    使用 {'{{param_name}}'} 添加参数占位符
                  </span>
                </div>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="请输入提示词内容，使用 {{param_name}} 表示参数..."
                  className="min-h-[300px] font-mono"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="system" className="mt-4">
              <div className="space-y-2">
                <Label>系统提示词</Label>
                <Textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder="系统角色定义和行为指导..."
                  className="min-h-[200px] font-mono"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="agent" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isAgent"
                    checked={formData.isAgent}
                    onChange={(e) => setFormData({ ...formData, isAgent: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="isAgent" className="cursor-pointer">启用为AI角色</Label>
                </div>
                
                {formData.isAgent && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>角色类型</Label>
                      <Select 
                        value={formData.agentRole} 
                        onValueChange={(v) => setFormData({ ...formData, agentRole: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择角色类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales_director">销售总监</SelectItem>
                          <SelectItem value="presales_director">售前总监</SelectItem>
                          <SelectItem value="finance_director">财务总监</SelectItem>
                          <SelectItem value="customer">客户</SelectItem>
                          <SelectItem value="auditor">审核员</SelectItem>
                          <SelectItem value="technical_expert">技术专家</SelectItem>
                          <SelectItem value="legal_advisor">法律顾问</SelectItem>
                          <SelectItem value="project_manager">项目经理</SelectItem>
                          <SelectItem value="bid_specialist">投标专员</SelectItem>
                          <SelectItem value="custom">自定义</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>头像URL</Label>
                      <Input
                        value={formData.agentAvatar}
                        onChange={(e) => setFormData({ ...formData, agentAvatar: e.target.value })}
                        placeholder="头像图片URL（可选）"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>问候语</Label>
                      <Input
                        value={formData.agentGreeting}
                        onChange={(e) => setFormData({ ...formData, agentGreeting: e.target.value })}
                        placeholder="如：您好，我是您的销售总监助手..."
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>角色描述</Label>
                      <Textarea
                        value={formData.agentDescription}
                        onChange={(e) => setFormData({ ...formData, agentDescription: e.target.value })}
                        placeholder="描述这个AI角色的职责和能力..."
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>技能标签（逗号分隔）</Label>
                      <Input
                        value={formData.agentSkills}
                        onChange={(e) => setFormData({ ...formData, agentSkills: e.target.value })}
                        placeholder="如：销售策略,客户分析,市场洞察"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="settings" className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>模型名称</Label>
                  <Input
                    value={formData.modelName}
                    onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                    placeholder="如：doubao-pro-32k"
                  />
                </div>
                <div className="space-y-2">
                  <Label>温度 (Temperature)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>最大令牌数</Label>
                  <Input
                    type="number"
                    value={formData.maxTokens}
                    onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

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

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>模板预览</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">基本信息</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>代码: <code className="bg-muted px-2 py-1 rounded">{selectedTemplate.code}</code></div>
                  <div>状态: {getStatusBadge(selectedTemplate.status)}</div>
                  <div>版本: v{selectedTemplate.version}</div>
                  <div>模型: {getModelProviderLabel(selectedTemplate.modelProvider)}</div>
                </div>
              </div>
              
              {selectedTemplate.systemPrompt && (
                <div>
                  <h4 className="font-medium mb-2">系统提示词</h4>
                  <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap overflow-x-auto">
                    {selectedTemplate.systemPrompt}
                  </pre>
                </div>
              )}
              
              <div>
                <h4 className="font-medium mb-2">提示词内容</h4>
                <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap overflow-x-auto">
                  {selectedTemplate.content}
                </pre>
              </div>
              
              {selectedTemplate.parameters && selectedTemplate.parameters.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">参数列表</h4>
                  <div className="space-y-2">
                    {selectedTemplate.parameters.map((param) => (
                      <div key={param.id} className="flex items-center gap-2 text-sm bg-muted p-2 rounded">
                        <code>{`{{${param.code}}}}`}</code>
                        <span className="text-muted-foreground">- {param.name}</span>
                        {param.required && <Badge variant="destructive" className="text-xs">必填</Badge>}
                        {param.defaultValue && (
                          <span className="text-muted-foreground">默认: {param.defaultValue}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              关闭
            </Button>
            <Button onClick={() => {
              setPreviewDialogOpen(false);
              if (selectedTemplate) handleGenerate(selectedTemplate);
            }}>
              <Play className="mr-2 h-4 w-4" />
              生成方案
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>方案生成</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          
          <GenerateDialogContent 
            template={selectedTemplate} 
            onClose={() => setGenerateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Generate Dialog Content Component
function GenerateDialogContent({ 
  template, 
  onClose 
}: { 
  template: PromptTemplate | null; 
  onClose: () => void;
}) {
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (template?.parameters) {
      const defaults: Record<string, string> = {};
      template.parameters.forEach((param) => {
        defaults[param.code] = param.defaultValue || '';
      });
      setParameters(defaults);
    }
  }, [template]);

  const handleGenerate = async () => {
    if (!template) return;
    
    setGenerating(true);
    setGeneratedContent('');
    setStreaming(true);

    try {
      const response = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          parameters,
          stream: true,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content') {
                  setGeneratedContent((prev) => prev + data.content);
                } else if (data.type === 'done') {
                  setStreaming(false);
                } else if (data.type === 'error') {
                  console.error('Generation error:', data.error);
                  setStreaming(false);
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate:', error);
    } finally {
      setGenerating(false);
      setStreaming(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
  };

  if (!template) return null;

  return (
    <div className="space-y-4">
      {/* Parameters */}
      {template.parameters && template.parameters.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium">参数配置</h4>
          <div className="grid grid-cols-2 gap-4">
            {template.parameters.map((param) => (
              <div key={param.id} className="space-y-2">
                <Label>
                  {param.name}
                  {param.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {param.type === 'textarea' ? (
                  <Textarea
                    value={parameters[param.code] || ''}
                    onChange={(e) => setParameters({ ...parameters, [param.code]: e.target.value })}
                    placeholder={param.description}
                  />
                ) : (
                  <Input
                    value={parameters[param.code] || ''}
                    onChange={(e) => setParameters({ ...parameters, [param.code]: e.target.value })}
                    placeholder={param.description}
                  />
                )}
                {param.description && (
                  <p className="text-xs text-muted-foreground">{param.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <Sparkles className="mr-2 h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              开始生成
            </>
          )}
        </Button>
      </div>

      {/* Generated Content */}
      {(generatedContent || generating) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">生成结果</h4>
            {generatedContent && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                复制
              </Button>
            )}
          </div>
          <div className="bg-muted p-4 rounded-lg min-h-[200px] whitespace-pre-wrap">
            {generatedContent}
            {streaming && <span className="animate-pulse">▌</span>}
          </div>
        </div>
      )}
    </div>
  );
}

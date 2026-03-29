'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card as _Card, CardContent as _CardContent, CardHeader as _CardHeader, CardTitle as _CardTitle, CardDescription as _CardDescription } from '@/components/ui/card';
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
import { Tabs as _Tabs, TabsContent as _TabsContent, TabsList as _TabsList, TabsTrigger as _TabsTrigger } from '@/components/ui/tabs';
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
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  FolderOpen as _FolderOpen,
  ChevronRight,
  ChevronDown as _ChevronDown,
  CheckCircle2 as _CheckCircle2,
  Loader2,
  Upload as _Upload,
  Download as _Download,
  Settings,
  Layers as _Layers,
  FileUp,
  Copy as _Copy,
  Eye as _Eye,
  BookOpen,
  LayoutTemplate,
  Palette as _Palette,
  Type,
  AlignLeft,
  Building2,
  Star,
  StarOff,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface Company {
  id: number;
  name: string;
  shortName: string | null;
}

interface DocFramework {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  category: string;
  status: string;
  version: number;
  isSystem: boolean;
  isDefault: boolean;
  companyId: number | null;
  company?: { id: number; name: string } | null;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Chapter {
  id: number;
  title: string;
  level: number;
  sequence: number;
  parentId: number | null;
  chapterCode: string | null;
  contentType: string;
  required: boolean;
  wordCountMin: number | null;
  wordCountMax: number | null;
  contentTemplate: string | null;
  isPlaceholder: boolean;
  placeholderHint: string | null;
  children?: Chapter[];
}

// ============================================
// Main Component
// ============================================

export default function DocFrameworksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <DocFrameworksContent />
    </Suspense>
  );
}

function DocFrameworksContent() {
  const _router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [frameworks, setFrameworks] = useState<DocFramework[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<DocFramework | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [_activeTab, _setActiveTab] = useState(searchParams.get('tab') || 'list');
  
  // Filter States
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'system' | 'company'>('all');
  
  // Dialog States
  const [frameworkDialogOpen, setFrameworkDialogOpen] = useState(false);
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingFramework, setEditingFramework] = useState<DocFramework | null>(null);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'framework' | 'chapter'; id: number; name: string } | null>(null);
  
  // Form States
  const [frameworkForm, setFrameworkForm] = useState({
    name: '',
    code: '',
    description: '',
    category: 'general',
    companyId: '',
    isDefault: false,
  });
  
  const [chapterForm, setChapterForm] = useState({
    title: '',
    level: 1,
    chapterCode: '',
    contentType: 'text',
    required: false,
    wordCountMin: '',
    wordCountMax: '',
    contentTemplate: '',
    parentId: '',
  });
  
  // Parse States
  const [parseUrl, setParseUrl] = useState('');
  const [parsedChapters, setParsedChapters] = useState<Chapter[]>([]);
  const [parsing, setParsing] = useState(false);
  
  // Config States
  const [configForm, setConfigForm] = useState({
    cover: { enabled: false, title: '', subtitle: '', company: '', date: '' },
    titlePage: { enabled: false, title: '', content: '' },
    header: { enabled: false, left: '', center: '', right: '' },
    footer: { enabled: false, showPageNumber: true, format: '第{page}页 共{total}页' },
    toc: { enabled: true, maxLevel: 3 },
    body: { fontSize: '12pt', lineHeight: '1.5', fontFamily: 'SimSun' },
  });

  // Search
  const [searchKeyword, setSearchKeyword] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  // ============================================
  // Data Fetching
  // ============================================

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await fetch('/api/companies');
      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  }, []);

  const fetchFrameworks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKeyword) params.set('keyword', searchKeyword);
      if (selectedCompanyId !== 'all') params.set('companyId', selectedCompanyId);
      if (scopeFilter !== 'all') params.set('scope', scopeFilter);
      params.set('page', pagination.page.toString());
      params.set('pageSize', pagination.pageSize.toString());

      const response = await fetch(`/api/frameworks?${params.toString()}`);
      const data = await response.json();
      setFrameworks(data.items || []);
      setPagination(prev => ({
        ...prev,
        total: data.total || 0,
        totalPages: data.totalPages || 0,
      }));
    } catch (error) {
      console.error('Failed to fetch frameworks:', error);
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, selectedCompanyId, scopeFilter, pagination.page, pagination.pageSize]);

  const fetchChapters = useCallback(async (frameworkId: number) => {
    try {
      const response = await fetch(`/api/frameworks/chapters?frameworkId=${frameworkId}&tree=true`);
      const data = await response.json();
      setChapters(data.items || []);
    } catch (error) {
      console.error('Failed to fetch chapters:', error);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    fetchFrameworks();
  }, [fetchFrameworks]);

  useEffect(() => {
    if (selectedFramework) {
      fetchChapters(selectedFramework.id);
    }
  }, [selectedFramework, fetchChapters]);

  // ============================================
  // Framework Operations
  // ============================================

  const handleCreateFramework = () => {
    setEditingFramework(null);
    setFrameworkForm({ 
      name: '', 
      code: '', 
      description: '', 
      category: 'general',
      companyId: selectedCompanyId !== 'all' ? selectedCompanyId : '',
      isDefault: false,
    });
    setFrameworkDialogOpen(true);
  };

  const handleEditFramework = (framework: DocFramework) => {
    setEditingFramework(framework);
    setFrameworkForm({
      name: framework.name,
      code: framework.code || '',
      description: framework.description || '',
      category: framework.category || 'general',
      companyId: framework.companyId?.toString() || '',
      isDefault: framework.isDefault || false,
    });
    setFrameworkDialogOpen(true);
  };

  const handleSaveFramework = async () => {
    try {
      const url = '/api/frameworks';
      const method = editingFramework ? 'PUT' : 'POST';
      const body = editingFramework
        ? { id: editingFramework.id, ...frameworkForm }
        : frameworkForm;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '操作失败');
      }

      setFrameworkDialogOpen(false);
      fetchFrameworks();
    } catch (error: any) {
      alert(error.message || '操作失败');
    }
  };

  const handleDeleteFramework = async () => {
    if (!deletingItem) return;

    try {
      const response = await fetch(`/api/frameworks?id=${deletingItem.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      setDeleteDialogOpen(false);
      setDeletingItem(null);
      setSelectedFramework(null);
      fetchFrameworks();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  const handleSetDefault = async (frameworkId: number, isDefault: boolean) => {
    try {
      const framework = frameworks.find(f => f.id === frameworkId);
      if (!framework) return;

      const response = await fetch('/api/frameworks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: frameworkId,
          isDefault,
          companyId: framework.companyId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '设置失败');
      }

      fetchFrameworks();
    } catch (error: any) {
      alert(error.message || '设置失败');
    }
  };

  // ============================================
  // Chapter Operations
  // ============================================

  const handleCreateChapter = (parentId?: number) => {
    setEditingChapter(null);
    setChapterForm({
      title: '',
      level: parentId ? 2 : 1,
      chapterCode: '',
      contentType: 'text',
      required: false,
      wordCountMin: '',
      wordCountMax: '',
      contentTemplate: '',
      parentId: parentId?.toString() || '',
    });
    setChapterDialogOpen(true);
  };

  const handleEditChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setChapterForm({
      title: chapter.title,
      level: chapter.level,
      chapterCode: chapter.chapterCode || '',
      contentType: chapter.contentType,
      required: chapter.required,
      wordCountMin: chapter.wordCountMin?.toString() || '',
      wordCountMax: chapter.wordCountMax?.toString() || '',
      contentTemplate: chapter.contentTemplate || '',
      parentId: chapter.parentId?.toString() || '',
    });
    setChapterDialogOpen(true);
  };

  const handleSaveChapter = async () => {
    if (!selectedFramework) return;

    try {
      const url = '/api/frameworks/chapters';
      const method = editingChapter ? 'PUT' : 'POST';
      const body = editingChapter
        ? { id: editingChapter.id, ...chapterForm }
        : { frameworkId: selectedFramework.id, ...chapterForm };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '操作失败');
      }

      setChapterDialogOpen(false);
      fetchChapters(selectedFramework.id);
    } catch (error: any) {
      alert(error.message || '操作失败');
    }
  };

  const handleDeleteChapter = async () => {
    if (!deletingItem || !selectedFramework) return;

    try {
      const response = await fetch(`/api/frameworks/chapters?id=${deletingItem.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      setDeleteDialogOpen(false);
      setDeletingItem(null);
      fetchChapters(selectedFramework.id);
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  // ============================================
  // Parse Operations
  // ============================================

  const handleParseDocument = async () => {
    if (!parseUrl) return;
    
    setParsing(true);
    try {
      const response = await fetch('/api/frameworks/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parseUrl }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '解析失败');
      }

      setParsedChapters(data.chapters || []);
    } catch (error: any) {
      alert(error.message || '解析失败');
    } finally {
      setParsing(false);
    }
  };

  const handleImportChapters = async () => {
    if (!selectedFramework || parsedChapters.length === 0) return;

    try {
      const response = await fetch('/api/frameworks/chapters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'batch-create',
          data: {
            frameworkId: selectedFramework.id,
            chapters: parsedChapters,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '导入失败');
      }

      setParseDialogOpen(false);
      setParsedChapters([]);
      setParseUrl('');
      fetchChapters(selectedFramework.id);
    } catch (error: any) {
      alert(error.message || '导入失败');
    }
  };

  // ============================================
  // Render Helpers
  // ============================================

  const getScopeBadge = (framework: DocFramework) => {
    if (framework.isSystem) {
      return (
        <Badge variant="secondary" className="text-xs">
          <Globe className="h-3 w-3 mr-1" />
          系统框架
        </Badge>
      );
    }
    if (framework.companyId && framework.company) {
      return (
        <Badge variant="outline" className="text-xs">
          <Building2 className="h-3 w-3 mr-1" />
          {framework.company.name}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        <Globe className="h-3 w-3 mr-1" />
        公共框架
      </Badge>
    );
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
            <h1 className="text-2xl font-semibold tracking-tight">文档框架</h1>
            <p className="text-sm text-muted-foreground">
              管理文档框架模板，支持系统框架与公司专属框架
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCreateFramework}>
              <Plus className="h-4 w-4 mr-2" />
              新建框架
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Framework List */}
        <div className="w-80 border-r bg-muted/30 flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索框架..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Scope Filter */}
            <div className="flex gap-1">
              <Button
                variant={scopeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setScopeFilter('all')}
              >
                全部
              </Button>
              <Button
                variant={scopeFilter === 'system' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setScopeFilter('system')}
              >
                系统
              </Button>
              <Button
                variant={scopeFilter === 'company' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setScopeFilter('company')}
              >
                公司
              </Button>
            </div>

            {/* Company Filter */}
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="选择公司" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部公司</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Framework List */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : frameworks.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>暂无框架</p>
                </div>
              ) : (
                frameworks.map((framework) => (
                  <div
                    key={framework.id}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors',
                      selectedFramework?.id === framework.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => setSelectedFramework(framework)}
                  >
                    <LayoutTemplate className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{framework.name}</span>
                        {framework.isDefault && (
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {getScopeBadge(framework)}
                        <span className="text-xs text-muted-foreground">
                          {framework.chapterCount}章
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted-foreground/10 rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditFramework(framework)}>
                          <Edit className="h-4 w-4 mr-2" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSelectedFramework(framework)}>
                          <Settings className="h-4 w-4 mr-2" />
                          配置章节
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {!framework.isSystem && (
                          <DropdownMenuItem onClick={() => handleSetDefault(framework.id, !framework.isDefault)}>
                            {framework.isDefault ? (
                              <>
                                <StarOff className="h-4 w-4 mr-2" />
                                取消默认
                              </>
                            ) : (
                              <>
                                <Star className="h-4 w-4 mr-2" />
                                设为默认
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {!framework.isSystem && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeletingItem({ type: 'framework', id: framework.id, name: framework.name });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Framework Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFramework ? (
            <>
              {/* Toolbar */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{selectedFramework.name}</h2>
                      {getScopeBadge(selectedFramework)}
                      {selectedFramework.isDefault && (
                        <Badge variant="default" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          默认
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedFramework.description || '暂无描述'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setParseDialogOpen(true)}>
                      <FileUp className="h-4 w-4 mr-2" />
                      导入文档
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfigDialogOpen(true)}>
                      <Settings className="h-4 w-4 mr-2" />
                      页面配置
                    </Button>
                    <Button size="sm" onClick={() => handleCreateChapter()}>
                      <Plus className="h-4 w-4 mr-2" />
                      添加章节
                    </Button>
                  </div>
                </div>
              </div>

              {/* Chapters */}
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {chapters.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>暂无章节</p>
                      <p className="text-sm mt-1">点击"导入文档"或"添加章节"开始</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {chapters.map((chapter) => (
                        <ChapterItem
                          key={chapter.id}
                          chapter={chapter}
                          onEdit={handleEditChapter}
                          onDelete={(ch) => {
                            setDeletingItem({ type: 'chapter', id: ch.id, name: ch.title });
                            setDeleteDialogOpen(true);
                          }}
                          onAddChild={(ch) => handleCreateChapter(ch.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <LayoutTemplate className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>选择一个框架查看详情</p>
                <p className="text-sm mt-1">或点击"新建框架"创建新框架</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Framework Dialog */}
      <Dialog open={frameworkDialogOpen} onOpenChange={setFrameworkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFramework ? '编辑框架' : '新建框架'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称 *</Label>
              <Input
                value={frameworkForm.name}
                onChange={(e) => setFrameworkForm({ ...frameworkForm, name: e.target.value })}
                placeholder="框架名称"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>代码</Label>
                <Input
                  value={frameworkForm.code}
                  onChange={(e) => setFrameworkForm({ ...frameworkForm, code: e.target.value })}
                  placeholder="可选，唯一标识"
                />
              </div>
              <div className="space-y-2">
                <Label>分类</Label>
                <Select
                  value={frameworkForm.category}
                  onValueChange={(value) => setFrameworkForm({ ...frameworkForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用</SelectItem>
                    <SelectItem value="technical">技术标</SelectItem>
                    <SelectItem value="commercial">商务标</SelectItem>
                    <SelectItem value="price">价格标</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>归属公司</Label>
              <Select
                value={frameworkForm.companyId || "public"}
                onValueChange={(value) => setFrameworkForm({ ...frameworkForm, companyId: value === "public" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="不选择则为公共框架" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">公共框架（所有公司可用）</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                选择公司后，该框架仅对该公司可见，并可设为公司默认框架
              </p>
            </div>

            {frameworkForm.companyId && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={frameworkForm.isDefault}
                  onCheckedChange={(checked) => setFrameworkForm({ ...frameworkForm, isDefault: checked })}
                />
                <Label htmlFor="isDefault">设为公司默认框架</Label>
              </div>
            )}

            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={frameworkForm.description}
                onChange={(e) => setFrameworkForm({ ...frameworkForm, description: e.target.value })}
                placeholder="框架描述"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFrameworkDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveFramework}>
              {editingFramework ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chapter Dialog */}
      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingChapter ? '编辑章节' : '添加章节'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">标题 *</Label>
              <Input
                value={chapterForm.title}
                onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">层级</Label>
              <Select
                value={chapterForm.level.toString()}
                onValueChange={(value) => setChapterForm({ ...chapterForm, level: parseInt(value) })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">一级标题</SelectItem>
                  <SelectItem value="2">二级标题</SelectItem>
                  <SelectItem value="3">三级标题</SelectItem>
                  <SelectItem value="4">四级标题</SelectItem>
                  <SelectItem value="5">五级标题</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">章节编码</Label>
              <Input
                value={chapterForm.chapterCode}
                onChange={(e) => setChapterForm({ ...chapterForm, chapterCode: e.target.value })}
                placeholder="如：1.1、2.3.1"
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">内容类型</Label>
              <Select
                value={chapterForm.contentType}
                onValueChange={(value) => setChapterForm({ ...chapterForm, contentType: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">文本</SelectItem>
                  <SelectItem value="table">表格</SelectItem>
                  <SelectItem value="image">图片</SelectItem>
                  <SelectItem value="chart">图表</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">必填</Label>
              <div className="col-span-3 flex items-center">
                <Switch
                  checked={chapterForm.required}
                  onCheckedChange={(checked) => setChapterForm({ ...chapterForm, required: checked })}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">字数范围</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  type="number"
                  value={chapterForm.wordCountMin}
                  onChange={(e) => setChapterForm({ ...chapterForm, wordCountMin: e.target.value })}
                  placeholder="最少"
                  className="w-24"
                />
                <span>-</span>
                <Input
                  type="number"
                  value={chapterForm.wordCountMax}
                  onChange={(e) => setChapterForm({ ...chapterForm, wordCountMax: e.target.value })}
                  placeholder="最多"
                  className="w-24"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">内容模板</Label>
              <Textarea
                value={chapterForm.contentTemplate}
                onChange={(e) => setChapterForm({ ...chapterForm, contentTemplate: e.target.value })}
                placeholder="章节内容模板，支持变量替换"
                className="col-span-3"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveChapter}>
              {editingChapter ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parse Dialog */}
      <Dialog open={parseDialogOpen} onOpenChange={setParseDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>导入文档解析</DialogTitle>
            <DialogDescription>
              输入文档URL，系统将自动识别文档中的标题层级
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input
                value={parseUrl}
                onChange={(e) => setParseUrl(e.target.value)}
                placeholder="输入文档URL（支持PDF、Word、TXT等格式）"
                className="flex-1"
              />
              <Button onClick={handleParseDocument} disabled={parsing}>
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : '解析'}
              </Button>
            </div>

            {parsedChapters.length > 0 && (
              <div className="border rounded-lg p-4 max-h-96 overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">识别到 {parsedChapters.length} 个标题</span>
                  <Button size="sm" onClick={handleImportChapters}>
                    导入到框架
                  </Button>
                </div>
                <div className="space-y-1">
                  {parsedChapters.map((ch, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm py-1"
                      style={{ paddingLeft: `${(ch.level - 1) * 16}px` }}
                    >
                      <span className="text-muted-foreground">{ch.chapterCode}</span>
                      <span>{ch.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {ch.level}级
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setParseDialogOpen(false);
              setParsedChapters([]);
              setParseUrl('');
            }}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>页面配置</DialogTitle>
            <DialogDescription>
              配置文档导出时的页面样式
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 封面配置 */}
            <Accordion type="single" collapsible defaultValue="cover">
              <AccordionItem value="cover">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    封面配置
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={configForm.cover.enabled}
                      onCheckedChange={(checked) => 
                        setConfigForm({
                          ...configForm,
                          cover: { ...configForm.cover, enabled: checked }
                        })
                      }
                    />
                    <Label>启用封面</Label>
                  </div>
                  {configForm.cover.enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>标题</Label>
                        <Input
                          value={configForm.cover.title}
                          onChange={(e) => 
                            setConfigForm({
                              ...configForm,
                              cover: { ...configForm.cover, title: e.target.value }
                            })
                          }
                          placeholder="封面标题"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>副标题</Label>
                        <Input
                          value={configForm.cover.subtitle}
                          onChange={(e) => 
                            setConfigForm({
                              ...configForm,
                              cover: { ...configForm.cover, subtitle: e.target.value }
                            })
                          }
                          placeholder="封面副标题"
                        />
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* 页眉页脚 */}
            <Accordion type="single" collapsible>
              <AccordionItem value="header-footer">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <AlignLeft className="h-4 w-4" />
                    页眉页脚
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={configForm.header.enabled}
                        onCheckedChange={(checked) => 
                          setConfigForm({
                            ...configForm,
                            header: { ...configForm.header, enabled: checked }
                          })
                        }
                      />
                      <Label>启用页眉</Label>
                    </div>
                    {configForm.header.enabled && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>左侧</Label>
                          <Input
                            value={configForm.header.left}
                            onChange={(e) => 
                              setConfigForm({
                                ...configForm,
                                header: { ...configForm.header, left: e.target.value }
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>中间</Label>
                          <Input
                            value={configForm.header.center}
                            onChange={(e) => 
                              setConfigForm({
                                ...configForm,
                                header: { ...configForm.header, center: e.target.value }
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>右侧</Label>
                          <Input
                            value={configForm.header.right}
                            onChange={(e) => 
                              setConfigForm({
                                ...configForm,
                                header: { ...configForm.header, right: e.target.value }
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={configForm.footer.enabled}
                        onCheckedChange={(checked) => 
                          setConfigForm({
                            ...configForm,
                            footer: { ...configForm.footer, enabled: checked }
                          })
                        }
                      />
                      <Label>启用页脚</Label>
                    </div>
                    {configForm.footer.enabled && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={configForm.footer.showPageNumber}
                          onCheckedChange={(checked) => 
                            setConfigForm({
                              ...configForm,
                              footer: { ...configForm.footer, showPageNumber: checked as boolean }
                            })
                          }
                        />
                        <Label>显示页码</Label>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* 目录配置 */}
            <Accordion type="single" collapsible>
              <AccordionItem value="toc">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    目录配置
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={configForm.toc.enabled}
                      onCheckedChange={(checked) => 
                        setConfigForm({
                          ...configForm,
                          toc: { ...configForm.toc, enabled: checked }
                        })
                      }
                    />
                    <Label>生成目录</Label>
                  </div>
                  {configForm.toc.enabled && (
                    <div className="space-y-2">
                      <Label>目录层级</Label>
                      <Select
                        value={configForm.toc.maxLevel.toString()}
                        onValueChange={(value) => 
                          setConfigForm({
                            ...configForm,
                            toc: { ...configForm.toc, maxLevel: parseInt(value) }
                          })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1级</SelectItem>
                          <SelectItem value="2">2级</SelectItem>
                          <SelectItem value="3">3级</SelectItem>
                          <SelectItem value="4">4级</SelectItem>
                          <SelectItem value="5">5级</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* 正文样式 */}
            <Accordion type="single" collapsible>
              <AccordionItem value="body">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    正文样式
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>字号</Label>
                      <Select
                        value={configForm.body.fontSize}
                        onValueChange={(value) => 
                          setConfigForm({
                            ...configForm,
                            body: { ...configForm.body, fontSize: value }
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10pt">10pt</SelectItem>
                          <SelectItem value="11pt">11pt</SelectItem>
                          <SelectItem value="12pt">12pt</SelectItem>
                          <SelectItem value="14pt">14pt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>行高</Label>
                      <Select
                        value={configForm.body.lineHeight}
                        onValueChange={(value) => 
                          setConfigForm({
                            ...configForm,
                            body: { ...configForm.body, lineHeight: value }
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1.0">1.0</SelectItem>
                          <SelectItem value="1.25">1.25</SelectItem>
                          <SelectItem value="1.5">1.5</SelectItem>
                          <SelectItem value="1.75">1.75</SelectItem>
                          <SelectItem value="2.0">2.0</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>字体</Label>
                      <Select
                        value={configForm.body.fontFamily}
                        onValueChange={(value) => 
                          setConfigForm({
                            ...configForm,
                            body: { ...configForm.body, fontFamily: value }
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SimSun">宋体</SelectItem>
                          <SelectItem value="SimHei">黑体</SelectItem>
                          <SelectItem value="Microsoft YaHei">微软雅黑</SelectItem>
                          <SelectItem value="KaiTi">楷体</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setConfigDialogOpen(false)}>
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deletingItem?.name}」吗？此操作不可撤销。
              {deletingItem?.type === 'framework' && (
                <span className="block mt-2 text-destructive">
                  删除框架将同时删除所有章节。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={deletingItem?.type === 'framework' ? handleDeleteFramework : handleDeleteChapter}
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
// Chapter Item Component
// ============================================

interface ChapterItemProps {
  chapter: Chapter;
  onEdit: (chapter: Chapter) => void;
  onDelete: (chapter: Chapter) => void;
  onAddChild: (chapter: Chapter) => void;
  depth?: number;
}

function ChapterItem({ chapter, onEdit, onDelete, onAddChild, depth = 0 }: ChapterItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = chapter.children && chapter.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors',
          depth > 0 && 'ml-6'
        )}
      >
        <button
          className={cn(
            'p-0.5 rounded hover:bg-muted',
            !hasChildren && 'invisible'
          )}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 transition-transform',
              expanded && 'rotate-90'
            )}
          />
        </button>
        
        <span className="text-muted-foreground text-sm w-8">
          {chapter.chapterCode}
        </span>
        
        <span className="flex-1 font-medium">{chapter.title}</span>
        
        <div className="flex items-center gap-1 text-muted-foreground">
          {chapter.required && (
            <Badge variant="outline" className="text-xs">必填</Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {chapter.level}级
          </Badge>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {chapter.level < 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onAddChild(chapter)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onEdit(chapter)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(chapter)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {hasChildren && expanded && (
        <div className="border-l ml-6 pl-1">
          {chapter.children!.map((child) => (
            <ChapterItem
              key={child.id}
              chapter={child}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

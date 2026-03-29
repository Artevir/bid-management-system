'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as _CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription as _DialogDescription,
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
  DropdownMenu as _DropdownMenu,
  DropdownMenuContent as _DropdownMenuContent,
  DropdownMenuItem as _DropdownMenuItem,
  DropdownMenuSeparator as _DropdownMenuSeparator,
  DropdownMenuTrigger as _DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator as _Separator } from '@/components/ui/separator';
import { Tabs as _Tabs, TabsContent as _TabsContent, TabsList as _TabsList, TabsTrigger as _TabsTrigger } from '@/components/ui/tabs';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Archive,
  Building2,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  Plus as _Plus,
  MoreVertical as _MoreVertical,
  Edit,
  Trash2,
  Download,
  Upload,
  Eye,
  Calendar,
  FileStack,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight as _ArrowRight,
  Package,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface ArchiveItem {
  id: number;
  type: 'company' | 'project' | 'archive';
  name: string;
  code?: string;
  shortName?: string;
  tenderCode?: string;
  tenderOrganization?: string;
  archiveCount?: number;
  archiveDate?: string;
  bidResult?: string;
  documentCount?: number;
  fileCount?: number;
  children?: ArchiveItem[];
}

interface ArchiveDetail {
  id: number;
  projectId: number;
  projectName: string;
  projectCode: string;
  tenderCode?: string;
  tenderOrganization?: string;
  tenderAgent?: string;
  budget?: string;
  archiveType: string;
  archiveDate: string;
  bidResult: string;
  documentCount: number;
  fileCount: number;
  summary?: string;
  notes?: string;
  companyId?: number;
  companyName?: string;
  documents: ArchiveDocument[];
  files: ArchiveFile[];
}

interface ArchiveDocument {
  id: number;
  documentName: string;
  documentVersion: number;
  documentStatus: string;
  chapterCount: number;
  wordCount: number;
  createdAt: string;
}

interface ArchiveFile {
  id: number;
  fileName: string;
  filePath: string;
  fileSize?: number;
  fileType?: string;
  category?: string;
  description?: string;
  uploader?: { id: number; realName: string };
  createdAt: string;
}

// ============================================
// Main Component
// ============================================

export default function ArchivesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ArchivesContent />
    </Suspense>
  );
}

function ArchivesContent() {
  const _router = useRouter();
  const _searchParams = useSearchParams();

  // State
  const [tree, setTree] = useState<ArchiveItem[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<ArchiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<number>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  // Filters
  const [searchKeyword, setSearchKeyword] = useState('');
  const [_viewMode, _setViewMode] = useState<'tree' | 'list'>('tree');

  // Dialogs
  const [_detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({
    bidResult: '',
    summary: '',
    notes: '',
  });

  // ============================================
  // Data Fetching
  // ============================================

  const fetchArchiveTree = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/archives?view=tree');
      const data = await response.json();
      setTree(data.tree || []);
    } catch (error) {
      console.error('Failed to fetch archive tree:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArchiveDetail = async (archiveId: number) => {
    try {
      const response = await fetch(`/api/archives/${archiveId}`);
      const data = await response.json();
      setSelectedArchive(data.archive);
      setDetailDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch archive detail:', error);
    }
  };

  useEffect(() => {
    fetchArchiveTree();
  }, [fetchArchiveTree]);

  // ============================================
  // Actions
  // ============================================

  const handleUpdateArchive = async () => {
    if (!selectedArchive) return;

    try {
      const response = await fetch(`/api/archives/${selectedArchive.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新失败');
      }

      setEditDialogOpen(false);
      fetchArchiveDetail(selectedArchive.id);
      fetchArchiveTree();
    } catch (error: any) {
      alert(error.message || '更新失败');
    }
  };

  const handleDeleteArchive = async () => {
    if (!selectedArchive) return;

    try {
      const response = await fetch(`/api/archives/${selectedArchive.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      setDeleteDialogOpen(false);
      setDetailDialogOpen(false);
      setSelectedArchive(null);
      fetchArchiveTree();
    } catch (error: any) {
      alert(error.message || '删除失败');
    }
  };

  // ============================================
  // Render Helpers
  // ============================================

  const getBidResultBadge = (result: string) => {
    switch (result) {
      case 'awarded':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />中标</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/10 text-red-600 border-red-200"><XCircle className="h-3 w-3 mr-1" />未中标</Badge>;
      case 'withdrawn':
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-200">撤回</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200"><Clock className="h-3 w-3 mr-1" />待定</Badge>;
    }
  };

  const toggleCompany = (companyId: number) => {
    const newSet = new Set(expandedCompanies);
    if (newSet.has(companyId)) {
      newSet.delete(companyId);
    } else {
      newSet.add(companyId);
    }
    setExpandedCompanies(newSet);
  };

  const toggleProject = (projectId: number) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(projectId)) {
      newSet.delete(projectId);
    } else {
      newSet.add(projectId);
    }
    setExpandedProjects(newSet);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            <h1 className="text-2xl font-semibold tracking-tight">标书归档</h1>
            <p className="text-sm text-muted-foreground">
              按公司-项目层级管理已完结的投标项目
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchArchiveTree}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Archive Tree */}
        <div className="w-80 border-r bg-muted/30 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索归档..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Tree */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : tree.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无归档数据</p>
                  <p className="text-sm mt-1">项目投标完结后将自动归档</p>
                </div>
              ) : (
                tree.map((company) => (
                  <div key={company.id} className="mb-1">
                    {/* Company Node */}
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left"
                      onClick={() => toggleCompany(company.id)}
                    >
                      {expandedCompanies.has(company.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-medium flex-1 truncate">
                        {company.shortName || company.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {company.archiveCount}
                      </Badge>
                    </button>

                    {/* Projects under Company */}
                    {expandedCompanies.has(company.id) && company.children && (
                      <div className="ml-4 border-l pl-2 mt-1 space-y-1">
                        {company.children.map((project) => (
                          <div key={project.id}>
                            {/* Project Node */}
                            <button
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors text-left"
                              onClick={() => toggleProject(project.id)}
                            >
                              {expandedProjects.has(project.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <FolderOpen className="h-4 w-4 text-orange-500" />
                              <span className="flex-1 truncate text-sm">
                                {project.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {project.archiveCount}
                              </Badge>
                            </button>

                            {/* Archives under Project */}
                            {expandedProjects.has(project.id) && project.children && (
                              <div className="ml-4 border-l pl-2 mt-1 space-y-1">
                                {project.children.map((archive) => (
                                  <button
                                    key={archive.id}
                                    className={cn(
                                      'w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left text-sm',
                                      selectedArchive?.id === archive.id
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-muted'
                                    )}
                                    onClick={() => fetchArchiveDetail(archive.id)}
                                  >
                                    <Archive className="h-4 w-4 text-muted-foreground" />
                                    <span className="flex-1 truncate">
                                      {archive.archiveDate 
                                        ? new Date(archive.archiveDate).toLocaleDateString()
                                        : '归档'}
                                    </span>
                                    {archive.bidResult && getBidResultBadge(archive.bidResult)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Archive Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedArchive ? (
            <>
              {/* Detail Header */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{selectedArchive.projectName}</h2>
                      {getBidResultBadge(selectedArchive.bidResult)}
                      {selectedArchive.archiveType === 'auto' && (
                        <Badge variant="outline" className="text-xs">自动归档</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      项目编号：{selectedArchive.projectCode}
                      {selectedArchive.tenderCode && ` | 招标编号：${selectedArchive.tenderCode}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditForm({
                        bidResult: selectedArchive.bidResult,
                        summary: selectedArchive.summary || '',
                        notes: selectedArchive.notes || '',
                      });
                      setEditDialogOpen(true);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </Button>
                  </div>
                </div>
              </div>

              {/* Detail Content */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                  {/* Basic Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">基本信息</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">招标单位：</span>
                          <span>{selectedArchive.tenderOrganization || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">招标代理：</span>
                          <span>{selectedArchive.tenderAgent || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">预算金额：</span>
                          <span>{selectedArchive.budget || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">归档日期：</span>
                          <span>{new Date(selectedArchive.archiveDate).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">所属公司：</span>
                          <span>{selectedArchive.companyName || '未分配'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">归档方式：</span>
                          <span>{selectedArchive.archiveType === 'auto' ? '自动归档' : '手动归档'}</span>
                        </div>
                      </div>
                      {selectedArchive.summary && (
                        <div className="mt-4 pt-4 border-t">
                          <span className="text-muted-foreground text-sm">摘要：</span>
                          <p className="mt-1 text-sm">{selectedArchive.summary}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{selectedArchive.documentCount}</p>
                            <p className="text-xs text-muted-foreground">文档数量</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <Package className="h-5 w-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{selectedArchive.fileCount}</p>
                            <p className="text-xs text-muted-foreground">附件数量</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">
                              {new Date(selectedArchive.archiveDate).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">归档日期</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Documents */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">归档文档</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedArchive.documents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          暂无归档文档
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedArchive.documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{doc.documentName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    V{doc.documentVersion} | {doc.chapterCount}章 | {doc.wordCount}字
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {doc.documentStatus}
                                </Badge>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Files */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">归档附件</CardTitle>
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          上传
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {selectedArchive.files.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          暂无归档附件
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedArchive.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <FileStack className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{file.fileName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.fileSize)}
                                    {file.uploader && ` | ${file.uploader.realName}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {file.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {file.category}
                                  </Badge>
                                )}
                                <Button variant="ghost" size="sm">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Notes */}
                  {selectedArchive.notes && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">备注</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedArchive.notes}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>选择归档查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑归档信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>投标结果</Label>
              <Select
                value={editForm.bidResult}
                onValueChange={(value) => setEditForm({ ...editForm, bidResult: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待定</SelectItem>
                  <SelectItem value="awarded">中标</SelectItem>
                  <SelectItem value="lost">未中标</SelectItem>
                  <SelectItem value="withdrawn">撤回</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>摘要</Label>
              <Textarea
                value={editForm.summary}
                onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                placeholder="归档摘要"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="备注信息"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateArchive}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除归档「{selectedArchive?.projectName}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={handleDeleteArchive}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

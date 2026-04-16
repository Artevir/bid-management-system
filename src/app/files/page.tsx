'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListStateBlock } from '@/components/ui/list-states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Search,
  Loader2,
  AlertCircle,
  FileText as _FileText,
  Download,
  Trash2,
  Eye,
  X,
  FolderOpen,
} from 'lucide-react';
import {
  DOCUMENT_SECURITY_LABELS,
  DOCUMENT_SECURITY_COLORS,
  FILE_CATEGORY_LABELS as _FILE_CATEGORY_LABELS,
  FileCategoryType as _FileCategoryType,
  DocumentSecurityLevel,
} from '@/types/document';
import { extractErrorMessage } from '@/lib/error-message';

interface FileItem {
  id: number;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  extension: string | null;
  categoryId: number | null;
  categoryName: string | null;
  securityLevel: DocumentSecurityLevel;
  currentVersion: number;
  uploaderId: number;
  uploaderName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  signedUrl?: string;
}

interface FileCategory {
  id: number;
  name: string;
  code: string;
  category: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 搜索和筛选
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSecurity, setFilterSecurity] = useState<string>('all');

  // 上传对话框
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    categoryId: '',
    securityLevel: 'internal' as DocumentSecurityLevel,
  });

  // 文件详情对话框
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedFileItem, setSelectedFileItem] = useState<FileItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFiles();
    fetchCategories();
  }, [page, filterCategory, filterSecurity]);

  const fetchFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (searchTerm) params.set('keyword', searchTerm);
      if (filterCategory && filterCategory !== 'all') params.set('categoryId', filterCategory);
      if (filterSecurity && filterSecurity !== 'all') params.set('securityLevel', filterSecurity);

      const res = await fetch(`/api/files?${params}`);
      if (!res.ok) {
        throw new Error('获取文件列表失败');
      }

      const data = await res.json();
      setFiles(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/files?categories=true');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchFiles();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('请选择要上传的文件');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (uploadForm.categoryId) {
        formData.append('categoryId', uploadForm.categoryId);
      }
      formData.append('securityLevel', uploadForm.securityLevel);

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '文件上传失败'));
      }

      // 关闭对话框并刷新列表
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadForm({ categoryId: '', securityLevel: 'internal' });
      fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/${file.id}/download`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '获取下载链接失败'));
      }

      // 使用 fetch + blob 模式下载
      const response = await fetch(data.downloadUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.originalName;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载文件失败');
    }
  };

  const handleDelete = async (fileId: number) => {
    if (!confirm('确定要删除此文件吗？')) {
      return;
    }

    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '删除文件失败'));
      }

      fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除文件失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const getSecurityBadge = (level: DocumentSecurityLevel) => {
    const colorMap: Record<string, string> = {
      green: 'bg-green-100 text-green-800',
      blue: 'bg-blue-100 text-blue-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800',
    };
    const color = DOCUMENT_SECURITY_COLORS[level];
    return <Badge className={colorMap[color]}>{DOCUMENT_SECURITY_LABELS[level]}</Badge>;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️';
    return '📁';
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文件管理</h1>
          <p className="text-muted-foreground">管理项目相关文件</p>
        </div>

        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          上传文件
        </Button>
      </div>

      {/* 上传对话框 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上传文件</DialogTitle>
            <DialogDescription>选择文件并设置相关属性</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{String(error)}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>选择文件</Label>
              <Input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded mt-2">
                  <span>{getFileIcon(selectedFile.type)}</span>
                  <span className="text-sm">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({formatFileSize(selectedFile.size)})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>文件分类</Label>
              <Select
                value={uploadForm.categoryId}
                onValueChange={(value) => setUploadForm({ ...uploadForm, categoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择文件分类" />
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
              <Label>文档密级</Label>
              <Select
                value={uploadForm.securityLevel}
                onValueChange={(value) =>
                  setUploadForm({
                    ...uploadForm,
                    securityLevel: value as DocumentSecurityLevel,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择文档密级" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_SECURITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              上传
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 文件详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>文件详情</DialogTitle>
          </DialogHeader>
          {selectedFileItem && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{getFileIcon(selectedFileItem.mimeType)}</div>
                <div>
                  <p className="font-medium">{selectedFileItem.originalName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFileItem.extension?.toUpperCase()} ·{' '}
                    {formatFileSize(selectedFileItem.size)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">上传者</p>
                  <p>{selectedFileItem.uploaderName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">上传时间</p>
                  <p>{formatDate(selectedFileItem.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">文档密级</p>
                  {getSecurityBadge(selectedFileItem.securityLevel)}
                </div>
                <div>
                  <p className="text-muted-foreground">文件版本</p>
                  <p>v{selectedFileItem.currentVersion}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">文件分类</p>
                  <p>{selectedFileItem.categoryName || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">MIME类型</p>
                  <p className="truncate">{selectedFileItem.mimeType}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (selectedFileItem.signedUrl) {
                      window.open(selectedFileItem.signedUrl, '_blank');
                    }
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  预览
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDownload(selectedFileItem)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索文件名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="文件分类" />
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
            <Select value={filterSecurity} onValueChange={setFilterSecurity}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="文档密级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部密级</SelectItem>
                {Object.entries(DOCUMENT_SECURITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 文件列表 */}
      <Card>
        <CardHeader>
          <CardTitle>文件列表</CardTitle>
          <CardDescription>共 {total} 个文件</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <ListStateBlock state="loading" />
          ) : files.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无文件数据" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文件名</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>密级</TableHead>
                  <TableHead>上传者</TableHead>
                  <TableHead>上传时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getFileIcon(file.mimeType)}</span>
                        <div>
                          <div className="font-medium">{file.originalName}</div>
                          <div className="text-xs text-muted-foreground">
                            {file.extension?.toUpperCase() || '未知'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(file.size)}</TableCell>
                    <TableCell>{file.categoryName || '-'}</TableCell>
                    <TableCell>{getSecurityBadge(file.securityLevel)}</TableCell>
                    <TableCell>{file.uploaderName}</TableCell>
                    <TableCell>{formatDate(file.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedFileItem(file);
                            setDetailDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(file)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(file.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* 分页 */}
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total}{' '}
                条
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

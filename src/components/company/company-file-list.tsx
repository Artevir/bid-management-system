/**
 * 公司文件列表组件
 */

'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { cn } from '@/lib/utils';
import { 
  Download, 
  Trash2, 
  Search, 
  MoreHorizontal,
  FileText,
  FileIcon,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

// 文件类型映射
const FILE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  business_license: { label: '营业执照', color: 'bg-blue-500' },
  business_certificate: { label: '商务资质证书', color: 'bg-green-500' },
  personnel_certificate: { label: '人员资质', color: 'bg-purple-500' },
  performance_scan: { label: '业绩扫描件', color: 'bg-orange-500' },
  contract: { label: '合同文件', color: 'bg-cyan-500' },
  financial_statement: { label: '财务报表', color: 'bg-pink-500' },
  tax_certificate: { label: '税务证明', color: 'bg-yellow-500' },
  other: { label: '其他文件', color: 'bg-gray-500' },
};

// 文件类型选项
const FILE_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  ...Object.entries(FILE_TYPE_LABELS).map(([value, { label }]) => ({ value, label })),
];

interface CompanyFile {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: string;
  fileExt: string;
  fileUrl?: string;
  description?: string;
  validFrom?: string;
  validTo?: string;
  uploaderId: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface CompanyFileListProps {
  files: CompanyFile[];
  companyId: number;
  onDeleteFile: (fileId: number) => Promise<void>;
  onRefresh?: () => void;
  className?: string;
}

// 检查文件是否即将到期
function isExpiring(validTo?: string, days: number = 30): boolean {
  if (!validTo) return false;
  const expiryDate = new Date(validTo);
  const now = new Date();
  const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > 0 && diffDays <= days;
}

// 检查文件是否已过期
function isExpired(validTo?: string): boolean {
  if (!validTo) return false;
  return new Date(validTo) < new Date();
}

// 获取文件状态
function getFileStatus(file: CompanyFile): 'normal' | 'expiring' | 'expired' {
  if (isExpired(file.validTo)) return 'expired';
  if (isExpiring(file.validTo)) return 'expiring';
  return 'normal';
}

// 获取文件图标
function getFileIcon(ext?: string) {
  if (!ext) return FileIcon;
  const extLower = ext.toLowerCase();
  if (['pdf'].includes(extLower)) return FileText;
  return FileIcon;
}

export function CompanyFileList({
  files,
  companyId,
  onDeleteFile,
  onRefresh,
  className,
}: CompanyFileListProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<CompanyFile | null>(null);

  // 筛选文件
  const filteredFiles = files.filter(file => {
    // 类型筛选
    if (filterType !== 'all' && file.fileType !== filterType) {
      return false;
    }
    
    // 关键词筛选
    if (searchKeyword && !file.fileName.toLowerCase().includes(searchKeyword.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(filteredFiles.map(f => f.id));
    } else {
      setSelectedFiles([]);
    }
  };

  // 单个选择
  const handleSelect = (fileId: number, checked: boolean) => {
    if (checked) {
      setSelectedFiles(prev => [...prev, fileId]);
    } else {
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
    }
  };

  // 打开删除确认
  const openDeleteDialog = (file: CompanyFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  // 处理文件删除
  const handleDelete = async () => {
    if (!fileToDelete) return;
    
    setDeletingFileId(fileToDelete.id);
    try {
      await onDeleteFile(fileToDelete.id);
      toast.success('文件删除成功');
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error('文件删除失败');
    } finally {
      setDeletingFileId(null);
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedFiles.length === 0) return;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const fileId of selectedFiles) {
      try {
        await onDeleteFile(fileId);
        successCount++;
      } catch {
        failCount++;
      }
    }
    
    if (successCount > 0) {
      toast.success(`成功删除 ${successCount} 个文件`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} 个文件删除失败`);
    }
    
    setSelectedFiles([]);
    if (onRefresh) onRefresh();
  };

  // 处理文件下载
  const handleDownload = (file: CompanyFile) => {
    if (!file.fileUrl) {
      toast.error('文件链接不存在');
      return;
    }
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = file.fileUrl;
    link.download = `${file.fileName}.${file.fileExt}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 筛选栏 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="文件类型" />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索文件名..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="flex-1"
          />
        </div>

        {/* 批量操作 */}
        {selectedFiles.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setFileToDelete(null);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            删除选中 ({selectedFiles.length})
          </Button>
        )}
      </div>

      {/* 文件列表 */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <FileIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>暂无文件数据</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedFiles.length === filteredFiles.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>文件名称</TableHead>
                <TableHead className="w-32">文件类型</TableHead>
                <TableHead className="w-24">文件大小</TableHead>
                <TableHead className="w-28">有效期</TableHead>
                <TableHead className="w-28">上传时间</TableHead>
                <TableHead className="w-20">状态</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map((file) => {
                const status = getFileStatus(file);
                const FileIconComponent = getFileIcon(file.fileExt);
                const typeInfo = FILE_TYPE_LABELS[file.fileType] || FILE_TYPE_LABELS.other;
                
                return (
                  <TableRow
                    key={file.id}
                    className={cn(
                      status === 'expired' && 'bg-red-50/50',
                      status === 'expiring' && 'bg-yellow-50/50'
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedFiles.includes(file.id)}
                        onCheckedChange={(checked) => handleSelect(file.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileIconComponent className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate" title={file.fileName}>
                            {file.fileName}
                          </p>
                          {file.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {file.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-white', typeInfo.color)}>
                        {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {file.fileSize || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {file.validTo ? (
                          <div className="flex items-center gap-1">
                            {status === 'expired' && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                            {status === 'expiring' && (
                              <Clock className="h-4 w-4 text-yellow-500" />
                            )}
                            {status === 'normal' && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            <span className={cn(
                              status === 'expired' && 'text-red-600',
                              status === 'expiring' && 'text-yellow-600'
                            )}>
                              {formatDate(file.validTo)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">长期有效</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(file.createdAt)}
                    </TableCell>
                    <TableCell>
                      {status === 'expired' ? (
                        <Badge variant="destructive">已过期</Badge>
                      ) : status === 'expiring' ? (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                          即将到期
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          正常
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(file)}>
                            <Download className="h-4 w-4 mr-2" />
                            下载
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => openDeleteDialog(file)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {fileToDelete ? (
                <>
                  确定要删除文件 <span className="font-medium">"{fileToDelete.fileName}"</span> 吗？
                  此操作无法撤销。
                </>
              ) : selectedFiles.length > 0 ? (
                <>确定要删除选中的 {selectedFiles.length} 个文件吗？此操作无法撤销。</>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={fileToDelete ? handleDelete : handleBatchDelete}
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

/**
 * 公司文件上传组件
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  Upload, 
  FileText as _FileText, 
  X, 
  AlertCircle, 
  CheckCircle2,
  Calendar as _Calendar,
  FileIcon,
} from 'lucide-react';
import { toast } from 'sonner';

// 文件类型映射
const FILE_TYPE_OPTIONS = [
  { value: 'business_license', label: '营业执照', accept: '.pdf,.jpg,.jpeg,.png' },
  { value: 'business_certificate', label: '商务资质证书', accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx' },
  { value: 'personnel_certificate', label: '人员资质', accept: '.pdf,.jpg,.jpeg,.png' },
  { value: 'performance_scan', label: '业绩扫描件', accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx' },
  { value: 'contract', label: '合同文件', accept: '.pdf,.doc,.docx' },
  { value: 'financial_statement', label: '财务报表', accept: '.pdf,.xls,.xlsx' },
  { value: 'tax_certificate', label: '税务证明', accept: '.pdf,.jpg,.jpeg,.png' },
  { value: 'other', label: '其他文件', accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx' },
] as const;

type FileType = typeof FILE_TYPE_OPTIONS[number]['value'];

interface FileWithMeta {
  file: File;
  name: string;
  type: FileType;
  description: string;
  validFrom: string;
  validTo: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface CompanyFileUploaderProps {
  companyId: number;
  onUploadComplete?: () => void;
  className?: string;
}

// 文件大小限制（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function CompanyFileUploader({
  companyId,
  onUploadComplete,
  className,
}: CompanyFileUploaderProps) {
  const [files, setFiles] = useState<FileWithMeta[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // 处理文件选择
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: FileWithMeta[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} 文件大小超过10MB限制`);
        continue;
      }
      
      // 根据文件名自动匹配类型
      let fileType: FileType = 'other';
      const nameLower = file.name.toLowerCase();
      if (nameLower.includes('营业执照') || nameLower.includes('license')) {
        fileType = 'business_license';
      } else if (nameLower.includes('资质')) {
        fileType = 'business_certificate';
      } else if (nameLower.includes('业绩')) {
        fileType = 'performance_scan';
      } else if (nameLower.includes('合同')) {
        fileType = 'contract';
      } else if (nameLower.includes('财务')) {
        fileType = 'financial_statement';
      } else if (nameLower.includes('税务') || nameLower.includes('纳税')) {
        fileType = 'tax_certificate';
      }
      
      newFiles.push({
        file,
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: fileType,
        description: '',
        validFrom: '',
        validTo: '',
        progress: 0,
        status: 'pending',
      });
    }
    
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  // 拖拽处理
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // 触发文件选择
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 移除文件
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 更新文件信息
  const updateFile = (index: number, updates: Partial<FileWithMeta>) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  // 上传单个文件
  const uploadFile = async (fileMeta: FileWithMeta, index: number): Promise<boolean> => {
    try {
      updateFile(index, { status: 'uploading', progress: 10 });
      
      const formData = new FormData();
      formData.append('file', fileMeta.file);
      formData.append('fileType', fileMeta.type);
      formData.append('fileName', fileMeta.name);
      if (fileMeta.description) formData.append('description', fileMeta.description);
      if (fileMeta.validFrom) formData.append('validFrom', fileMeta.validFrom);
      if (fileMeta.validTo) formData.append('validTo', fileMeta.validTo);

      updateFile(index, { progress: 30 });

      const response = await fetch(`/api/companies/${companyId}/files`, {
        method: 'POST',
        body: formData,
      });

      updateFile(index, { progress: 80 });

      const result = await response.json();

      if (response.ok && result.success) {
        updateFile(index, { status: 'success', progress: 100 });
        return true;
      } else {
        throw new Error(result.error || '上传失败');
      }
    } catch (error) {
      updateFile(index, { 
        status: 'error', 
        error: error instanceof Error ? error.message : '上传失败' 
      });
      return false;
    }
  };

  // 上传所有文件
  const uploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      toast.warning('没有待上传的文件');
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'pending') {
        const success = await uploadFile(files[i], i);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`成功上传 ${successCount} 个文件`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} 个文件上传失败`);
    }

    if (successCount > 0 && onUploadComplete) {
      onUploadComplete();
    }
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          文件上传
        </CardTitle>
        <CardDescription>
          上传公司相关资质文件，单文件最大10MB
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 隐藏的文件输入 */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        />

        {/* 拖拽区域 */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          )}
          onClick={triggerFileSelect}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-2">
            点击或拖拽文件到此处上传
          </p>
          <p className="text-xs text-muted-foreground">
            支持 PDF, JPG, PNG, DOC, DOCX, XLS, XLSX 格式，单文件最大10MB
          </p>
        </div>

        {/* 文件列表 */}
        {files.length > 0 && (
          <div className="space-y-4 mt-4">
            <div className="text-sm font-medium">待上传文件 ({files.length})</div>
            
            {files.map((fileMeta, index) => (
              <div
                key={index}
                className={cn(
                  'border rounded-lg p-4 space-y-3',
                  fileMeta.status === 'error' && 'border-destructive/50 bg-destructive/5',
                  fileMeta.status === 'success' && 'border-green-500/50 bg-green-500/5'
                )}
              >
                {/* 文件信息行 */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{fileMeta.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(fileMeta.file.size)}
                      </p>
                    </div>
                  </div>
                  
                  {fileMeta.status === 'pending' && !isUploading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {fileMeta.status === 'success' && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  
                  {fileMeta.status === 'error' && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* 文件配置 */}
                {fileMeta.status === 'pending' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">文件名称</label>
                      <Input
                        placeholder="文件名称"
                        value={fileMeta.name}
                        onChange={(e) => updateFile(index, { name: e.target.value })}
                        disabled={isUploading}
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">文件类型</label>
                      <Select
                        value={fileMeta.type}
                        onValueChange={(value) => updateFile(index, { type: value as FileType })}
                        disabled={isUploading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择类型" />
                        </SelectTrigger>
                        <SelectContent>
                          {FILE_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">生效日期</label>
                      <Input
                        type="date"
                        value={fileMeta.validFrom}
                        onChange={(e) => updateFile(index, { validFrom: e.target.value })}
                        disabled={isUploading}
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">失效日期</label>
                      <Input
                        type="date"
                        value={fileMeta.validTo}
                        onChange={(e) => updateFile(index, { validTo: e.target.value })}
                        disabled={isUploading}
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block">文件描述</label>
                      <Textarea
                        placeholder="文件描述（选填）"
                        value={fileMeta.description}
                        onChange={(e) => updateFile(index, { description: e.target.value })}
                        className="min-h-[60px]"
                        disabled={isUploading}
                      />
                    </div>
                  </div>
                )}

                {/* 上传进度 */}
                {fileMeta.status === 'uploading' && (
                  <Progress value={fileMeta.progress} className="h-2" />
                )}

                {/* 错误信息 */}
                {fileMeta.status === 'error' && fileMeta.error && (
                  <p className="text-sm text-destructive">{fileMeta.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {files.some(f => f.status === 'pending') && (
        <CardFooter>
          <Button
            onClick={uploadAll}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                上传 {files.filter(f => f.status === 'pending').length} 个文件
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// 导入Loader2图标
import { Loader2 } from 'lucide-react';

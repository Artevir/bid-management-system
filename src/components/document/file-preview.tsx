'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs as _Tabs, TabsContent as _TabsContent, TabsList as _TabsList, TabsTrigger as _TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator as _Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
} from 'lucide-react';

// 文件类型定义
type FileType = 'pdf' | 'word' | 'excel' | 'image' | 'text' | 'other';

interface FilePreviewProps {
  fileId: number;
  fileName: string;
  fileUrl?: string;
  onDownload?: () => void;
}

interface FileInfo {
  id: number;
  name: string;
  type: string;
  size: number;
  mimeType: string;
  url: string;
  previewUrl?: string;
  pageCount?: number;
}

// 获取文件类型图标
const getFileIcon = (mimeType: string): React.ElementType => {
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return FileSpreadsheet;
  if (mimeType.includes('image')) return FileImage;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return FileArchive;
  return File;
};

// 获取文件类型
const getFileType = (mimeType: string): FileType => {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('text') || mimeType.includes('markdown')) return 'text';
  return 'other';
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export function FilePreview({ fileId, fileName: _fileName, fileUrl: _fileUrl, onDownload }: FilePreviewProps) {
  const [fileInfo, setFileInfo] = React.useState<FileInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [zoom, setZoom] = React.useState(100);
  const [rotation, setRotation] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, _setTotalPages] = React.useState(1);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [textContent, setTextContent] = React.useState<string>('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 加载文件信息
  React.useEffect(() => {
    loadFileInfo();
  }, [fileId]);

  const loadFileInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/files/${fileId}`);
      if (!res.ok) {
        throw new Error('获取文件信息失败');
      }
      const data = await res.json();
      setFileInfo(data);

      // 如果是文本文件，加载内容
      const fileType = getFileType(data.mimeType);
      if (fileType === 'text' || fileType === 'word') {
        await loadTextContent(data.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文件失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTextContent = async (url: string) => {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        setTextContent(text);
      }
    } catch (err) {
      console.error('Load text content error:', err);
    }
  };

  // 缩放操作
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  // 旋转操作
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  // 全屏切换
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // 页面导航
  const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  // 渲染加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 渲染错误状态
  if (error || !fileInfo) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || '文件不存在'}</AlertDescription>
      </Alert>
    );
  }

  const fileType = getFileType(fileInfo.mimeType);
  const FileIcon = getFileIcon(fileInfo.mimeType);

  // 渲染预览内容
  const renderPreview = () => {
    switch (fileType) {
      case 'pdf':
        return (
          <div className="relative w-full h-full">
            <iframe
              src={`${fileInfo.url}#page=${currentPage}&zoom=${zoom}`}
              className="w-full h-full border-0"
              title={fileInfo.name}
            />
          </div>
        );

      case 'image':
        return (
          <div className="flex items-center justify-center h-full bg-muted/30">
            <img
              src={fileInfo.url}
              alt={fileInfo.name}
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease',
              }}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        );

      case 'text':
        return (
          <ScrollArea className="h-full">
            <pre className="p-4 text-sm whitespace-pre-wrap font-mono">
              {textContent || '无法加载文本内容'}
            </pre>
          </ScrollArea>
        );

      case 'word':
        return (
          <ScrollArea className="h-full">
            <div className="p-4 prose prose-sm max-w-none">
              {textContent || '无法加载文档内容'}
            </div>
          </ScrollArea>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <FileIcon className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">此文件类型暂不支持预览</p>
            <Button onClick={onDownload || (() => window.open(fileInfo.url, '_blank'))}>
              <Download className="h-4 w-4 mr-2" />
              下载文件
            </Button>
          </div>
        );
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium text-sm truncate max-w-[200px]">{fileInfo.name}</span>
          <Badge variant="secondary" className="text-xs">
            {formatFileSize(fileInfo.size)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* 缩放控制 */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button variant="ghost" size="icon" onClick={handleZoomOut} title="缩小">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs min-w-[50px] text-center">{zoom}%</span>
            <Button variant="ghost" size="icon" onClick={handleZoomIn} title="放大">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleResetZoom} title="重置">
              {zoom}%
            </Button>
          </div>

          {/* 旋转控制（仅图片） */}
          {fileType === 'image' && (
            <Button variant="ghost" size="icon" onClick={handleRotate} title="旋转">
              <RotateCw className="h-4 w-4" />
            </Button>
          )}

          {/* 全屏切换 */}
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="全屏">
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>

          {/* 下载 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDownload || (() => window.open(fileInfo.url, '_blank'))}
            title="下载"
          >
            <Download className="h-4 w-4" />
          </Button>

          {/* 新窗口打开 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(fileInfo.url, '_blank')}
            title="新窗口打开"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF页面导航 */}
      {fileType === 'pdf' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2 border-b bg-muted/30">
          <Button variant="ghost" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            第 {currentPage} / {totalPages} 页
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 预览区域 */}
      <div className="flex-1 overflow-hidden bg-muted/20">{renderPreview()}</div>
    </div>
  );
}

// ============================================
// 文档预览对话框组件
// ============================================

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: number | null;
  fileName: string;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
}: DocumentPreviewDialogProps) {
  if (!fileId) return null;

  return (
    <div
      className={`fixed inset-0 z-50 ${
        open ? 'flex' : 'hidden'
      } items-center justify-center bg-black/50`}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-[90vw] h-[90vh] max-w-6xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <FilePreview
          fileId={fileId}
          fileName={fileName}
          onDownload={() => onOpenChange(false)}
        />
      </div>
    </div>
  );
}

// ============================================
// 文档列表预览组件
// ============================================

interface DocumentListPreviewProps {
  documents: Array<{
    id: number;
    name: string;
    type: string;
    size: number;
    createdAt: string;
  }>;
  onPreview?: (id: number) => void;
  onDownload?: (id: number) => void;
}

export function DocumentListPreview({
  documents,
  onPreview,
  onDownload,
}: DocumentListPreviewProps) {
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">文档列表</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              暂无文档
            </div>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => {
                const Icon = getFileIcon(doc.type);
                return (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer ${
                      selectedId === doc.id ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => {
                      setSelectedId(doc.id);
                      onPreview?.(doc.id);
                    }}
                  >
                    <Icon className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.size)} · {doc.createdAt}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreview?.(doc.id);
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload?.(doc.id);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

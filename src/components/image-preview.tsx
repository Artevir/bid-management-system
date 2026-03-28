'use client';

/**
 * 图片预览组件
 * 支持图片预览、下载、删除等操作
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Trash2, MoreVertical, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// 组件属性
// ============================================

interface ImagePreviewProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  showActions?: boolean;
  onDownload?: (url: string) => void;
  onDelete?: () => void;
}

// ============================================
// 主组件
// ============================================

export function ImagePreview({
  src,
  alt = '图片预览',
  width = 200,
  height,
  className = '',
  showActions = true,
  onDownload,
  onDelete,
}: ImagePreviewProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  // 下载图片
  const handleDownload = async () => {
    try {
      if (onDownload) {
        onDownload(src);
        return;
      }

      // 默认下载逻辑
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = alt || 'image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('下载成功');
    } catch (error) {
      console.error('下载失败:', error);
      toast.error('下载失败');
    }
  };

  // 删除图片
  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      toast.success('删除成功');
    }
  };

  return (
    <div className={`relative group ${className}`}>
      {/* 图片 */}
      <img
        src={src}
        alt={alt}
        style={{
          width: width ? `${width}px` : 'auto',
          height: height ? `${height}px` : 'auto',
        }}
        className="object-cover rounded-lg border"
      />

      {/* 操作按钮 */}
      {showActions && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* 预览 */}
              <DialogTrigger asChild>
                <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                  <ZoomIn className="mr-2 h-4 w-4" />
                  预览
                </DropdownMenuItem>
              </DialogTrigger>

              {/* 下载 */}
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                下载
              </DropdownMenuItem>

              {/* 删除 */}
              {onDelete && (
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* 大图预览对话框 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <img
            src={src}
            alt={alt}
            className="w-full h-auto rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

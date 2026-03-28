'use client';

/**
 * 图片生成对话框组件
 * 提供图片生成功能界面
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// 类型定义
// ============================================

export interface ImageGenerationOptions {
  projectId?: number;
  bidDocumentId?: number;
  businessObjectType?: 'project' | 'bid_document' | 'chapter' | 'marketing' | 'other';
  businessObjectId?: number;
  usage?: string;
}

export interface ImageGeneratedResult {
  id: number;
  imageUrls: string[];
  imageCount: number;
  status: string;
}

// ============================================
// 组件属性
// ============================================

interface ImageGenerationDialogProps {
  trigger?: React.ReactNode;
  options?: ImageGenerationOptions;
  onImageGenerated?: (result: ImageGeneratedResult) => void;
  onClose?: () => void;
}

// ============================================
// 主组件
// ============================================

export function ImageGenerationDialog({
  trigger,
  options,
  onImageGenerated,
  onClose,
}: ImageGenerationDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<ImageGeneratedResult[]>([]);

  // 表单状态
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<'text_to_image' | 'image_to_image'>('text_to_image');
  const [size, setSize] = useState<'2K' | '4K'>('2K');
  const [watermark, setWatermark] = useState(true);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  // 处理生成
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('请输入提示词');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/image-generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          type,
          size,
          watermark,
          referenceImages: type === 'image_to_image' ? referenceImages : undefined,
          ...options,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '生成失败');
      }

      const result = data.data as ImageGeneratedResult;
      setResults([result, ...results]);
      setPrompt('');

      toast.success('图片生成成功');
      onImageGenerated?.(result);
    } catch (error) {
      console.error('生成图片失败:', error);
      toast.error(error instanceof Error ? error.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  // 处理关闭
  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            生成图片
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI 图片生成</DialogTitle>
          <DialogDescription>
            输入提示词，AI将为您生成图片
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 提示词输入 */}
          <div className="space-y-2">
            <Label htmlFor="prompt">提示词 *</Label>
            <Textarea
              id="prompt"
              placeholder="描述您想要生成的图片，例如：一个现代化的办公室，落地窗，明亮的光线，简约风格"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={generating}
            />
          </div>

          {/* 生成类型 */}
          <div className="space-y-2">
            <Label htmlFor="type">生成类型</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="选择生成类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text_to_image">文生图</SelectItem>
                <SelectItem value="image_to_image">图生图</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 图片尺寸 */}
          <div className="space-y-2">
            <Label htmlFor="size">图片尺寸</Label>
            <Select value={size} onValueChange={(value: any) => setSize(value)}>
              <SelectTrigger>
                <SelectValue placeholder="选择图片尺寸" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2K">2K (1920x1080)</SelectItem>
                <SelectItem value="4K">4K (3840x2160)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 水印 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="watermark">添加水印</Label>
            <Switch
              id="watermark"
              checked={watermark}
              onCheckedChange={setWatermark}
              disabled={generating}
            />
          </div>

          {/* 生成结果 */}
          {results.length > 0 && (
            <div className="space-y-2">
              <Label>生成结果</Label>
              <div className="grid grid-cols-2 gap-4">
                {results.map((result, index) => (
                  <div key={result.id} className="space-y-2">
                    {result.imageUrls.map((url, urlIndex) => (
                      <div
                        key={`${result.id}-${urlIndex}`}
                        className="relative group"
                      >
                        <img
                          src={url}
                          alt={`生成图片 ${index + 1}-${urlIndex + 1}`}
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = `image-${result.id}-${urlIndex + 1}.png`;
                              link.click();
                            }}
                          >
                            <ImageIcon className="mr-2 h-4 w-4" />
                            下载
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={generating}>
            关闭
          </Button>
          <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                生成图片
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

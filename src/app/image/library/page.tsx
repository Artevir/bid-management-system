'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader as _CardHeader,
  CardTitle as _CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search,
  Download,
  Trash2,
  Eye,
  Image as ImageIcon,
  Calendar,
  FolderOpen,
} from 'lucide-react';
import { IMAGE_TYPE_CONFIG } from '@/lib/image/constants';

// 图片接口
interface Image {
  id: number;
  name: string;
  description: string | null;
  imageType: string;
  prompt: string | null;
  fileUrl: string | null;
  imageSize: string | null;
  style: string | null;
  status: string;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
}

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  generating: { label: '生成中', color: 'bg-blue-100 text-blue-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-700' },
};

// 图片类型选项
const IMAGE_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'org_chart', label: '组织架构图' },
  { value: 'flowchart', label: '流程图' },
  { value: 'flowchart_it_ops', label: 'IT运维流程图' },
  { value: 'flowchart_bidding', label: '投标流程图' },
  { value: 'gantt_chart', label: '甘特图' },
  { value: 'topology', label: '拓扑图' },
  { value: 'mind_map', label: '思维导图' },
];

export default function ImageLibraryPage() {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 加载图片列表
  const loadImages = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('imageType', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const response = await fetch(`/api/image/list?${params.toString()}`);
      const data = await response.json();
      setImages(data.images || []);
    } catch (error) {
      console.error('加载失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [typeFilter, statusFilter]);

  // 删除图片
  const handleDelete = async (imageId: number) => {
    if (!confirm('确定删除此图片？')) return;
    try {
      await fetch(`/api/image/${imageId}`, { method: 'DELETE' });
      loadImages();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 下载图片
  const handleDownload = async (imageUrl: string, imageName: string) => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${imageName}.png`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // 查看详情
  const handleViewDetail = (image: Image) => {
    setSelectedImage(image);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">图片库</h1>
        <p className="text-muted-foreground mt-1">管理生成的图片，支持搜索、下载、删除等操作</p>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索图片..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && loadImages()}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="generating">生成中</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadImages}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 图片列表 */}
      {error ? (
        <ListStateBlock state="error" error={error} onRetry={loadImages} />
      ) : loading ? (
        <ListStateBlock state="loading" />
      ) : images.length === 0 ? (
        <ListStateBlock state="empty" emptyText="暂无图片" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {images.map((image) => {
            const typeConfig = IMAGE_TYPE_CONFIG[image.imageType];
            const statusConf = STATUS_CONFIG[image.status] || STATUS_CONFIG.completed;

            return (
              <Card key={image.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-video bg-muted relative">
                  {image.fileUrl ? (
                    <img
                      src={image.fileUrl}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <Badge className={`absolute top-2 right-2 ${statusConf.color}`}>
                    {statusConf.label}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{image.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {typeConfig?.label || image.imageType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                    <span className="mx-1">|</span>
                    <Eye className="h-3 w-3" />
                    <span>{image.viewCount}</span>
                    <Download className="h-3 w-3 ml-1" />
                    <span>{image.downloadCount}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewDetail(image)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      查看
                    </Button>
                    {image.fileUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(image.fileUrl!, image.name)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                      onClick={() => handleDelete(image.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.name}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                {selectedImage.fileUrl && (
                  <img
                    src={selectedImage.fileUrl}
                    alt={selectedImage.name}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">类型：</span>
                  <span>{IMAGE_TYPE_CONFIG[selectedImage.imageType]?.label}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">尺寸：</span>
                  <span>{selectedImage.imageSize}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">风格：</span>
                  <span>{selectedImage.style || '默认'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">创建时间：</span>
                  <span>{new Date(selectedImage.createdAt).toLocaleString()}</span>
                </div>
              </div>
              {selectedImage.prompt && (
                <div className="text-sm">
                  <span className="text-muted-foreground">提示词：</span>
                  <p className="mt-1 p-3 bg-muted rounded-lg">{selectedImage.prompt}</p>
                </div>
              )}
              <div className="flex gap-2">
                {selectedImage.fileUrl && (
                  <Button
                    onClick={() => handleDownload(selectedImage.fileUrl!, selectedImage.name)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    下载图片
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

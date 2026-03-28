'use client';

/**
 * 图片生成历史页面
 * 展示所有生成的图片记录
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageGenerationDialog } from '@/components/image-generation-dialog';
import { ImagePreview } from '@/components/image-preview';
import {
  Sparkles,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// 类型定义
// ============================================

interface ImageGeneration {
  id: number;
  type: string;
  prompt: string;
  size: string;
  watermark: boolean;
  imageUrls: string[];
  imageCount: number;
  projectId?: number;
  projectName?: string;
  bidDocumentId?: number;
  businessObjectType?: string;
  businessObjectId?: number;
  usage?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 配置
// ============================================

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: '待生成', color: 'bg-gray-100 text-gray-800' },
  generating: { label: '生成中', color: 'bg-blue-100 text-blue-800' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800' },
  failed: { label: '失败', color: 'bg-red-100 text-red-800' },
};

const typeConfig: Record<string, { label: string }> = {
  text_to_image: { label: '文生图' },
  image_to_image: { label: '图生图' },
  batch_generation: { label: '批量生成' },
};

// ============================================
// 主组件
// ============================================

export default function ImageGenerationsPage() {
  const [records, setRecords] = useState<ImageGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<ImageGeneration | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // 加载图片生成记录
  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/image-generations');
      const data = await response.json();

      if (data.success) {
        setRecords(data.data);
      }
    } catch (error) {
      console.error('获取图片生成记录失败:', error);
      toast.error('获取图片生成记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除记录
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/image-generations/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('删除成功');
        fetchRecords();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除记录失败:', error);
      toast.error('删除失败');
    }
  };

  // 查看详情
  const handleViewDetail = (record: ImageGeneration) => {
    setSelectedRecord(record);
    setDetailDialogOpen(true);
  };

  // 下载所有图片
  const handleDownloadAll = (record: ImageGeneration) => {
    record.imageUrls.forEach((url, index) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `image-${record.id}-${index + 1}.png`;
      link.click();
    });
    toast.success(`已下载 ${record.imageCount} 张图片`);
  };

  // 过滤记录
  const filteredRecords = records.filter((record) => {
    // 状态过滤
    if (statusFilter !== 'all' && record.status !== statusFilter) {
      return false;
    }

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        record.prompt.toLowerCase().includes(query) ||
        record.usage?.toLowerCase().includes(query) ||
        record.projectName?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI 图片生成</h1>
          <p className="text-muted-foreground mt-2">
            使用 AI 生成投标文档所需的图片
          </p>
        </div>

        <ImageGenerationDialog
          trigger={
            <Button>
              <Sparkles className="mr-2 h-4 w-4" />
              生成图片
            </Button>
          }
          onImageGenerated={() => fetchRecords()}
        />
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">总生成数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{records.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">已完成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {records.filter((r) => r.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">生成中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {records.filter((r) => r.status === 'generating').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">失败</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {records.filter((r) => r.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 过滤和搜索 */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索提示词、用途、项目名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
            <SelectItem value="generating">生成中</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 图片生成记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>生成记录</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-20 w-20 rounded" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>暂无图片生成记录</p>
              <p className="text-sm mt-2">点击上方按钮开始生成图片</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">缩略图</TableHead>
                  <TableHead>提示词</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>尺寸</TableHead>
                  <TableHead>用途</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>生成时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {record.imageUrls.length > 0 ? (
                        <div className="relative">
                          <ImagePreview
                            src={record.imageUrls[0]}
                            alt={record.prompt}
                            width={80}
                            height={60}
                            showActions={false}
                          />
                          {record.imageCount > 1 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                              {record.imageCount}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="w-20 h-15 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                          无图片
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={record.prompt}>
                        {record.prompt}
                      </div>
                    </TableCell>
                    <TableCell>
                      {typeConfig[record.type]?.label || record.type}
                    </TableCell>
                    <TableCell>{record.size}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {record.usage || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[record.status]?.color}>
                        {statusConfig[record.status]?.label || record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(record.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetail(record)}
                          title="查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {record.status === 'completed' && record.imageUrls.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadAll(record)}
                            title="下载全部"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      {selectedRecord && (
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">提示词</h3>
                <p className="text-sm text-gray-600">{selectedRecord.prompt}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">生成类型</h3>
                  <p className="text-sm text-gray-600">
                    {typeConfig[selectedRecord.type]?.label}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-1">图片尺寸</h3>
                  <p className="text-sm text-gray-600">{selectedRecord.size}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-1">水印</h3>
                  <p className="text-sm text-gray-600">
                    {selectedRecord.watermark ? '是' : '否'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-1">图片数量</h3>
                  <p className="text-sm text-gray-600">{selectedRecord.imageCount}</p>
                </div>
              </div>

              {selectedRecord.projectName && (
                <div>
                  <h3 className="text-sm font-medium mb-1">关联项目</h3>
                  <p className="text-sm text-gray-600">{selectedRecord.projectName}</p>
                </div>
              )}

              {selectedRecord.usage && (
                <div>
                  <h3 className="text-sm font-medium mb-1">用途</h3>
                  <p className="text-sm text-gray-600">{selectedRecord.usage}</p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-2">生成的图片</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedRecord.imageUrls.map((url, index) => (
                    <div key={index}>
                      <ImagePreview
                        src={url}
                        alt={`图片 ${index + 1}`}
                        width={400}
                        height={300}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {selectedRecord.errorMessage && (
                <div>
                  <h3 className="text-sm font-medium mb-1 text-red-600">错误信息</h3>
                  <p className="text-sm text-red-600">{selectedRecord.errorMessage}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

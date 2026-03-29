'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  FileText as _FileText,
  Plus,
  Sparkles,
  CheckCircle as _CheckCircle,
  Clock as _Clock,
  Edit,
  Eye as _Eye,
  Download as _Download,
} from 'lucide-react';

// 矩阵状态类型
type MatrixStatus = 'draft' | 'active' | 'completed';

// 响应状态类型
type ResponseStatus = 'pending' | 'responded' | 'reviewed';

// 矩阵项类型
type MatrixItemType = 'qualification' | 'scoring_item' | 'requirement';

// 响应矩阵接口
interface ResponseMatrix {
  id: number;
  name: string;
  description: string | null;
  status: MatrixStatus;
  totalItems: number;
  completedItems: number;
  createdAt: string;
}

// 矩阵项接口
interface MatrixItem {
  id: number;
  type: MatrixItemType;
  serialNumber: string;
  title: string;
  requirement: string | null;
  requirementType: 'mandatory' | 'optional' | null;
  score: number | null;
  response: string | null;
  responseStatus: ResponseStatus | null;
  assigneeId: number | null;
}

// 状态颜色映射
const STATUS_COLORS: Record<MatrixStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

// 状态标签
const STATUS_LABELS: Record<MatrixStatus, string> = {
  draft: '草稿',
  active: '进行中',
  completed: '已完成',
};

// 类型标签
const TYPE_LABELS: Record<MatrixItemType, string> = {
  qualification: '资格条件',
  scoring_item: '评分项',
  requirement: '其他要求',
};

// 响应状态标签
const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  pending: '待响应',
  responded: '已响应',
  reviewed: '已审核',
};

interface MatrixDashboardProps {
  projectId: number;
  taskId?: number;
}

export function MatrixDashboard({ projectId, taskId }: MatrixDashboardProps) {
  const [matrices, setMatrices] = useState<ResponseMatrix[]>([]);
  const [selectedMatrix, setSelectedMatrix] = useState<ResponseMatrix | null>(null);
  const [items, setItems] = useState<MatrixItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingItem, setEditingItem] = useState<MatrixItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [responseData, setResponseData] = useState('');

  useEffect(() => {
    fetchMatrices();
  }, [projectId]);

  const fetchMatrices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matrix?projectId=${projectId}`);
      if (!res.ok) throw new Error('获取响应矩阵失败');
      const data = await res.json();
      setMatrices(data.matrix || []);
    } catch (error) {
      console.error('Fetch matrices error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (matrixId: number) => {
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/matrix/${matrixId}/items`);
      if (!res.ok) throw new Error('获取矩阵项失败');
      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Fetch items error:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleMatrixSelect = (matrix: ResponseMatrix) => {
    setSelectedMatrix(matrix);
    fetchItems(matrix.id);
  };

  const handleCreateMatrix = async () => {
    if (!formData.name) return;

    setGenerating(true);
    try {
      // 如果有taskId，从解析任务生成
      if (taskId) {
        const res = await fetch('/api/matrix/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            taskId,
            name: formData.name,
            description: formData.description,
          }),
        });

        if (!res.ok) throw new Error('生成响应矩阵失败');
        
        setCreateDialogOpen(false);
        setFormData({ name: '', description: '' });
        fetchMatrices();
      } else {
        // 创建空矩阵
        const res = await fetch('/api/matrix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            name: formData.name,
            description: formData.description,
          }),
        });

        if (!res.ok) throw new Error('创建响应矩阵失败');
        
        setCreateDialogOpen(false);
        setFormData({ name: '', description: '' });
        fetchMatrices();
      }
    } catch (error) {
      console.error('Create matrix error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateResponses = async () => {
    if (!selectedMatrix) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/matrix/generate?action=responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrixId: selectedMatrix.id }),
      });

      if (!res.ok) throw new Error('生成响应建议失败');
      
      fetchItems(selectedMatrix.id);
    } catch (error) {
      console.error('Generate responses error:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleEditItem = (item: MatrixItem) => {
    setEditingItem(item);
    setResponseData(item.response || '');
    setEditDialogOpen(true);
  };

  const handleSaveResponse = async () => {
    if (!editingItem) return;

    try {
      const res = await fetch(`/api/matrix/items/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: responseData }),
      });

      if (!res.ok) throw new Error('保存响应失败');
      
      setEditDialogOpen(false);
      setEditingItem(null);
      if (selectedMatrix) {
        fetchItems(selectedMatrix.id);
      }
    } catch (error) {
      console.error('Save response error:', error);
    }
  };

  const getProgress = (matrix: ResponseMatrix) => {
    if (matrix.totalItems === 0) return 0;
    return Math.round((matrix.completedItems / matrix.totalItems) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">响应矩阵</h2>
          <p className="text-sm text-muted-foreground">
            管理投标响应条目和响应内容
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              创建响应矩阵
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建响应矩阵</DialogTitle>
              <DialogDescription>
                {taskId
                  ? '基于文档解析结果自动生成响应矩阵'
                  : '创建新的响应矩阵'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">矩阵名称</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="输入矩阵名称"
                />
              </div>
              <div>
                <Label htmlFor="description">描述（可选）</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="输入矩阵描述"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                onClick={handleCreateMatrix}
                disabled={!formData.name || generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  '创建'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 矩阵列表 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">矩阵列表</CardTitle>
          </CardHeader>
          <CardContent>
            {matrices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无响应矩阵
              </div>
            ) : (
              <div className="space-y-3">
                {matrices.map((matrix) => (
                  <div
                    key={matrix.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedMatrix?.id === matrix.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => handleMatrixSelect(matrix)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm truncate">
                        {matrix.name}
                      </span>
                      <Badge className={STATUS_COLORS[matrix.status]}>
                        {STATUS_LABELS[matrix.status]}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>进度</span>
                        <span>{getProgress(matrix)}%</span>
                      </div>
                      <Progress value={getProgress(matrix)} className="h-1" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{matrix.completedItems} / {matrix.totalItems} 项</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 矩阵项列表 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {selectedMatrix?.name || '矩阵项'}
                </CardTitle>
                <CardDescription>
                  {selectedMatrix
                    ? `${selectedMatrix.totalItems} 个响应条目`
                    : '请选择响应矩阵'}
                </CardDescription>
              </div>
              {selectedMatrix && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateResponses}
                  disabled={generating}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI生成响应
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedMatrix ? (
              <div className="text-center py-12 text-muted-foreground">
                请从左侧选择一个响应矩阵
              </div>
            ) : itemsLoading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无矩阵项
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">序号</TableHead>
                    <TableHead className="w-[100px]">类型</TableHead>
                    <TableHead>要求</TableHead>
                    <TableHead className="w-[80px]">分值</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <code className="text-xs">{item.serialNumber}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[item.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[300px]">
                          <p className="font-medium text-sm truncate">
                            {item.title}
                          </p>
                          {item.requirement && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {item.requirement}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.score ? `${item.score}分` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.responseStatus === 'reviewed'
                              ? 'default'
                              : item.responseStatus === 'responded'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-xs"
                        >
                          {item.responseStatus
                            ? RESPONSE_STATUS_LABELS[item.responseStatus]
                            : '待响应'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="编辑响应"
                            onClick={() => handleEditItem(item)}
                          >
                            <Edit className="h-4 w-4" />
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
      </div>

      {/* 编辑响应对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>编辑响应内容</DialogTitle>
            <DialogDescription>
              {editingItem?.serialNumber} - {editingItem?.title}
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">要求描述</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingItem.requirement}
                </p>
              </div>
              {editingItem.score && (
                <div>
                  <Label className="text-sm font-medium">分值</Label>
                  <p className="text-sm">{editingItem.score} 分</p>
                </div>
              )}
              <Separator />
              <div>
                <Label htmlFor="response" className="text-sm font-medium">
                  响应内容
                </Label>
                <Textarea
                  id="response"
                  value={responseData}
                  onChange={(e) => setResponseData(e.target.value)}
                  rows={6}
                  placeholder="输入响应内容..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveResponse}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

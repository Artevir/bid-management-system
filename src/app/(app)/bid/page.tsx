'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
} from 'lucide-react';
import { 
  useDocuments, 
  useSubmitApproval, 
  useDeleteChapter 
} from '@/hooks/use-bid';
import { useProjects } from '@/hooks/use-project';
import { bidService } from '@/lib/api/bid-service';
import { toast } from 'sonner';
import { BID_STATUS_MAP } from '@/lib/constants/bid-ui';

export default function BidDocumentsPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    projectId: '',
    name: '',
    type: 'technical',
  });

  // --- 服务端状态 (React Query) ---
  const { data: documents = [], isLoading: loadingDocs } = useDocuments(0); // 0 表示获取全部，或按需调整
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  
  const submitApprovalMutation = useSubmitApproval();

  // --- 事件处理 ---
  async function handleCreateDocument() {
    if (!createForm.projectId || !createForm.name) {
      toast.error('请填写完整信息');
      return;
    }

    try {
      const res = await bidService.createDocument({
        projectId: parseInt(createForm.projectId),
        name: createForm.name,
        userId: 0, // 后端会从 session 获取
      });
      
      setCreateDialogOpen(false);
      toast.success('文档创建成功');
      router.push(`/bid/${res.data.documentId}/edit`);
    } catch (error) {
      // 错误已由 ApiClient 处理
    }
  }

  async function handleDeleteDocument(id: number) {
    if (!confirm('确定要删除此文档吗？')) return;
    try {
      await bidService.deleteDocument(id);
      toast.success('文档已删除');
      // React Query 会自动失效缓存并重新获取 (如果配置了 onSuccess)
      // 此处简单起见可以手动调用 reload 或在 Mutation 中配置
    } catch (error) {}
  }

  async function handleSubmitForApproval(id: number) {
    if (!confirm('确定要提交审核吗？')) return;
    await submitApprovalMutation.mutateAsync(id);
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">标书文档</h1>
          <p className="text-muted-foreground">管理和编辑标书文档</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建文档
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文档列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDocs ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              暂无文档，点击上方按钮创建第一个标书文档
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文档名称</TableHead>
                  <TableHead>所属项目</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>创建人</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>{doc.projectName || '-'}</TableCell>
                    <TableCell>
                      <Badge className={BID_STATUS_MAP[doc.status]?.color}>
                        {BID_STATUS_MAP[doc.status]?.label || doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>v{doc.version}</TableCell>
                    <TableCell>{doc.creatorName || '-'}</TableCell>
                    <TableCell>
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/bid/${doc.id}/edit`)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/bid/${doc.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            查看
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {doc.status === 'draft' && (
                            <DropdownMenuItem
                              onClick={() => handleSubmitForApproval(doc.id)}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              提交审核
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建文档对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建标书文档</DialogTitle>
            <DialogDescription>
              选择所属项目并输入文档名称来开始编写。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project">所属项目</Label>
              <Select 
                onValueChange={(v) => setCreateForm({ ...createForm, projectId: v })}
                value={createForm.projectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">文档名称</Label>
              <Input
                id="name"
                placeholder="例如：技术投标文件-V1.0"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateDocument}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
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

interface BidDocument {
  id: number;
  projectId: number;
  project?: { id: number; name: string };
  name: string;
  type: string;
  status: string;
  version: number;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: number;
  name: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
  in_progress: { label: '编辑中', color: 'bg-blue-100 text-blue-800' },
  in_review: { label: '审核中', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-800' },
};

const typeConfig: Record<string, { label: string }> = {
  technical: { label: '技术标' },
  business: { label: '商务标' },
  comprehensive: { label: '综合标' },
};

export default function BidDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<BidDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    projectId: '',
    name: '',
    type: 'technical',
    description: '',
    deadline: '',
  });

  useEffect(() => {
    fetchDocuments();
    fetchProjects();
  }, []);

  async function fetchDocuments() {
    try {
      const response = await fetch('/api/bid/documents');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProjects() {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }

  async function handleCreateDocument() {
    try {
      const response = await fetch('/api/bid/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (response.ok) {
        const data = await response.json();
        setCreateDialogOpen(false);
        setCreateForm({
          projectId: '',
          name: '',
          type: 'technical',
          description: '',
          deadline: '',
        });
        fetchDocuments();
        router.push(`/bid/${data.document.id}/edit`);
      }
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  }

  async function handleDeleteDocument(id: number) {
    if (!confirm('确定要删除此文档吗？')) return;

    try {
      await fetch(`/api/bid/documents/${id}`, { method: 'DELETE' });
      fetchDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  }

  async function handleSubmitForApproval(doc: BidDocument) {
    if (!confirm('确定要提交审核吗？')) return;

    try {
      const response = await fetch('/api/bid/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      });

      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error('Failed to submit for approval:', error);
    }
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
          {loading ? (
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
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>{doc.project?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {typeConfig[doc.type]?.label || doc.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[doc.status]?.color}>
                        {statusConfig[doc.status]?.label || doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>v{doc.version}</TableCell>
                    <TableCell>
                      {doc.deadline
                        ? new Date(doc.deadline).toLocaleDateString()
                        : '-'}
                    </TableCell>
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
                              onClick={() => handleSubmitForApproval(doc)}
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
            <DialogDescription>创建一个新的标书文档</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>所属项目</Label>
              <Select
                value={createForm.projectId}
                onValueChange={(value) =>
                  setCreateForm({ ...createForm, projectId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>文档名称</Label>
              <Input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="请输入文档名称"
              />
            </div>
            <div className="space-y-2">
              <Label>文档类型</Label>
              <Select
                value={createForm.type}
                onValueChange={(value) =>
                  setCreateForm({ ...createForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">技术标</SelectItem>
                  <SelectItem value="business">商务标</SelectItem>
                  <SelectItem value="comprehensive">综合标</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>截止日期</Label>
              <Input
                type="date"
                value={createForm.deadline}
                onChange={(e) =>
                  setCreateForm({ ...createForm, deadline: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                placeholder="文档描述（可选）"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreateDocument}
              disabled={!createForm.projectId || !createForm.name}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

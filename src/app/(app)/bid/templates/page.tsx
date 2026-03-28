/**
 * 投标文档模板页面
 * 展示和管理文档模板
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  LayoutTemplate,
  Plus,
  Search,
  RefreshCw,
  Star,
  Building,
  FileText,
  MoreHorizontal,
  Eye,
  Edit,
  Copy,
  Trash2,
} from 'lucide-react';

interface Template {
  id: number;
  name: string;
  description: string | null;
  category: string;
  isDefault: boolean;
  companyId: number | null;
  company?: {
    id: number;
    name: string;
  };
  createdAt: string;
}

export default function BidTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [companyId, setCompanyId] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [createDialog, setCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    companyId: '',
    isDefault: false,
  });

  useEffect(() => {
    loadTemplates();
  }, [companyId, category]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (companyId !== 'all') {
        params.append('companyId', companyId);
      }
      if (category !== 'all') {
        params.append('category', category);
      }

      const response = await fetch(`/api/bid/documents/templates?${params}`);
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const response = await fetch('/api/bid/documents/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyId: formData.companyId ? parseInt(formData.companyId) : null,
        }),
      });

      if (response.ok) {
        setCreateDialog(false);
        setFormData({ name: '', description: '', category: 'general', companyId: '', isDefault: false });
        loadTemplates();
      }
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const handleSetDefault = async (templateId: number) => {
    try {
      const response = await fetch('/api/bid/documents/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...templates.find((t) => t.id === templateId),
          isDefault: true,
        }),
      });

      if (response.ok) {
        loadTemplates();
      }
    } catch (error) {
      console.error('Failed to set default template:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文档模板</h1>
          <p className="text-gray-500 mt-1">管理和配置投标文档模板</p>
        </div>
        <Dialog open={createDialog} onOpenChange={setCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              创建模板
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建文档模板</DialogTitle>
              <DialogDescription>
                创建一个新的投标文档模板
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">模板名称</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入模板名称"
                />
              </div>
              <div>
                <label className="text-sm font-medium">模板描述</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="请输入模板描述"
                />
              </div>
              <div>
                <label className="text-sm font-medium">分类</label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用</SelectItem>
                    <SelectItem value="technical">技术标</SelectItem>
                    <SelectItem value="commercial">商务标</SelectItem>
                    <SelectItem value="qualification">资格标</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">所属公司</label>
                <Select value={formData.companyId} onValueChange={(v) => setFormData({ ...formData, companyId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择公司" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">无（系统模板）</SelectItem>
                    <SelectItem value="1">公司A</SelectItem>
                    <SelectItem value="2">公司B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialog(false)}>
                取消
              </Button>
              <Button onClick={handleCreateTemplate}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              总模板数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              默认模板
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.filter((t) => t.isDefault).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              公司模板
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.filter((t) => t.companyId).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              系统模板
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.filter((t) => !t.companyId).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索模板..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择公司" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部公司</SelectItem>
                <SelectItem value="">系统模板</SelectItem>
                <SelectItem value="1">公司A</SelectItem>
                <SelectItem value="2">公司B</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                <SelectItem value="general">通用</SelectItem>
                <SelectItem value="technical">技术标</SelectItem>
                <SelectItem value="commercial">商务标</SelectItem>
                <SelectItem value="qualification">资格标</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadTemplates}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <LayoutTemplate className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>暂无模板</p>
              <Button className="mt-4" onClick={() => setCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                创建模板
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模板名称</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>所属公司</TableHead>
                  <TableHead>默认</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-sm text-gray-500">{template.description}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {template.company ? (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-gray-400" />
                          {template.company.name}
                        </div>
                      ) : (
                        <span className="text-gray-500">系统模板</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {template.isDefault ? (
                        <Badge>
                          <Star className="h-3 w-3 mr-1" />
                          默认
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(template.id)}
                        >
                          设为默认
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(template.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
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
    </div>
  );
}

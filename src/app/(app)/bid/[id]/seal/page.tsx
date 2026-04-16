/**
 * 投标文档签章管理页面
 * 整合签章申请和管理
 */

'use client';

import { useState, useEffect, useCallback as _useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription as _CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge as _Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  PenTool,
  Plus,
  Search as _Search,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Building,
  Calendar,
  Copy,
  Printer,
} from 'lucide-react';

interface SealApplication {
  id: number;
  projectName: string;
  documentName: string | null;
  sealMethod: string;
  sealCount: number;
  plannedDate: string | null;
  actualDate: string | null;
  status: string;
  remarks: string | null;
}

interface DocumentDetail {
  id: number;
  name: string;
  status: string;
  projectId: number;
}

export default function BidSealPage() {
  const _router = useRouter();
  const params = useParams();
  const documentId = params.id as string;
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [sealApplications, setSealApplications] = useState<SealApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialog, setCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    sealMethod: 'our_company',
    sealCount: 5,
    plannedDate: '',
    partnerCompanyId: '',
    remarks: '',
  });

  useEffect(() => {
    if (documentId) {
      loadDocumentDetail();
      loadSealApplications();
    }
  }, [documentId, statusFilter]);

  const loadDocumentDetail = async () => {
    try {
      const response = await fetch(`/api/bid/documents/${documentId}`);
      const data = await response.json();
      if (data.success) {
        setDocument(data.data);
      }
    } catch (error) {
      console.error('Failed to load document:', error);
    }
  };

  const loadSealApplications = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.append('documentId', documentId);
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/bid/documents/seal?${params}`);
      const data = await response.json();
      if (data.success) {
        setSealApplications(data.data);
      }
    } catch (error) {
      console.error('Failed to load seal applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSealApplication = async () => {
    if (!document) return;

    try {
      const response = await fetch('/api/bid/documents/seal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: parseInt(documentId),
          projectId: document.projectId,
          ...formData,
          plannedDate: formData.plannedDate || undefined,
          partnerCompanyId: formData.partnerCompanyId
            ? parseInt(formData.partnerCompanyId)
            : undefined,
        }),
      });

      if (response.ok) {
        setCreateDialog(false);
        setFormData({
          sealMethod: 'our_company',
          sealCount: 5,
          plannedDate: '',
          partnerCompanyId: '',
          remarks: '',
        });
        loadSealApplications();
      }
    } catch (error) {
      console.error('Failed to create seal application:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待处理',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return labels[status] || status;
  };

  const getSealMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      our_company: '本公司盖章',
      partner_company: '友司盖章',
      external: '第三方盖章',
    };
    return labels[method] || method;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">签章管理</h1>
          <p className="text-gray-500 mt-1">{document ? `文档：${document.name}` : '加载中...'}</p>
        </div>
        <Dialog open={createDialog} onOpenChange={setCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              创建签章申请
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建签章申请</DialogTitle>
              <DialogDescription>为当前文档创建签章申请</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">盖章方式</label>
                <Select
                  value={formData.sealMethod}
                  onValueChange={(v) => setFormData({ ...formData, sealMethod: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="our_company">本公司盖章</SelectItem>
                    <SelectItem value="partner_company">友司盖章</SelectItem>
                    <SelectItem value="external">第三方盖章</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">盖章份数</label>
                <Input
                  type="number"
                  value={formData.sealCount}
                  onChange={(e) =>
                    setFormData({ ...formData, sealCount: parseInt(e.target.value) })
                  }
                  min={1}
                />
              </div>
              <div>
                <label className="text-sm font-medium">计划日期</label>
                <Input
                  type="date"
                  value={formData.plannedDate}
                  onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                />
              </div>
              {formData.sealMethod === 'partner_company' && (
                <div>
                  <label className="text-sm font-medium">选择友司</label>
                  <Select
                    value={formData.partnerCompanyId}
                    onValueChange={(v) => setFormData({ ...formData, partnerCompanyId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择友司" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">公司A</SelectItem>
                      <SelectItem value="2">公司B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">备注</label>
                <Input
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="请输入备注"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialog(false)}>
                取消
              </Button>
              <Button onClick={handleCreateSealApplication}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">总申请数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sealApplications.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">待处理</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sealApplications.filter((a) => a.status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">进行中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sealApplications.filter((a) => a.status === 'in_progress').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">已完成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sealApplications.filter((a) => a.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容 */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">签章列表</TabsTrigger>
          <TabsTrigger value="history">盖章历史</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>签章申请</CardTitle>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="pending">待处理</SelectItem>
                      <SelectItem value="in_progress">进行中</SelectItem>
                      <SelectItem value="completed">已完成</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={loadSealApplications}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {error ? (
                <ListStateBlock state="error" error={error} onRetry={loadDocumentDetail} />
              ) : loading ? (
                <ListStateBlock state="loading" />
              ) : sealApplications.length === 0 ? (
                <ListStateBlock state="empty" emptyText="暂无签章申请" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>项目名称</TableHead>
                      <TableHead>文档名称</TableHead>
                      <TableHead>盖章方式</TableHead>
                      <TableHead>盖章份数</TableHead>
                      <TableHead>计划日期</TableHead>
                      <TableHead>实际日期</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sealApplications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-400" />
                            {application.projectName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            {application.documentName || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{getSealMethodLabel(application.sealMethod)}</TableCell>
                        <TableCell>{application.sealCount}</TableCell>
                        <TableCell>
                          {application.plannedDate ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {new Date(application.plannedDate).toLocaleDateString()}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {application.actualDate ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {new Date(application.actualDate).toLocaleDateString()}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(application.status)}
                            <span>{getStatusLabel(application.status)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Printer className="h-4 w-4" />
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
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>盖章历史</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">暂无盖章历史记录</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * 投标文档解读页面
 * 展示文档关联的招标文件解读
 */

'use client';

import { useState, useEffect, useCallback as _useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge as _Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select as _Select,
  SelectContent as _SelectContent,
  SelectItem as _SelectItem,
  SelectTrigger as _SelectTrigger,
  SelectValue as _SelectValue,
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
  FileSearch,
  Search,
  Plus,
  Link,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';

interface Interpretation {
  id: number;
  projectName: string | null;
  documentName: string;
  status: string;
  createdAt: string;
}

interface DocumentDetail {
  id: number;
  name: string;
  status: string;
  projectId: number;
}

export default function BidInterpretationsPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id as string;
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('list');

  useEffect(() => {
    if (documentId) {
      loadDocumentDetail();
      loadInterpretations();
    }
  }, [documentId]);

  const loadDocumentDetail = async () => {
    try {
      const response = await fetch(`/api/bid/documents/${documentId}`);
      const data = await response.json();
      if (data.success) {
        setDocument(data.data);
      } else {
        setError(data.message || '加载文档信息失败');
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      setError(error instanceof Error ? error.message : '加载文档信息失败');
    }
  };

  const loadInterpretations = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/bid/documents/interpretations?documentId=${documentId}`);
      const data = await response.json();
      if (data.success) {
        setInterpretations(data.data);
      } else {
        setError(data.message || '加载解读列表失败');
      }
    } catch (error) {
      console.error('Failed to load interpretations:', error);
      setError(error instanceof Error ? error.message : '加载解读列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'parsing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待解析',
      parsing: '解析中',
      completed: '已完成',
      failed: '解析失败',
    };
    return labels[status] || status;
  };

  const _handleLinkInterpretation = async (interpretationId: number) => {
    try {
      const response = await fetch('/api/bid/documents/interpretations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: parseInt(documentId),
          interpretationId,
        }),
      });
      if (response.ok) {
        loadInterpretations();
      }
    } catch (error) {
      console.error('Failed to link interpretation:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文档解读</h1>
          <p className="text-gray-500 mt-1">{document ? `文档：${document.name}` : '加载中...'}</p>
        </div>
        <Button>
          <Link className="mr-2 h-4 w-4" />
          关联解读
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">总解读数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{interpretations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">已完成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {interpretations.filter((i) => i.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">解析中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {interpretations.filter((i) => i.status === 'parsing').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">解析失败</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {interpretations.filter((i) => i.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">解读列表</TabsTrigger>
          <TabsTrigger value="detail">解读详情</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>招标文件解读</CardTitle>
                <div className="flex gap-2">
                  <Input
                    placeholder="搜索解读..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-64"
                  />
                  <Button variant="outline" size="icon" onClick={loadInterpretations}>
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={loadInterpretations}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ListStateBlock state="loading" />
              ) : error ? (
                <ListStateBlock state="error" error={error} onRetry={loadInterpretations} />
              ) : interpretations.length === 0 ? (
                <ListStateBlock state="empty" emptyText="暂无关联的解读" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文档名称</TableHead>
                      <TableHead>项目名称</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interpretations.map((interpretation) => (
                      <TableRow key={interpretation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            {interpretation.documentName}
                          </div>
                        </TableCell>
                        <TableCell>{interpretation.projectName || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(interpretation.status)}
                            <span>{getStatusLabel(interpretation.status)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(interpretation.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/interpretations/${interpretation.id}`)}
                          >
                            查看详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detail" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>解读详情</CardTitle>
              <CardDescription>选择一个解读查看详细信息</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">请从解读列表中选择一个解读</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

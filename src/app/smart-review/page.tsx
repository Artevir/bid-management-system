'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TableListStateRow } from '@/components/ui/list-states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Upload,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  ShieldAlert,
} from 'lucide-react';

interface SmartReviewDocument {
  id: number;
  fileName: string;
  projectName: string | null;
  projectCode: string | null;
  status: string;
  reviewStatus: string;
  extractionAccuracy: number | null;
  specCount: number;
  scoringCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SmartReviewStats {
  total: number;
  pendingReviewCount: number;
  parsedCount: number;
  approvedCount: number;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  uploading: { label: '上传中', color: 'bg-blue-100 text-blue-800' },
  parsing: { label: '解析中', color: 'bg-yellow-100 text-yellow-800' },
  parsed: { label: '已解析', color: 'bg-green-100 text-green-800' },
  reviewing: { label: '审核中', color: 'bg-purple-100 text-purple-800' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-800' },
};

const reviewStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '审核中', color: 'bg-blue-100 text-blue-800' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
  needs_revision: { label: '需修改', color: 'bg-orange-100 text-orange-800' },
};

export default function SmartReviewPage() {
  const [documents, setDocuments] = useState<SmartReviewDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const keywordRef = useRef(keyword);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<SmartReviewStats>({
    total: 0,
    pendingReviewCount: 0,
    parsedCount: 0,
    approvedCount: 0,
  });

  useEffect(() => {
    keywordRef.current = keyword;
  }, [keyword]);

  const fetchDocuments = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: '20',
          keyword: keywordRef.current,
          status: statusFilter,
          reviewStatus: reviewStatusFilter,
        });

        const res = await fetch(`/api/smart-review?${params}`);
        const data = await res.json();

        if (data.documents) {
          setDocuments(data.documents);
          setTotalPages(data.totalPages);
          setTotal(data.total);
        }
        if (data.stats) {
          setStats({
            total: data.stats.total ?? 0,
            pendingReviewCount: data.stats.pendingReviewCount ?? 0,
            parsedCount: data.stats.parsedCount ?? 0,
            approvedCount: data.stats.approvedCount ?? 0,
          });
        }
      } catch (error) {
        console.error('Fetch documents error:', error);
        setError(error instanceof Error ? error.message : '加载文档列表失败');
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [page, reviewStatusFilter, statusFilter]
  );

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const hasRunningBatch = documents.some(
      (doc) =>
        doc.status === 'uploading' ||
        doc.status === 'parsing' ||
        doc.status === 'reviewing' ||
        doc.reviewStatus === 'in_progress'
    );
    if (!hasRunningBatch) {
      return;
    }
    const interval = setInterval(() => {
      void fetchDocuments({ silent: true });
    }, 15000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleSearch = () => {
    setPage(1);
    void fetchDocuments();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'parsing':
      case 'reviewing':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">文件智能审阅中枢</h1>
          <p className="text-gray-500">智能解析招标文件，自动提取关键信息</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/smart-review/governance">
            <Button variant="outline">
              <ShieldAlert className="h-4 w-4 mr-2" />
              风险与冲突处置台
            </Button>
          </Link>
          <Link href="/smart-review/upload">
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              上传招标文件
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">文档总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">待审核</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingReviewCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">已解析</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.parsedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">已通过</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.approvedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>文档列表</CardTitle>
              <CardDescription>管理和审核上传的招标文件</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="搜索文件名、项目名..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-64"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">全部状态</option>
                <option value="uploading">上传中</option>
                <option value="parsing">解析中</option>
                <option value="parsed">已解析</option>
                <option value="reviewing">审核中</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
              </select>
              <select
                value={reviewStatusFilter}
                onChange={(e) => setReviewStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">全部审核状态</option>
                <option value="pending">待审核</option>
                <option value="in_progress">审核中</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
              </select>
              <Button variant="outline" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件名称</TableHead>
                <TableHead>项目名称</TableHead>
                <TableHead>项目编号</TableHead>
                <TableHead>解析状态</TableHead>
                <TableHead>审核状态</TableHead>
                <TableHead>提取精度</TableHead>
                <TableHead>技术规格</TableHead>
                <TableHead>评分细则</TableHead>
                <TableHead>上传时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || error || documents.length === 0 ? (
                <TableListStateRow
                  state={loading ? 'loading' : error ? 'error' : 'empty'}
                  colSpan={10}
                  error={error}
                  onRetry={fetchDocuments}
                  emptyText="暂无文档，请先上传招标文件"
                />
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {doc.fileName}
                      </div>
                    </TableCell>
                    <TableCell>{doc.projectName || '-'}</TableCell>
                    <TableCell>{doc.projectCode || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusLabels[doc.status]?.color}>
                        {statusLabels[doc.status]?.label || doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(doc.reviewStatus)}
                        <Badge className={reviewStatusLabels[doc.reviewStatus]?.color}>
                          {reviewStatusLabels[doc.reviewStatus]?.label || doc.reviewStatus}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc.extractionAccuracy ? `${doc.extractionAccuracy}%` : '-'}
                    </TableCell>
                    <TableCell>{doc.specCount}</TableCell>
                    <TableCell>{doc.scoringCount}</TableCell>
                    <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Link href={`/smart-review/${doc.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          查看
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              共 {total} 条记录，第 {page}/{totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

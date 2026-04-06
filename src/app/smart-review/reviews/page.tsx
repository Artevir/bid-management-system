'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  FileText, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock,
  Eye,
  User
} from 'lucide-react';

interface ReviewDocument {
  id: number;
  fileName: string;
  projectName: string | null;
  projectCode: string | null;
  reviewStatus: string;
  status: string;
  extractionAccuracy: number | null;
  createdAt: string;
  reviewerId: number | null;
}

const reviewStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '审核中', color: 'bg-blue-100 text-blue-800' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
  needs_revision: { label: '需修改', color: 'bg-orange-100 text-orange-800' },
};

export default function SmartReviewWorkbenchPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<ReviewDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50',
        keyword,
        reviewStatus: statusFilter,
      });
      
      const res = await fetch(`/api/smart-review?${params}`);
      const data = await res.json();
      
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Fetch documents error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [statusFilter]);

  const handleSearch = () => {
    fetchDocuments();
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">审核工作台</h1>
        <p className="text-gray-500">审核智能解析后的招标文件</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card 
          className={`cursor-pointer ${statusFilter === 'pending' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">待审核</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {documents.filter(d => d.reviewStatus === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer ${statusFilter === 'in_progress' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter('in_progress')}
        >
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">审核中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {documents.filter(d => d.reviewStatus === 'in_progress').length}
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer ${statusFilter === 'approved' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter('approved')}
        >
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">已通过</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {documents.filter(d => d.reviewStatus === 'approved').length}
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer ${statusFilter === 'rejected' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter('rejected')}
        >
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">已拒绝</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {documents.filter(d => d.reviewStatus === 'rejected').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>待审核文档</CardTitle>
              <CardDescription>点击文档进行审核</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="搜索文件名、项目名..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-64"
              />
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
                <TableHead>提取精度</TableHead>
                <TableHead>上传时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    暂无待审核文档
                  </TableCell>
                </TableRow>
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
                      <Badge className={reviewStatusLabels[doc.status]?.color}>
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {doc.extractionAccuracy ? `${doc.extractionAccuracy}%` : '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/smart-review/${doc.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        审核
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

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
  AlertCircle,
  Play,
  RefreshCw
} from 'lucide-react';

interface MatrixDocument {
  id: number;
  fileName: string;
  projectName: string | null;
  projectCode: string | null;
  status: string;
  specCount: number;
  scoringCount: number;
  createdAt: string;
}

export default function SmartReviewMatrixPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<MatrixDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [generating, setGenerating] = useState<number | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50',
        keyword,
        status: 'parsed',
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
  }, []);

  const handleSearch = () => {
    fetchDocuments();
  };

  const handleGenerateMatrix = async (docId: number) => {
    setGenerating(docId);
    try {
      const res = await fetch(`/api/smart-review/${docId}/matrix`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.matrix) {
        router.push(`/smart-review/${docId}/matrix`);
      }
    } catch (error) {
      console.error('Generate matrix error:', error);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">响应矩阵</h1>
        <p className="text-gray-500">根据招标文件自动生成投标响应矩阵</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">已解析文档</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.filter(d => d.status === 'parsed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">技术规格总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.reduce((sum, d) => sum + (d.specCount || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">评分细则总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.reduce((sum, d) => sum + (d.scoringCount || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>文档列表</CardTitle>
              <CardDescription>选择文档生成响应矩阵</CardDescription>
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
                <TableHead>技术规格</TableHead>
                <TableHead>评分细则</TableHead>
                <TableHead>上传时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    暂无已解析的文档
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
                      <Badge className="bg-green-100 text-green-800">
                        已解析
                      </Badge>
                    </TableCell>
                    <TableCell>{doc.specCount}</TableCell>
                    <TableCell>{doc.scoringCount}</TableCell>
                    <TableCell>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/smart-review/${doc.id}`)}
                      >
                        查看
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        className="ml-2"
                        onClick={() => handleGenerateMatrix(doc.id)}
                        disabled={generating === doc.id}
                      >
                        {generating === doc.id ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        生成矩阵
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

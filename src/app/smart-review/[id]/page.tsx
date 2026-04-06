'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Play,
  Download,
  Eye
} from 'lucide-react';

interface SmartReviewDocument {
  id: number;
  fileName: string;
  fileUrl: string;
  fileExt: string;
  fileSize: number;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  tenderAgent: string | null;
  projectBudget: string | null;
  tenderMethod: string | null;
  tenderScope: string | null;
  status: string;
  reviewStatus: string;
  parseProgress: number;
  extractionAccuracy: number | null;
  basicInfo: any;
  feeInfo: any;
  timeNodes: any;
  submissionRequirements: any;
  technicalSpecs: any;
  scoringItems: any;
  qualificationRequirements: any;
  framework: any;
  specCount: number;
  scoringCount: number;
  chapterCount: number;
  confidentialityLevel: string;
  createdAt: string;
  updatedAt: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  uploading: { label: '上传中', color: 'bg-blue-100 text-blue-800' },
  parsing: { label: '解析中', color: 'bg-yellow-100 text-yellow-800' },
  parsed: { label: '已解析', color: 'bg-green-100 text-green-800' },
  reviewing: { label: '审核中', color: 'bg-purple-100 text-purple-800' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
};

const reviewStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '审核中', color: 'bg-blue-100 text-blue-800' },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
  needs_revision: { label: '需修改', color: 'bg-orange-100 text-orange-800' },
};

export default function SmartReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [document, setDocument] = useState<SmartReviewDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [documentId, setDocumentId] = useState<string>('');

  useEffect(() => {
    params.then(p => {
      setDocumentId(p.id);
      fetchDocument(p.id);
    });
  }, [params]);

  const fetchDocument = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/smart-review/${id}`);
      const data = await res.json();
      if (data.document) {
        setDocument(data.document);
      }
    } catch (error) {
      console.error('Fetch document error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleParse = async () => {
    if (!document) return;
    setParsing(true);
    try {
      const res = await fetch(`/api/smart-review/${document.id}/parse`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.document) {
        setDocument(data.document);
      }
    } catch (error) {
      console.error('Parse error:', error);
    } finally {
      setParsing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8">文档不存在</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/smart-review')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{document.fileName}</h1>
          <p className="text-gray-500">
            项目: {document.projectName || '-'} | 编号: {document.projectCode || '-'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusLabels[document.status]?.color}>
            {statusLabels[document.status]?.label || document.status}
          </Badge>
          <Badge className={reviewStatusLabels[document.reviewStatus]?.color}>
            {reviewStatusLabels[document.reviewStatus]?.label || document.reviewStatus}
          </Badge>
          {document.status === 'parsed' && (
            <Button variant="outline" size="sm" onClick={handleParse} disabled={parsing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${parsing ? 'animate-spin' : ''}`} />
              重新解析
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">提取精度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {document.extractionAccuracy ? `${document.extractionAccuracy}%` : '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">技术规格</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{document.specCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">评分细则</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{document.scoringCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">文档章节</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{document.chapterCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="fee">费用信息</TabsTrigger>
          <TabsTrigger value="time">时间节点</TabsTrigger>
          <TabsTrigger value="tech">技术规格</TabsTrigger>
          <TabsTrigger value="scoring">评分细则</TabsTrigger>
          <TabsTrigger value="framework">文档框架</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>项目基本信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500">项目名称</span>
                  <p className="font-medium">{document.projectName || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">项目编号</span>
                  <p className="font-medium">{document.projectCode || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">招标单位</span>
                  <p className="font-medium">{document.tenderOrganization || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">招标代理</span>
                  <p className="font-medium">{document.tenderAgent || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">项目预算</span>
                  <p className="font-medium">{document.projectBudget || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">招标方式</span>
                  <p className="font-medium">{document.tenderMethod || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">招标范围</span>
                  <p className="font-medium">{document.tenderScope || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fee">
          <Card>
            <CardHeader>
              <CardTitle>费用相关信息</CardTitle>
            </CardHeader>
            <CardContent>
              {document.feeInfo ? (
                <div className="space-y-4">
                  {Object.entries(document.feeInfo).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-sm text-gray-500">{key}</span>
                      <p className="font-medium">{String(value) || '-'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">暂无费用信息</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time">
          <Card>
            <CardHeader>
              <CardTitle>关键时间节点</CardTitle>
            </CardHeader>
            <CardContent>
              {document.timeNodes && document.timeNodes.length > 0 ? (
                <div className="space-y-2">
                  {document.timeNodes.map((node: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 p-3 border rounded">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{node.name}</span>
                      <span>{node.time}</span>
                      {node.location && <span className="text-gray-500">{node.location}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">暂无时间节点</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tech">
          <Card>
            <CardHeader>
              <CardTitle>技术规格要求</CardTitle>
            </CardHeader>
            <CardContent>
              {document.technicalSpecs && document.technicalSpecs.length > 0 ? (
                <div className="space-y-2">
                  {document.technicalSpecs.map((spec: any, index: number) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{spec.category || '技术规格'}</Badge>
                        <span className="font-medium">{spec.name || spec.specName}</span>
                      </div>
                      <p className="text-sm text-gray-600">{spec.requirement || spec.specRequirement}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">暂无技术规格</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring">
          <Card>
            <CardHeader>
              <CardTitle>评分细则</CardTitle>
            </CardHeader>
            <CardContent>
              {document.scoringItems && document.scoringItems.length > 0 ? (
                <div className="space-y-2">
                  {document.scoringItems.map((item: any, index: number) => (
                    <div key={index} className="p-3 border rounded flex items-center gap-4">
                      <Badge>{item.category || '评分项'}</Badge>
                      <span className="font-medium flex-1">{item.itemName}</span>
                      <Badge variant="secondary">{item.score}分</Badge>
                      <span className="text-sm text-gray-500">{item.criteria}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">暂无评分细则</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="framework">
          <Card>
            <CardHeader>
              <CardTitle>文档框架</CardTitle>
            </CardHeader>
            <CardContent>
              {document.framework && document.framework.length > 0 ? (
                <div className="space-y-2">
                  {document.framework.map((chap: any, index: number) => (
                    <div key={index} className="p-3 border rounded flex items-center gap-4">
                      <span className="text-sm text-gray-500">{chap.chapter}</span>
                      <span className="font-medium flex-1">{chap.title}</span>
                      {chap.pageNum && <Badge variant="outline">第{chap.pageNum}页</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">暂无文档框架</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {document.status === 'parsed' && (
        <div className="mt-6 flex gap-2">
          <Button onClick={() => router.push(`/smart-review/${document.id}/matrix`)}>
            <Eye className="h-4 w-4 mr-2" />
            查看响应矩阵
          </Button>
          <Button variant="outline" onClick={() => router.push(`/smart-review/${document.id}/review`)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            提交审核
          </Button>
        </div>
      )}
    </div>
  );
}

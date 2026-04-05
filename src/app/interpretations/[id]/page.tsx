'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as _CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  ArrowLeft,
  FileText as _FileText,
  Clock,
  Building as _Building,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Plus,
  Loader2,
  Calendar,
  Shield,
  Lock,
} from 'lucide-react';
  MapPin,
  Phone as _Phone,
  Mail as _Mail,
  Users as _Users,
  Briefcase,
  DollarSign as _DollarSign,
  Settings,
  Award,
  FileCheck,
  Link2,
  ArrowRight,
  FolderSync,
  FileJson,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

interface InterpretationDetail {
  id: number;
  documentName: string;
  documentUrl: string;
  documentExt: string;
  documentSize: number | null;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  tenderAgent: string | null;
  projectBudget: string | null;
  projectId: number | null;
  status: 'pending' | 'parsing' | 'completed' | 'failed';
  parseProgress: number;
  parseError: string | null;
  extractAccuracy: number | null;
  extractMeta?: Record<string, unknown> | null;
  specCount: number;
  scoringCount: number;
  checklistCount: number;
  createdAt: string;
  updatedAt: string;
  reviewStatus: 'pending' | 'approved' | 'rejected' | null;
  reviewerId: number | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
reviewAccuracy: number | null;
  currentApprovalLevel: number | null;
  approvalLevelRequired: number | null;
  confidentialityLevel: string | null;
  assignedReviewerId: number | null;
  assignedReviewerName: string | null;
  basicInfo: Record<string, unknown> | null;
  timeNodes: Array<{ name: string; time: string; location?: string }> | null;
  submissionRequirements: Record<string, unknown> | null;
  feeInfo: Record<string, unknown> | null;
  qualificationRequirements: Array<Record<string, unknown>> | null;
  personnelRequirements: Array<Record<string, unknown>> | null;
  docRequirements: Record<string, unknown> | null;
  otherRequirements: Record<string, unknown> | null;
  tags: string[];
  technicalSpecs: Array<{
    id: number;
    specCategory: string;
    specName: string;
    specValue: string | null;
    specRequirement: string | null;
    isKeyParam: boolean;
    isMandatory: boolean;
    responseStatus: string;
  }>;
  scoringItems: Array<{
    id: number;
    scoringCategory: string;
    itemName: string;
    maxScore: number;
    scoringCriteria: string | null;
    selfScore: number | null;
    responseStatus: string;
  }>;
  checklist: Array<{
    id: number;
    checklistCategory: string;
    itemName: string;
    requirementDetail: string | null;
    isMandatory: boolean;
    checkStatus: string;
  }>;
  framework: Array<{
    id: number;
    chapterNumber: string | null;
    chapterTitle: string;
    chapterType: string | null;
    level: number;
    children: Array<{ id: number; chapterTitle: string }>;
  }>;
  logs: Array<{
    id: number;
    operationType: string;
    operationContent: string;
    operatorName: string | null;
    operationTime: string;
  }>;
}

const statusConfig = {
  pending: { label: '待解析', color: 'bg-gray-100 text-gray-800', icon: Clock },
  parsing: { label: '解析中', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { label: '解析失败', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const reviewStatusConfig = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const getReviewStatusLabel = () => {
  const status = data?.reviewStatus;
  const currentLevel = data?.currentApprovalLevel || 1;
  const requiredLevel = data?.approvalLevelRequired || 1;
  
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已驳回';
  if (status === 'pending' && currentLevel > 1) {
    return `待${currentLevel}级审核`;
  }
  return '待审核';
};

const getReviewStatusColor = () => {
  const status = data?.reviewStatus;
  if (status === 'approved') return 'bg-green-100 text-green-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
};

export default function InterpretationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<InterpretationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    action: 'approve' as 'approve' | 'reject',
    accuracy: 90,
    comment: '',
  });
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const getEvidence = (
    meta: Record<string, unknown> | null | undefined,
    path: string[]
  ): { confidence?: number; quote?: string } | null => {
    if (!meta) return null;
    let current: any = meta;
    for (const key of path) {
      if (!current || typeof current !== 'object') return null;
      current = current[key];
    }
    if (!current || typeof current !== 'object') return null;
    const confidence = (current as any).confidence;
    const quote = (current as any).quote;
    return {
      confidence: typeof confidence === 'number' ? confidence : undefined,
      quote: typeof quote === 'string' ? quote : undefined,
    };
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/interpretations/${id}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        console.error('获取数据失败:', result.error);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 轮询解析状态
  useEffect(() => {
    if (data?.status === 'parsing') {
      const interval = setInterval(fetchData, 3000);
      return () => clearInterval(interval);
    }
  }, [data?.status, fetchData]);

  const handleStartParse = async () => {
    try {
      const response = await fetch(`/api/interpretations/${id}/parse`, {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success) {
        fetchData();
      }
    } catch (error) {
      console.error('启动解析失败:', error);
    }
  };

  // 同步到项目
  const [syncing, setSyncing] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const handleSyncToProject = async () => {
    if (!data?.projectId) {
      alert('请先关联项目');
      return;
    }
    
    setSyncing(true);
    try {
      const response = await fetch('/api/project-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          projectId: data.projectId,
          interpretationId: data.id,
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        alert(result.message);
        fetchData();
      } else {
        alert(result.message || '同步失败');
      }
    } catch (error) {
      console.error('同步失败:', error);
      alert('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateProject = async () => {
    if (!confirm('确定要从该解读创建新项目吗？\n\n将自动填充项目名称、编号、招标单位等信息。')) {
      return;
    }
    
    setCreatingProject(true);
    try {
      const response = await fetch('/api/project-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link',
          interpretationId: data?.id,
          createNew: true,
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        alert('项目创建成功！');
        fetchData();
        // 可选：跳转到项目详情页
        if (result.projectId) {
          router.push(`/projects/${result.projectId}`);
        }
      } else {
        alert(result.message || '创建失败');
      }
    } catch (error) {
      console.error('创建项目失败:', error);
      alert('创建项目失败');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleReview = async () => {
    setReviewing(true);
    try {
      const response = await fetch(`/api/interpretations/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewForm.action,
          accuracy: reviewForm.accuracy,
          comment: reviewForm.comment,
        }),
      });
      
      const result = await response.json();
        if (result.success) {
          alert(result.message);
          setShowReviewDialog(false);
          fetchData();
        } else {
          alert(result.message || '审核失败');
        }
        if (result.needNextLevel) {
          alert(`已通过第${result.currentLevel}级审核，需要继续进行第${result.currentLevel + 1}级审核`);
        }
    } catch (error) {
      console.error('审核失败:', error);
      alert('审核失败');
    } finally {
      setReviewing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const _formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>解读记录不存在或已被删除</AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => router.push('/interpretations')}>
          返回列表
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[data.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/interpretations')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{data.projectName || data.documentName}</h1>
            <p className="text-muted-foreground">{data.documentName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge className={statusInfo.color}>
              <StatusIcon className={`w-3 h-3 mr-1 ${data.status === 'parsing' ? 'animate-spin' : ''}`} />
              {statusInfo.label}
            </Badge>
            {data.status === 'completed' && (
              <Badge className={getReviewStatusColor()}>
                {data.reviewStatus === 'approved' ? (
                  <CheckCircle className="w-3 h-3 mr-1" />
                ) : data.reviewStatus === 'rejected' ? (
                  <XCircle className="w-3 h-3 mr-1" />
                ) : (
                  <Clock className="w-3 h-3 mr-1" />
                )}
                {getReviewStatusLabel()}
                {data.currentApprovalLevel && data.approvalLevelRequired && data.reviewStatus === 'pending' && data.currentApprovalLevel < data.approvalLevelRequired && (
                  <span className="ml-1 text-xs">({data.currentApprovalLevel}/{data.approvalLevelRequired})</span>
                )}
              </Badge>
            )}
            {/* 密级 */}
            {data.confidentialityLevel && data.confidentialityLevel !== 'public' && (
              <Badge className={
                data.confidentialityLevel === 'secret' ? 'bg-red-100 text-red-800' :
                data.confidentialityLevel === 'confidential' ? 'bg-orange-100 text-orange-800' :
                'bg-blue-100 text-blue-800'
              }>
                {data.confidentialityLevel === 'secret' ? '绝密' :
                 data.confidentialityLevel === 'confidential' ? '机密' :
                 data.confidentialityLevel === 'internal' ? '内部' : '公开'}
              </Badge>
            )}
          </div>
          {data.status === 'pending' && (
            <Button onClick={handleStartParse}>
              <RefreshCw className="w-4 h-4 mr-2" />
              开始解析
            </Button>
          )}
          {data.status === 'failed' && (
            <Button onClick={handleStartParse}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重新解析
            </Button>
          )}
          {data.status === 'completed' && (
            <>
              <Button 
                variant="outline"
                onClick={() => setShowReviewDialog(true)}
              >
                <FileCheck className="w-4 h-4 mr-2" />
                审核解读
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Download className="w-4 h-4 mr-2" />
                    导出结果
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link href={`/api/interpretations/${id}/export?format=json`} target="_blank">
                      <FileJson className="w-4 h-4 mr-2" />
                      导出 JSON
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/api/interpretations/${id}/export?format=excel`} target="_blank">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      导出 Excel
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/api/interpretations/${id}/export?format=word`} target="_blank">
                      <FileText className="w-4 h-4 mr-2" />
                      导出 Word
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/api/interpretations/${id}/export?format=txt`} target="_blank">
                      <FileText className="w-4 h-4 mr-2" />
                      导出 TXT
                    </Link>
                  </DropdownMenuItem>
<DropdownMenuItem asChild>
                      <Link href={`/api/interpretations/${id}/export?format=pdf`} target="_blank">
                        <FileText className="w-4 h-4 mr-2" />
                        导出 PDF
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 密级设置 */}
                <Select
                  value={data.confidentialityLevel || 'public'}
                  onValueChange={async (value) => {
                    try {
                      const res = await fetch(`/api/interpretations/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ confidentialityLevel: value }),
                      });
                      if (res.ok) fetchData();
                    } catch (e) { console.error(e); }
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <Shield className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">公开</SelectItem>
                    <SelectItem value="internal">内部</SelectItem>
                    <SelectItem value="confidential">机密</SelectItem>
                    <SelectItem value="secret">绝密</SelectItem>
                  </SelectContent>
                </Select>

                {/* 分配审核人 */}
                <Button variant="outline" onClick={() => setShowAssignDialog(true)}>
                  <Lock className="w-4 h-4 mr-2" />
                  分配审核
                </Button>
                
                {/* 项目联动按钮 */}
              {data.projectId ? (
                <>
                  <Button variant="outline" onClick={handleSyncToProject} disabled={syncing}>
                    {syncing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FolderSync className="w-4 h-4 mr-2" />
                    )}
                    同步到项目
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/projects/${data.projectId}`}>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      查看项目
                    </Link>
                  </Button>
                </>
              ) : (
                <Button onClick={handleCreateProject} disabled={creatingProject}>
                  {creatingProject ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  创建项目
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 已关联项目提示 */}
      {data.projectId && data.status === 'completed' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Link2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">已关联项目</p>
                <p className="text-sm text-green-700">
                  解读信息已关联到项目，可随时同步最新信息
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${data.projectId}`}>
                前往项目
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 解析中进度 */}
      {data.status === 'parsing' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-center gap-4 py-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">正在解析招标文件...</p>
              <p className="text-sm text-blue-700">
                系统正在提取关键信息，预计需要 1-3 分钟
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 解析失败 */}
      {data.status === 'failed' && data.parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>解析失败</AlertTitle>
          <AlertDescription>{data.parseError}</AlertDescription>
        </Alert>
      )}

      {/* 审核状态 */}
      {data.status === 'completed' && data.reviewStatus && (
        <Card className={data.reviewStatus === 'approved' ? 'border-green-200 bg-green-50' : data.reviewStatus === 'rejected' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              {data.reviewStatus === 'approved' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : data.reviewStatus === 'rejected' ? (
                <XCircle className="w-6 h-6 text-red-600" />
              ) : (
                <Clock className="w-6 h-6 text-yellow-600" />
              )}
              <div>
                <p className="font-medium text-green-900">
                  审核状态：{data.reviewStatus === 'approved' ? '已通过' : data.reviewStatus === 'rejected' ? '已驳回' : '待审核'}
                </p>
                {data.reviewerName && (
                  <p className="text-sm text-muted-foreground">
                    审核人：{data.reviewerName} · {data.reviewedAt ? formatDate(data.reviewedAt) : ''}
                  </p>
                )}
                {data.reviewAccuracy && (
                  <p className="text-sm text-muted-foreground">
                    审核准确率：{data.reviewAccuracy}%
                  </p>
                )}
              </div>
            </div>
            {data.reviewComment && (
              <div className="text-sm text-muted-foreground max-w-md">
                <span className="font-medium">审核意见：</span>
                {data.reviewComment}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">技术规格</p>
              <p className="text-xl font-bold">{data.specCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-green-100">
              <Award className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">评分细则</p>
              <p className="text-xl font-bold">{data.scoringCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-orange-100">
              <FileCheck className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">核对清单</p>
              <p className="text-xl font-bold">{data.checklistCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-purple-100">
              <Briefcase className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">提取精度</p>
              <p className="text-xl font-bold">{data.extractAccuracy ? `${data.extractAccuracy}%` : '-'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详情标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="time">时间节点</TabsTrigger>
          <TabsTrigger value="specs">技术规格</TabsTrigger>
          <TabsTrigger value="scoring">评分细则</TabsTrigger>
          <TabsTrigger value="checklist">核对清单</TabsTrigger>
          <TabsTrigger value="logs">操作日志</TabsTrigger>
        </TabsList>

        {/* 概览 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">项目基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.basicInfo ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">项目名称</span>
                      <span className="font-medium">{String(data.basicInfo.projectName || '-')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">项目编号</span>
                      <span>{String(data.basicInfo.projectCode || '-')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">招标单位</span>
                      <span>{String(data.basicInfo.tenderOrganization || '-')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">招标代理</span>
                      <span>{String(data.basicInfo.tenderAgent || '-')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">项目预算</span>
                      <span>{String(data.basicInfo.projectBudget || '-')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">招标方式</span>
                      <span>{String(data.basicInfo.tenderMethod || '-')}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">暂无信息</p>
                )}
              </CardContent>
            </Card>

            {/* 费用信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">费用相关信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.feeInfo ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">招标文件费用</span>
                      <span>{(data.feeInfo.documentFee as string) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">投标保证金</span>
                      <span>{(data.feeInfo.bidBond as string) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">保证金截止</span>
                      <span>{(data.feeInfo.bidBondDeadline as string) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">履约保证金</span>
                      <span>{(data.feeInfo.performanceBond as string) || '-'}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">暂无信息</p>
                )}
              </CardContent>
            </Card>

            {/* 投标要求 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">投标提交要求</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.submissionRequirements ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">提交方式</span>
                      <span>{(data.submissionRequirements.submissionMethod as string) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">提交地点</span>
                      <span>{(data.submissionRequirements.submissionLocation as string) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">联系人</span>
                      <span>{(data.submissionRequirements.contactPerson as string) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">联系电话</span>
                      <span>{(data.submissionRequirements.contactPhone as string) || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">正本副本</span>
                      <span>{(data.submissionRequirements.copiesRequired as string) || '-'}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">暂无信息</p>
                )}
              </CardContent>
            </Card>

            {/* 文档框架 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">文档框架</CardTitle>
              </CardHeader>
              <CardContent>
                {data.framework && data.framework.length > 0 ? (
                  <div className="space-y-2">
                    {data.framework.slice(0, 5).map((chapter) => (
                      <div key={chapter.id} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {chapter.chapterNumber || '-'}
                        </Badge>
                        <span className="text-sm">{chapter.chapterTitle}</span>
                      </div>
                    ))}
                    {data.framework.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        还有 {data.framework.length - 5} 个章节...
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">暂无信息</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">证据与置信度</CardTitle>
            </CardHeader>
            <CardContent>
              {data.extractMeta ? (
                <Accordion type="single" collapsible className="w-full">
                  {[
                    {
                      key: 'basicInfo.projectName',
                      label: '项目名称',
                      value: data.basicInfo?.projectName,
                      path: ['basicInfo', 'projectName'],
                    },
                    {
                      key: 'basicInfo.projectCode',
                      label: '项目编号',
                      value: data.basicInfo?.projectCode,
                      path: ['basicInfo', 'projectCode'],
                    },
                    {
                      key: 'basicInfo.tenderOrganization',
                      label: '招标单位',
                      value: data.basicInfo?.tenderOrganization,
                      path: ['basicInfo', 'tenderOrganization'],
                    },
                    {
                      key: 'basicInfo.tenderAgent',
                      label: '招标代理',
                      value: data.basicInfo?.tenderAgent,
                      path: ['basicInfo', 'tenderAgent'],
                    },
                    {
                      key: 'basicInfo.projectBudget',
                      label: '项目预算',
                      value: data.basicInfo?.projectBudget,
                      path: ['basicInfo', 'projectBudget'],
                    },
                    {
                      key: 'basicInfo.tenderMethod',
                      label: '招标方式',
                      value: data.basicInfo?.tenderMethod,
                      path: ['basicInfo', 'tenderMethod'],
                    },
                    {
                      key: 'feeInfo.documentFee',
                      label: '招标文件费用',
                      value: (data.feeInfo as any)?.documentFee,
                      path: ['feeInfo', 'documentFee'],
                    },
                    {
                      key: 'feeInfo.bidBond',
                      label: '投标保证金',
                      value: (data.feeInfo as any)?.bidBond,
                      path: ['feeInfo', 'bidBond'],
                    },
                    {
                      key: 'feeInfo.bidBondDeadline',
                      label: '保证金截止',
                      value: (data.feeInfo as any)?.bidBondDeadline,
                      path: ['feeInfo', 'bidBondDeadline'],
                    },
                    {
                      key: 'submissionRequirements.submissionLocation',
                      label: '提交地点',
                      value: (data.submissionRequirements as any)?.submissionLocation,
                      path: ['submissionRequirements', 'submissionLocation'],
                    },
                    {
                      key: 'submissionRequirements.contactPerson',
                      label: '联系人',
                      value: (data.submissionRequirements as any)?.contactPerson,
                      path: ['submissionRequirements', 'contactPerson'],
                    },
                    {
                      key: 'submissionRequirements.contactPhone',
                      label: '联系电话',
                      value: (data.submissionRequirements as any)?.contactPhone,
                      path: ['submissionRequirements', 'contactPhone'],
                    },
                  ].map((item) => {
                    const evidence = getEvidence(data.extractMeta || null, item.path);
                    const confidencePct =
                      typeof evidence?.confidence === 'number'
                        ? Math.round(Math.max(0, Math.min(1, evidence.confidence)) * 100)
                        : null;
                    return (
                      <AccordionItem key={item.key} value={item.key}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex w-full items-center justify-between gap-3 pr-2">
                            <div className="flex items-center gap-2">
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {item.value ? String(item.value) : '-'}
                              </Badge>
                              <Badge className="text-xs">
                                {confidencePct === null ? '-' : `${confidencePct}%`}
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">证据引用</div>
                            <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                              {evidence?.quote || '暂无证据'}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <p className="text-muted-foreground text-center py-6">
                  暂无证据数据。请重新解析生成 evidence（quote + confidence）。
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 时间节点 */}
        <TabsContent value="time">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">关键时间节点</CardTitle>
            </CardHeader>
            <CardContent>
              {data.timeNodes && data.timeNodes.length > 0 ? (
                <div className="space-y-4">
                  {data.timeNodes.map((node, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{node.name}</p>
                        <p className="text-lg">{node.time}</p>
                        {node.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {node.location}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">暂无时间节点信息</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 技术规格 */}
        <TabsContent value="specs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">技术规格要求</CardTitle>
            </CardHeader>
            <CardContent>
              {data.technicalSpecs && data.technicalSpecs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>分类</TableHead>
                      <TableHead>规格名称</TableHead>
                      <TableHead>规格值</TableHead>
                      <TableHead>要求描述</TableHead>
                      <TableHead>关键参数</TableHead>
                      <TableHead>响应状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.technicalSpecs.map((spec) => (
                      <TableRow key={spec.id}>
                        <TableCell>
                          <Badge variant="outline">{spec.specCategory}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{spec.specName}</TableCell>
                        <TableCell>{spec.specValue || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{spec.specRequirement || '-'}</TableCell>
                        <TableCell>
                          {spec.isKeyParam ? (
                            <Badge className="bg-orange-100 text-orange-800">关键</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              spec.responseStatus === 'compliant'
                                ? 'bg-green-100 text-green-800'
                                : spec.responseStatus === 'non_compliant'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }
                          >
                            {spec.responseStatus === 'compliant'
                              ? '符合'
                              : spec.responseStatus === 'non_compliant'
                              ? '不符合'
                              : '待响应'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">暂无技术规格信息</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 评分细则 */}
        <TabsContent value="scoring">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">评分细则</CardTitle>
            </CardHeader>
            <CardContent>
              {data.scoringItems && data.scoringItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>分类</TableHead>
                      <TableHead>评分项</TableHead>
                      <TableHead>满分</TableHead>
                      <TableHead>自评分</TableHead>
                      <TableHead>评分标准</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.scoringItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline">{item.scoringCategory}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell>{item.maxScore}分</TableCell>
                        <TableCell>
                          {item.selfScore !== null ? `${item.selfScore}分` : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.scoringCriteria || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              item.responseStatus === 'responded'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }
                          >
                            {item.responseStatus === 'responded' ? '已响应' : '待响应'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">暂无评分细则信息</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 核对清单 */}
        <TabsContent value="checklist">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">资质要求核对清单</CardTitle>
            </CardHeader>
            <CardContent>
              {data.checklist && data.checklist.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>分类</TableHead>
                      <TableHead>核对项</TableHead>
                      <TableHead>要求详情</TableHead>
                      <TableHead>必须</TableHead>
                      <TableHead>核对状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.checklist.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline">{item.checklistCategory}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.requirementDetail || '-'}
                        </TableCell>
                        <TableCell>
                          {item.isMandatory ? (
                            <Badge className="bg-red-100 text-red-800">必须</Badge>
                          ) : (
                            <Badge variant="outline">可选</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              item.checkStatus === 'compliant'
                                ? 'bg-green-100 text-green-800'
                                : item.checkStatus === 'non_compliant'
                                ? 'bg-red-100 text-red-800'
                                : item.checkStatus === 'partial'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }
                          >
                            {item.checkStatus === 'compliant'
                              ? '符合'
                              : item.checkStatus === 'non_compliant'
                              ? '不符合'
                              : item.checkStatus === 'partial'
                              ? '部分符合'
                              : '待核对'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">暂无核对清单信息</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 操作日志 */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">操作日志</CardTitle>
            </CardHeader>
            <CardContent>
              {data.logs && data.logs.length > 0 ? (
                <div className="space-y-3">
                  {data.logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="p-2 rounded-full bg-muted">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.operationContent}</span>
                          <Badge variant="outline" className="text-xs">
                            {log.operationType}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {log.operatorName || '系统'} · {formatDate(log.operationTime)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">暂无操作日志</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 审核对话框 */}
      {showReviewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">审核解读结果</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">审核结果</label>
                <div className="flex gap-2">
                  <Button
                    variant={reviewForm.action === 'approve' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setReviewForm({ ...reviewForm, action: 'approve' })}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    通过
                  </Button>
                  <Button
                    variant={reviewForm.action === 'reject' ? 'destructive' : 'outline'}
                    className="flex-1"
                    onClick={() => setReviewForm({ ...reviewForm, action: 'reject' })}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    驳回
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  准确率评分: {reviewForm.accuracy}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={reviewForm.accuracy}
                  onChange={(e) => setReviewForm({ ...reviewForm, accuracy: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">审核意见</label>
                <textarea
                  className="w-full min-h-[100px] p-3 rounded-md border bg-background"
                  placeholder="请输入审核意见..."
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                取消
              </Button>
              <Button onClick={handleReview} disabled={reviewing}>
                {reviewing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                提交审核
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 分配审核人对话框 */}
      {showAssignDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">分配审核人</h3>
            <p className="text-sm text-muted-foreground mb-4">
              指定专人审核此解读文档
            </p>
            <div className="space-y-4">
              <div>
                <Label>当前分配审核人</Label>
                <p className="text-sm mt-1">
                  {data.assignedReviewerName || '未指定'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                取消
              </Button>
              <Button onClick={async () => {
                setAssigning(true);
                try {
                  const res = await fetch(`/api/interpretations/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assignedReviewerId: null }),
                  });
                  if (res.ok) {
                    alert('已清除审核人分配');
                    fetchData();
                    setShowAssignDialog(false);
                  }
                } catch (e) {
                  console.error(e);
                } finally {
                  setAssigning(false);
                }
              }} disabled={assigning || !data.assignedReviewerId}>
                清除分配
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

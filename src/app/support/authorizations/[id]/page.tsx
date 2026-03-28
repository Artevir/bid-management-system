/**
 * 授权申请详情页面
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  Building2,
  Clock,
  FileText,
  Truck,
  CheckCircle,
  XCircle,
  Plus,
  Edit,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ApplicationManufacturers } from '@/components/support/application-manufacturers';
import { ApplicationReviews } from '@/components/support/application-reviews';
import { ApplicationDeliveries } from '@/components/support/application-deliveries';
import { ApplicationTodos } from '@/components/support/application-todos';

// 状态映射
const STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '审核驳回',
  material_pending: '材料待接收',
  material_received: '材料已接收',
  completed: '授权完成',
  terminated: '申请终止',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  material_pending: 'bg-yellow-100 text-yellow-800',
  material_received: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-emerald-100 text-emerald-800',
  terminated: 'bg-slate-100 text-slate-800',
};

const TRACKING_STATUS_LABELS: Record<string, string> = {
  not_tracked: '未追踪',
  tracking: '追踪中',
  completed: '已完成',
};

// 完整申请数据类型
interface ApplicationDetail {
  id: number;
  applicationNo: string;
  projectId: number;
  applicationDate: string;
  handlerId: number;
  handlerName: string;
  handlerPhone: string | null;
  status: string;
  materialDeadline: string | null;
  electronicMaterialReceivedAt: string | null;
  paperMaterialReceivedAt: string | null;
  allMaterialReceivedAt: string | null;
  supplementaryNotes: string | null;
  trackingStatus: string;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  submissionDeadline: string | null;
  interpretationFileId: number | null;
  projectInfoChangeReason: string | null;
  createdAt: string;
  updatedAt: string;
  manufacturers: any[];
  deliveries: any[];
  reviews: any[];
  todos: any[];
}

export default function AuthorizationApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = parseInt(params.id as string);

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchApplication = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/support/authorizations/${applicationId}`);
      if (!res.ok) {
        throw new Error('获取授权申请详情失败');
      }
      const data = await res.json();
      setApplication(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取授权申请详情失败');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'yyyy-MM-dd', { locale: zhCN });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'yyyy-MM-dd HH:mm', { locale: zhCN });
  };

  const getStatusBadge = (status: string) => {
    const colorClass = STATUS_COLORS[status] || STATUS_COLORS.draft;
    return (
      <Badge className={colorClass}>
        {STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  // 提交申请
  const handleSubmit = async () => {
    if (!application) return;
    
    // 检查是否至少有3个厂家
    if (application.manufacturers.length < 3) {
      alert('请至少添加3个厂家（包含1个主投厂家）');
      return;
    }

    // 检查是否有主投厂家
    const hasMain = application.manufacturers.some(m => m.type === 'main');
    if (!hasMain) {
      alert('请至少设置1个主投厂家');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/support/authorizations/${applicationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '提交失败');
      }

      fetchApplication();
      alert('申请已提交');
    } catch (err) {
      alert(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/support/authorizations')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || '授权申请不存在'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // 检查是否可以编辑
  const canEdit = application.status === 'draft';
  // 检查是否可以提交
  const canSubmit = application.status === 'draft';
  // 检查是否可以审核
  const canReview = application.status === 'pending_review';

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/support/authorizations')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/support" className="hover:text-foreground">厂家支持</Link>
              <span>/</span>
              <Link href="/support/authorizations" className="hover:text-foreground">授权申请</Link>
              <span>/</span>
              <span className="text-foreground">{application.applicationNo}</span>
            </div>
            <h1 className="text-2xl font-bold">{application.projectName || '授权申请详情'}</h1>
            <p className="text-muted-foreground">申请编号: {application.applicationNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(application.status)}
          {canEdit && (
            <Button variant="outline" onClick={() => router.push(`/support/authorizations/${applicationId}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Button>
          )}
          {canSubmit && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              提交申请
            </Button>
          )}
        </div>
      </div>

      {/* 概览信息 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">经办人</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{application.handlerName}</div>
            <p className="text-xs text-muted-foreground">{application.handlerPhone || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">材料截止时间</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatDate(application.materialDeadline)}</div>
            <p className="text-xs text-muted-foreground">逾期将影响投标进度</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">招标单位</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{application.tenderOrganization || '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">厂家数量</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{application.manufacturers.length} 家</div>
            <p className="text-xs text-muted-foreground">
              主投: {application.manufacturers.filter(m => m.type === 'main').length} / 
              陪标: {application.manufacturers.filter(m => m.type === 'partner').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 详细信息标签页 */}
      <Tabs defaultValue="manufacturers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manufacturers">厂家配置</TabsTrigger>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="deliveries">交付记录</TabsTrigger>
          <TabsTrigger value="reviews">审核记录</TabsTrigger>
          <TabsTrigger value="todos">待办事项</TabsTrigger>
        </TabsList>

        {/* 厂家配置 */}
        <TabsContent value="manufacturers">
          <ApplicationManufacturers
            applicationId={applicationId}
            manufacturers={application.manufacturers}
            canEdit={canEdit}
            onUpdate={fetchApplication}
          />
        </TabsContent>

        {/* 基本信息 */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>申请基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 申请信息 */}
              <div>
                <h4 className="font-medium mb-3">申请信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">申请单编号</p>
                    <p className="font-mono">{application.applicationNo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">申请日期</p>
                    <p>{formatDate(application.applicationDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">申请状态</p>
                    <p>{getStatusBadge(application.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">待办追踪</p>
                    <p>{TRACKING_STATUS_LABELS[application.trackingStatus] || application.trackingStatus}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 项目信息 */}
              <div>
                <h4 className="font-medium mb-3">关联招标项目信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">项目名称</p>
                    <p className="font-medium">{application.projectName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">项目编号</p>
                    <p>{application.projectCode || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">招标单位</p>
                    <p>{application.tenderOrganization || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">投标截止日期</p>
                    <p>{formatDate(application.submissionDeadline)}</p>
                  </div>
                </div>
                {application.projectInfoChangeReason && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">修改原因</p>
                    <p className="text-sm">{application.projectInfoChangeReason}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* 材料接收确认时间 */}
              <div>
                <h4 className="font-medium mb-3">材料接收确认时间</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">电子档材料接收时间</p>
                    <p>{formatDateTime(application.electronicMaterialReceivedAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">纸质材料接收时间</p>
                    <p>{formatDateTime(application.paperMaterialReceivedAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">整套材料接收时间</p>
                    <p>{formatDateTime(application.allMaterialReceivedAt)}</p>
                  </div>
                </div>
              </div>

              {application.supplementaryNotes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">补充说明</h4>
                    <p className="text-sm whitespace-pre-wrap">{application.supplementaryNotes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 交付记录 */}
        <TabsContent value="deliveries">
          <ApplicationDeliveries
            applicationId={applicationId}
            deliveries={application.deliveries}
            canEdit={canEdit || application.status === 'material_pending'}
            onUpdate={fetchApplication}
          />
        </TabsContent>

        {/* 审核记录 */}
        <TabsContent value="reviews">
          <ApplicationReviews
            applicationId={applicationId}
            reviews={application.reviews}
            canReview={canReview}
            onUpdate={fetchApplication}
          />
        </TabsContent>

        {/* 待办事项 */}
        <TabsContent value="todos">
          <ApplicationTodos
            applicationId={applicationId}
            todos={application.todos}
            onUpdate={fetchApplication}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

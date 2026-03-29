/**
 * 样机申请详情页面
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
  MapPin as _MapPin,
  Truck,
  Package,
  Edit,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 状态映射
const STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '审核驳回',
  sample_pending: '样机待接收',
  sample_received: '样机已接收',
  sample_returned: '样机已归还',
  terminated: '申请终止',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  sample_pending: 'bg-yellow-100 text-yellow-800',
  sample_received: 'bg-cyan-100 text-cyan-800',
  sample_returned: 'bg-purple-100 text-purple-800',
  terminated: 'bg-slate-100 text-slate-800',
};

const RECEIVE_METHOD_LABELS: Record<string, string> = {
  self_pickup: '上门自提',
  logistics: '物流送达',
  manufacturer: '厂家直接送达',
};

const RETURN_METHOD_LABELS: Record<string, string> = {
  self_send: '我司寄送',
  manufacturer_pickup: '厂家自提',
  other: '其他',
};

// 完整申请数据类型
interface SampleApplicationDetail {
  id: number;
  applicationNo: string;
  projectName: string | null;
  projectCode: string | null;
  handlerName: string;
  handlerPhone: string | null;
  status: string;
  sampleDeadline: string | null;
  sampleReceivedAt: string | null;
  sampleReturnedAt: string | null;
  receiveMethod: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  storageLocationType: string | null;
  storageAddress: string | null;
  storageRequirements: string | null;
  returnMethod: string | null;
  returnContactName: string | null;
  returnContactPhone: string | null;
  supplementaryNotes: string | null;
  trackingStatus: string;
  createdAt: string;
  updatedAt: string;
  configurations: any[];
  display: any;
  reviews: any[];
  todos: any[];
}

export default function SampleApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = parseInt(params.id as string);

  const [application, setApplication] = useState<SampleApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchApplication = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/support/sample-applications/${applicationId}`);
      if (!res.ok) {
        throw new Error('获取样机申请详情失败');
      }
      const data = await res.json();
      setApplication(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取样机申请详情失败');
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
    
    if (application.configurations.length < 1) {
      alert('请至少添加1个样机配置');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/support/sample-applications/${applicationId}`, {
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
        <Button variant="ghost" onClick={() => router.push('/support/sample-applications')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || '样机申请不存在'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const canEdit = application.status === 'draft';
  const canSubmit = application.status === 'draft';

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/support/sample-applications')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/support" className="hover:text-foreground">厂家支持</Link>
              <span>/</span>
              <Link href="/support/sample-applications" className="hover:text-foreground">样机申请</Link>
              <span>/</span>
              <span className="text-foreground">{application.applicationNo}</span>
            </div>
            <h1 className="text-2xl font-bold">{application.projectName || '样机申请详情'}</h1>
            <p className="text-muted-foreground">申请编号: {application.applicationNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(application.status)}
          {canEdit && (
            <Button variant="outline" onClick={() => router.push(`/support/sample-applications/${applicationId}/edit`)}>
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
            <CardTitle className="text-sm font-medium">样机截止时间</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatDate(application.sampleDeadline)}</div>
            <p className="text-xs text-muted-foreground">逾期将影响投标进度</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">接收方式</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {application.receiveMethod ? RECEIVE_METHOD_LABELS[application.receiveMethod] : '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">样机数量</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{application.configurations.length} 台</div>
            <p className="text-xs text-muted-foreground">
              已接收: {application.sampleReceivedAt ? '是' : '否'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 详细信息标签页 */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="configurations">样机配置</TabsTrigger>
          <TabsTrigger value="display">现场展示</TabsTrigger>
        </TabsList>

        {/* 基本信息 */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>样机申请基本信息</CardTitle>
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
                    <p>{formatDate(application.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">申请状态</p>
                    <p>{getStatusBadge(application.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">项目编号</p>
                    <p>{application.projectCode || '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 接收信息 */}
              <div>
                <h4 className="font-medium mb-3">接收信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">接收方式</p>
                    <p>{application.receiveMethod ? RECEIVE_METHOD_LABELS[application.receiveMethod] : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">接收人</p>
                    <p>{application.receiverName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">接收人电话</p>
                    <p>{application.receiverPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">接收确认时间</p>
                    <p>{formatDateTime(application.sampleReceivedAt)}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 存放信息 */}
              <div>
                <h4 className="font-medium mb-3">存放信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">存放地点类型</p>
                    <p>{application.storageLocationType === 'our_company' ? '我司指定地址' : application.storageLocationType === 'their_company' ? '对方指定地址' : '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">存放地址</p>
                    <p>{application.storageAddress || '-'}</p>
                  </div>
                </div>
                {application.storageRequirements && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">存放要求</p>
                    <p className="text-sm">{application.storageRequirements}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* 归还信息 */}
              <div>
                <h4 className="font-medium mb-3">归还信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">归还方式</p>
                    <p>{application.returnMethod ? RETURN_METHOD_LABELS[application.returnMethod] : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">归还联系人</p>
                    <p>{application.returnContactName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">归还联系电话</p>
                    <p>{application.returnContactPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">归还时间</p>
                    <p>{formatDateTime(application.sampleReturnedAt)}</p>
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

        {/* 样机配置 */}
        <TabsContent value="configurations">
          <Card>
            <CardHeader>
              <CardTitle>样机配置列表</CardTitle>
              <CardDescription>共 {application.configurations.length} 个样机配置</CardDescription>
            </CardHeader>
            <CardContent>
              {application.configurations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无样机配置
                </div>
              ) : (
                <div className="space-y-4">
                  {application.configurations.map((config: any, index: number) => (
                    <Card key={config.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">样机 {index + 1}</CardTitle>
                          <Badge variant={config.deviationType === 'none' ? 'default' : 'secondary'}>
                            {config.deviationType === 'none' ? '无偏离' : config.deviationType === 'positive' ? '正偏离' : '负偏离'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">厂家名称</p>
                            <p className="font-medium">{config.manufacturerName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">样机名称</p>
                            <p>{config.sampleName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">样机规格</p>
                            <p>{config.sampleSpec || '-'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">数量</p>
                            <p>{config.quantity || 1}</p>
                          </div>
                        </div>
                        {config.sampleConfig && (
                          <div className="mt-4">
                            <p className="text-sm text-muted-foreground">配置参数</p>
                            <p className="text-sm whitespace-pre-wrap">{config.sampleConfig}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 现场展示 */}
        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle>现场展示信息</CardTitle>
            </CardHeader>
            <CardContent>
              {application.display ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">展示时间</p>
                      <p>{formatDateTime(application.display.displayTime)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">展示地点</p>
                      <p>{application.display.displayLocation || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">展示负责人</p>
                      <p>{application.display.displayManagerName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">负责人电话</p>
                      <p>{application.display.displayManagerPhone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">展示完成时间</p>
                      <p>{formatDateTime(application.display.displayCompletedTime)}</p>
                    </div>
                  </div>
                  {application.display.displayRequirements && (
                    <div>
                      <p className="text-sm text-muted-foreground">展示要求</p>
                      <p className="text-sm whitespace-pre-wrap">{application.display.displayRequirements}</p>
                    </div>
                  )}
                  {application.display.displayResultNotes && (
                    <div>
                      <p className="text-sm text-muted-foreground">展示结果说明</p>
                      <p className="text-sm whitespace-pre-wrap">{application.display.displayResultNotes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  暂无现场展示信息
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

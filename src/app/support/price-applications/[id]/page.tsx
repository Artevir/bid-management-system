/**
 * 价格申请详情页面
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Loader2,
  AlertCircle,
  Calendar,
  User,
  Building2,
  DollarSign,
  Edit,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { extractErrorMessage } from '@/lib/error-message';

// 状态映射
const STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '审核驳回',
  terminated: '申请终止',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  terminated: 'bg-slate-100 text-slate-800',
};

// 完整申请数据类型
interface PriceApplicationDetail {
  id: number;
  applicationNo: string;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  handlerName: string;
  handlerPhone: string | null;
  status: string;
  submissionDeadline: string | null;
  priceValidFrom: string | null;
  priceValidTo: string | null;
  notes: string | null;
  trackingStatus: string;
  createdAt: string;
  updatedAt: string;
  items: any[];
  reviews: any[];
}

export default function PriceApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = parseInt(params.id as string);

  const [application, setApplication] = useState<PriceApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchApplication = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/support/price-applications/${applicationId}`);
      if (!res.ok) {
        throw new Error('获取价格申请详情失败');
      }
      const data = await res.json();
      setApplication(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取价格申请详情失败');
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

  const getStatusBadge = (status: string) => {
    const colorClass = STATUS_COLORS[status] || STATUS_COLORS.draft;
    return <Badge className={colorClass}>{STATUS_LABELS[status] || status}</Badge>;
  };

  // 提交申请
  const handleSubmit = async () => {
    if (!application) return;

    if (application.items.length < 1) {
      alert('请至少添加1个价格明细');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/support/price-applications/${applicationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(extractErrorMessage(data, '提交失败'));
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
        <Button variant="ghost" onClick={() => router.push('/support/price-applications')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{String(error || '价格申请不存在')}</AlertDescription>
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
          <Button variant="ghost" onClick={() => router.push('/support/price-applications')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/support" className="hover:text-foreground">
                厂家支持
              </Link>
              <span>/</span>
              <Link href="/support/price-applications" className="hover:text-foreground">
                价格申请
              </Link>
              <span>/</span>
              <span className="text-foreground">{application.applicationNo}</span>
            </div>
            <h1 className="text-2xl font-bold">{application.projectName || '价格申请详情'}</h1>
            <p className="text-muted-foreground">申请编号: {application.applicationNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(application.status)}
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => router.push(`/support/price-applications/${applicationId}/edit`)}
            >
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
            <CardTitle className="text-sm font-medium">招标单位</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {application.tenderOrganization || '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">投标截止日期</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatDate(application.submissionDeadline)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">价格明细数量</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{application.items.length} 项</div>
          </CardContent>
        </Card>
      </div>

      {/* 详细信息标签页 */}
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">价格明细</TabsTrigger>
          <TabsTrigger value="info">基本信息</TabsTrigger>
        </TabsList>

        {/* 价格明细 */}
        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>价格明细列表</CardTitle>
              <CardDescription>共 {application.items.length} 个价格明细</CardDescription>
            </CardHeader>
            <CardContent>
              {application.items.length === 0 ? (
                <ListStateBlock state="empty" emptyText="暂无价格明细" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>厂家名称</TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead>产品规格</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>总价</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {application.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.manufacturerName}</TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.productSpec || '-'}</TableCell>
                        <TableCell>{item.unitPrice || '-'}</TableCell>
                        <TableCell>
                          {item.quantity ? `${item.quantity} ${item.unit || ''}` : '-'}
                        </TableCell>
                        <TableCell>{item.totalPrice || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{item.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 基本信息 */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>价格申请基本信息</CardTitle>
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

              {/* 项目信息 */}
              <div>
                <h4 className="font-medium mb-3">项目信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">项目名称</p>
                    <p className="font-medium">{application.projectName || '-'}</p>
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
              </div>

              <Separator />

              {/* 价格有效期 */}
              <div>
                <h4 className="font-medium mb-3">价格有效期</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">起始日期</p>
                    <p>{formatDate(application.priceValidFrom)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">截止日期</p>
                    <p>{formatDate(application.priceValidTo)}</p>
                  </div>
                </div>
              </div>

              {application.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">备注</h4>
                    <p className="text-sm whitespace-pre-wrap">{application.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

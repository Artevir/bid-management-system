/**
 * 友司支持申请详情页面
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
  Building,
  Phone,
  MessageSquare,
  FileText,
  DollarSign,
  Edit,
  Send,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 状态映射
const STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_confirm: '待友司确认',
  confirmed: '友司已确认',
  material_pending: '材料待接收',
  material_received: '材料已接收',
  completed: '支持完成',
  terminated: '申请终止',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_confirm: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  material_pending: 'bg-yellow-100 text-yellow-800',
  material_received: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-emerald-100 text-emerald-800',
  terminated: 'bg-slate-100 text-slate-800',
};

const CONFIRM_STATUS_LABELS: Record<string, string> = {
  confirmed: '已确认支持',
  pending: '待确认',
  rejected: '拒绝支持',
};

const CONFIRM_STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  basic: '基础资质材料',
  qualification: '资质材料',
  performance: '业绩材料',
  personnel: '人员相关材料',
  other: '其他材料',
};

// 完整申请数据类型
interface PartnerApplicationDetail {
  id: number;
  applicationNo: string;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  handlerName: string;
  handlerPhone: string | null;
  status: string;
  materialDeadline: string | null;
  electronicMaterialReceivedAt: string | null;
  paperMaterialReceivedAt: string | null;
  allMaterialReceivedAt: string | null;
  smsReminderEnabled: boolean;
  trackingStatus: string;
  submissionDeadline: string | null;
  biddingRequirements: string | null;
  partnerCompanyName: string;
  partnerContactPerson: string | null;
  partnerContactPhone: string | null;
  legalRepName: string | null;
  legalRepIdCardProvided: boolean | null;
  legalRepIdCardType: string | null;
  bidAgentName: string | null;
  bidAgentIdCardProvided: boolean | null;
  bidAgentIdCardType: string | null;
  bidAgentPhone: string | null;
  bidAgentWechat: string | null;
  partnerLiaisonName: string | null;
  partnerLiaisonPhone: string | null;
  partnerLiaisonWechat: string | null;
  partnerConfirmStatus: string;
  partnerConfirmedAt: string | null;
  materialReceiverName: string | null;
  materialReceiverPhone: string | null;
  electronicReceiveAddress: string | null;
  paperReceiveAddress: string | null;
  materialAcceptanceStatus: string | null;
  materialAcceptanceNotes: string | null;
  applicationSummary: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  materials: any[];
  fees: any[];
  reviews: any[];
  todos: any[];
}

export default function PartnerApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = parseInt(params.id as string);

  const [application, setApplication] = useState<PartnerApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchApplication = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/support/partner-applications/${applicationId}`);
      if (!res.ok) {
        throw new Error('获取友司支持申请详情失败');
      }
      const data = await res.json();
      setApplication(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取友司支持申请详情失败');
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

  const getConfirmStatusBadge = (status: string) => {
    const colorClass = CONFIRM_STATUS_COLORS[status] || CONFIRM_STATUS_COLORS.pending;
    return (
      <Badge className={colorClass}>
        {CONFIRM_STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  // 提交申请
  const handleSubmit = async () => {
    if (!application) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/support/partner-applications/${applicationId}`, {
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

  // 计算费用合计
  const calculateTotalFees = () => {
    if (!application?.fees) return '0';
    return application.fees.reduce((sum, fee) => {
      const amount = parseFloat(fee.actualAmount) || 0;
      return sum + amount;
    }, 0).toFixed(2);
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
        <Button variant="ghost" onClick={() => router.push('/support/partner-applications')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || '友司支持申请不存在'}</AlertDescription>
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
          <Button variant="ghost" onClick={() => router.push('/support/partner-applications')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/support" className="hover:text-foreground">投标支持</Link>
              <span>/</span>
              <Link href="/support/partner-applications" className="hover:text-foreground">友司支持</Link>
              <span>/</span>
              <span className="text-foreground">{application.applicationNo}</span>
            </div>
            <h1 className="text-2xl font-bold">{application.projectName || '友司支持申请详情'}</h1>
            <p className="text-muted-foreground">申请编号: {application.applicationNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(application.status)}
          {canEdit && (
            <Button variant="outline" onClick={() => router.push(`/support/partner-applications/${applicationId}/edit`)}>
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
            <CardTitle className="text-sm font-medium">友司名称</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{application.partnerCompanyName}</div>
            <p className="text-xs text-muted-foreground">{application.partnerContactPerson || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">友司确认状态</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div>{getConfirmStatusBadge(application.partnerConfirmStatus)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {application.partnerConfirmedAt ? `确认时间: ${formatDate(application.partnerConfirmedAt)}` : ''}
            </p>
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
      </div>

      {/* 详细信息标签页 */}
      <Tabs defaultValue="partner" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partner">友司信息</TabsTrigger>
          <TabsTrigger value="materials">投标材料</TabsTrigger>
          <TabsTrigger value="fees">费用明细</TabsTrigger>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="todos">待办事项</TabsTrigger>
        </TabsList>

        {/* 友司信息 */}
        <TabsContent value="partner">
          <Card>
            <CardHeader>
              <CardTitle>友司基础信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">友司联系信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">友司名称</p>
                    <p className="font-medium">{application.partnerCompanyName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">联系人</p>
                    <p>{application.partnerContactPerson || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">联系电话</p>
                    <p>{application.partnerContactPhone || '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">法定代表人信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">法定代表人姓名</p>
                    <p>{application.legalRepName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">身份证复印件</p>
                    <p>{application.legalRepIdCardProvided ? '已提供' : '未提供'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">提交方式</p>
                    <p>{application.legalRepIdCardType === 'electronic' ? '电子档' : application.legalRepIdCardType === 'paper' ? '纸质档' : application.legalRepIdCardType === 'both' ? '两者都有' : '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">投标代理人信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">投标代理人姓名</p>
                    <p>{application.bidAgentName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">身份证复印件</p>
                    <p>{application.bidAgentIdCardProvided ? '已提供' : '未提供'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">联系电话</p>
                    <p>{application.bidAgentPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">微信</p>
                    <p>{application.bidAgentWechat || '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">友司对接人信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">对接人姓名</p>
                    <p>{application.partnerLiaisonName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">联系电话</p>
                    <p>{application.partnerLiaisonPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">微信</p>
                    <p>{application.partnerLiaisonWechat || '-'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 投标材料 */}
        <TabsContent value="materials">
          <Card>
            <CardHeader>
              <CardTitle>友司需提供的投标资质及相关材料</CardTitle>
              <CardDescription>共 {application.materials.length} 项材料</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>材料类别</TableHead>
                    <TableHead>具体材料名称</TableHead>
                    <TableHead>是否提供</TableHead>
                    <TableHead>提交方式</TableHead>
                    <TableHead>材料备注</TableHead>
                    <TableHead>确认状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {application.materials.map((material: any) => (
                    <TableRow key={material.id}>
                      <TableCell>{MATERIAL_CATEGORY_LABELS[material.category] || material.category}</TableCell>
                      <TableCell className="font-medium">{material.materialName}</TableCell>
                      <TableCell>
                        <Badge variant={material.isProvided ? 'default' : 'secondary'}>
                          {material.isProvided ? '已提供' : '未提供'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {material.submitType === 'electronic' ? '电子档' : 
                         material.submitType === 'paper' ? '纸质档' : 
                         material.submitType === 'both' ? '两者都有' : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{material.notes || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={material.isConfirmed ? 'default' : 'outline'}>
                          {material.isConfirmed ? '已确认' : '待确认'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 费用明细 */}
        <TabsContent value="fees">
          <Card>
            <CardHeader>
              <CardTitle>友司支持费用明细</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>费用项目</TableHead>
                    <TableHead>默认费用标准</TableHead>
                    <TableHead>实际费用金额（元）</TableHead>
                    <TableHead>费用说明</TableHead>
                    <TableHead>支付状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {application.fees.map((fee: any) => (
                    <TableRow key={fee.id}>
                      <TableCell className="font-medium">{fee.feeName}</TableCell>
                      <TableCell className="text-muted-foreground">{fee.defaultAmount || '-'}</TableCell>
                      <TableCell className="font-bold">{fee.actualAmount}</TableCell>
                      <TableCell className="text-muted-foreground">{fee.notes || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={fee.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                          {fee.paymentStatus === 'paid' ? '已支付' : '未支付'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-bold">费用合计</TableCell>
                    <TableCell className="font-bold text-lg">{calculateTotalFees()} 元</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
                    <p>{formatDate(application.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">申请状态</p>
                    <p>{getStatusBadge(application.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">短信提醒</p>
                    <p>{application.smsReminderEnabled ? '已设置' : '未设置'}</p>
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
                {application.biddingRequirements && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">投标相关要求</p>
                    <p className="text-sm whitespace-pre-wrap">{application.biddingRequirements}</p>
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

              <Separator />

              {/* 材料接收信息 */}
              <div>
                <h4 className="font-medium mb-3">材料接收详情</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">材料接收人</p>
                    <p>{application.materialReceiverName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">接收人电话</p>
                    <p>{application.materialReceiverPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">电子档接收地址</p>
                    <p>{application.electronicReceiveAddress || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">纸质材料接收地址</p>
                    <p>{application.paperReceiveAddress || '-'}</p>
                  </div>
                </div>
                {application.materialAcceptanceNotes && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">材料验收情况</p>
                    <p className="text-sm">{application.materialAcceptanceNotes}</p>
                  </div>
                )}
              </div>

              {application.applicationSummary && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">申请总结</h4>
                    <p className="text-sm whitespace-pre-wrap">{application.applicationSummary}</p>
                  </div>
                </>
              )}

              {application.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">补充说明</h4>
                    <p className="text-sm whitespace-pre-wrap">{application.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 待办事项 */}
        <TabsContent value="todos">
          <Card>
            <CardHeader>
              <CardTitle>待办事宜追踪</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>待办事项</TableHead>
                    <TableHead>责任人</TableHead>
                    <TableHead>截止时间</TableHead>
                    <TableHead>事项进度</TableHead>
                    <TableHead>进度说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {application.todos.map((todo: any) => (
                    <TableRow key={todo.id}>
                      <TableCell className="font-medium">{todo.title}</TableCell>
                      <TableCell>{todo.assigneeName}</TableCell>
                      <TableCell>{formatDate(todo.deadline)}</TableCell>
                      <TableCell>
                        <Badge variant={
                          todo.status === 'completed' ? 'default' :
                          todo.status === 'overdue' ? 'destructive' :
                          todo.status === 'in_progress' ? 'secondary' : 'outline'
                        }>
                          {todo.status === 'not_started' ? '未开始' :
                           todo.status === 'in_progress' ? '进行中' :
                           todo.status === 'completed' ? '已完成' :
                           todo.status === 'overdue' ? '逾期' : todo.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{todo.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

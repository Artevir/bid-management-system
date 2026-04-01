'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  DollarSign,
  Calendar as _Calendar,
  Building2,
  FileText as _FileText,
  ArrowUpRight,
  ArrowDownLeft,
  Clock as _Clock,
  CheckCircle as _CheckCircle,
  XCircle as _XCircle,
  RefreshCw,
  CreditCard,
  Banknote as _Banknote,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/error-message';

const GUARANTEE_TYPES: Record<string, string> = {
  cash: '现金',
  bank_guarantee: '银行保函',
  check: '支票',
  other: '其他',
};

const GUARANTEE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待缴纳', color: 'yellow' },
  paid: { label: '已缴纳', color: 'blue' },
  returned: { label: '已退还', color: 'green' },
  forfeited: { label: '已没收', color: 'red' },
};

interface Guarantee {
  id: number;
  projectId: number;
  amount: string;
  currency: string;
  type: string;
  guaranteeNumber: string | null;
  issuingBank: string | null;
  guaranteeValidFrom: string | null;
  guaranteeValidTo: string | null;
  guaranteeFile: string | null;
  paymentDate: string | null;
  paymentVoucher: string | null;
  paymentMethod: string | null;
  returnDate: string | null;
  returnAmount: string | null;
  returnVoucher: string | null;
  returnReason: string | null;
  status: string;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: number;
  name: string;
  code: string;
}

export default function GuaranteeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [guarantee, setGuarantee] = useState<Guarantee | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 缴纳/退还对话框
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [payFormData, setPayFormData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentVoucher: '',
    paymentMethod: 'bank_transfer',
  });

  const [returnFormData, setReturnFormData] = useState({
    returnDate: new Date().toISOString().split('T')[0],
    returnAmount: '',
    returnVoucher: '',
    returnReason: '',
  });

  useEffect(() => {
    if (params.id) {
      fetchGuarantee();
    }
  }, [params.id]);

  const fetchGuarantee = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/guarantees/${params.id}`);
      if (!res.ok) {
        throw new Error('获取保证金详情失败');
      }
      const data = await res.json();
      setGuarantee(data);

      // 获取关联项目信息
      if (data.projectId) {
        const projectRes = await fetch(`/api/projects/${data.projectId}`);
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          setProject(projectData);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取保证金详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!guarantee) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/guarantees/${guarantee.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payFormData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '标记缴纳失败'));
      }

      setPayDialogOpen(false);
      fetchGuarantee();
    } catch (err) {
      setError(err instanceof Error ? err.message : '标记缴纳失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!guarantee) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/guarantees/${guarantee.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnFormData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, '标记退还失败'));
      }

      setReturnDialogOpen(false);
      fetchGuarantee();
    } catch (err) {
      setError(err instanceof Error ? err.message : '标记退还失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = GUARANTEE_STATUS[status];
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={colorMap[statusInfo?.color || 'yellow']}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!guarantee) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>保证金记录不存在</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/guarantees')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <div className="flex gap-2">
          {guarantee.status === 'pending' && (
            <Button onClick={() => setPayDialogOpen(true)}>
              <ArrowUpRight className="mr-2 h-4 w-4" />
              确认缴纳
            </Button>
          )}
          {guarantee.status === 'paid' && (
            <Button onClick={() => setReturnDialogOpen(true)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              确认退还
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{String(error)}</AlertDescription>
        </Alert>
      )}

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                保证金详情
              </CardTitle>
              <CardDescription>保证金ID: {guarantee.id}</CardDescription>
            </div>
            {getStatusBadge(guarantee.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 金额信息 */}
          <div className="bg-muted p-6 rounded-lg">
            <div className="text-sm text-muted-foreground mb-2">保证金金额</div>
            <div className="text-4xl font-bold text-primary">
              {formatCurrency(parseFloat(guarantee.amount))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-muted-foreground">保证金类型</div>
              <div className="font-medium">{GUARANTEE_TYPES[guarantee.type] || guarantee.type}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">币种</div>
              <div className="font-medium">{guarantee.currency}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">创建时间</div>
              <div className="font-medium">{formatDate(guarantee.createdAt)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">更新时间</div>
              <div className="font-medium">{formatDate(guarantee.updatedAt)}</div>
            </div>
          </div>

          <Separator />

          {/* 关联项目 */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              关联项目
            </h3>
            {project ? (
              <div className="bg-muted p-4 rounded-lg">
                <div className="font-medium">{project.name}</div>
                <div className="text-sm text-muted-foreground">项目编码: {project.code}</div>
                <Button
                  variant="link"
                  className="p-0 h-auto mt-2"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  查看项目详情
                </Button>
              </div>
            ) : (
              <div className="text-muted-foreground">未关联项目</div>
            )}
          </div>

          {/* 保函信息 */}
          {guarantee.type === 'bank_guarantee' && (
            <>
              <Separator />
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  保函信息
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">保函编号</div>
                    <div className="font-medium">{guarantee.guaranteeNumber || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">开证银行</div>
                    <div className="font-medium">{guarantee.issuingBank || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">有效期起</div>
                    <div className="font-medium">
                      {guarantee.guaranteeValidFrom ? formatDate(guarantee.guaranteeValidFrom) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">有效期止</div>
                    <div className="font-medium">
                      {guarantee.guaranteeValidTo ? formatDate(guarantee.guaranteeValidTo) : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 缴纳信息 */}
          {guarantee.status !== 'pending' && (
            <>
              <Separator />
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  缴纳信息
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">缴纳日期</div>
                    <div className="font-medium">
                      {guarantee.paymentDate ? formatDate(guarantee.paymentDate) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">缴纳方式</div>
                    <div className="font-medium">{guarantee.paymentMethod || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">缴费凭证</div>
                    <div className="font-medium">{guarantee.paymentVoucher || '-'}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 退还信息 */}
          {(guarantee.status === 'returned' || guarantee.status === 'forfeited') && (
            <>
              <Separator />
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4" />
                  退还信息
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">退还日期</div>
                    <div className="font-medium">
                      {guarantee.returnDate ? formatDate(guarantee.returnDate) : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">退还金额</div>
                    <div className="font-medium">
                      {guarantee.returnAmount
                        ? formatCurrency(parseFloat(guarantee.returnAmount))
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">退还凭证</div>
                    <div className="font-medium">{guarantee.returnVoucher || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">退还原因</div>
                    <div className="font-medium">{guarantee.returnReason || '-'}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 备注 */}
          {guarantee.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-medium mb-3">备注</h3>
                <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap">
                  {guarantee.notes}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 缴纳对话框 */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认缴纳</DialogTitle>
            <DialogDescription>标记保证金为已缴纳状态</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">保证金金额</div>
              <div className="text-xl font-bold">
                {formatCurrency(parseFloat(guarantee.amount))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">缴纳日期</Label>
              <Input
                id="paymentDate"
                type="date"
                value={payFormData.paymentDate}
                onChange={(e) => setPayFormData({ ...payFormData, paymentDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">缴纳方式</Label>
              <Select
                value={payFormData.paymentMethod}
                onValueChange={(value) => setPayFormData({ ...payFormData, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">银行转账</SelectItem>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentVoucher">缴费凭证</Label>
              <Input
                id="paymentVoucher"
                value={payFormData.paymentVoucher}
                onChange={(e) => setPayFormData({ ...payFormData, paymentVoucher: e.target.value })}
                placeholder="凭证编号或链接"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handlePay} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认缴纳
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 退还对话框 */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认退还</DialogTitle>
            <DialogDescription>标记保证金为已退还状态</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">保证金金额</div>
              <div className="text-xl font-bold">
                {formatCurrency(parseFloat(guarantee.amount))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnDate">退还日期</Label>
              <Input
                id="returnDate"
                type="date"
                value={returnFormData.returnDate}
                onChange={(e) => setReturnFormData({ ...returnFormData, returnDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnAmount">退还金额</Label>
              <Input
                id="returnAmount"
                type="number"
                value={returnFormData.returnAmount}
                onChange={(e) => setReturnFormData({ ...returnFormData, returnAmount: e.target.value })}
                placeholder="默认全额退还"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnVoucher">退还凭证</Label>
              <Input
                id="returnVoucher"
                value={returnFormData.returnVoucher}
                onChange={(e) => setReturnFormData({ ...returnFormData, returnVoucher: e.target.value })}
                placeholder="凭证编号或链接"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnReason">退还原因</Label>
              <Textarea
                id="returnReason"
                value={returnFormData.returnReason}
                onChange={(e) => setReturnFormData({ ...returnFormData, returnReason: e.target.value })}
                placeholder="请输入退还原因"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleReturn} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认退还
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * 交付记录组件
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Truck, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/lib/error-message';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Delivery {
  id: number;
  materialTypes: string;
  deliveryMethod: string;
  shippingMethod: string | null;
  trackingNumber: string | null;
  customShippingMethod: string | null;
  deliveredAt: string | null;
  receiverName: string | null;
  receiverSignature: string | null;
  receivedAt: string | null;
  trackingRecordGenerated: boolean;
  trackingRecordNo: string | null;
  createdAt: string;
}

interface ApplicationDeliveriesProps {
  applicationId: number;
  deliveries: Delivery[];
  canEdit: boolean;
  onUpdate: () => void;
}

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  upload: '线上上传',
  offline: '线下提交',
  mixed: '混合交付',
};

const SHIPPING_METHOD_LABELS: Record<string, string> = {
  express: '快递',
  courier: '同城人工送达',
  flash: '闪送',
  other: '其他',
};

export function ApplicationDeliveries({
  applicationId,
  deliveries,
  canEdit,
  onUpdate,
}: ApplicationDeliveriesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    materialTypes: [] as string[],
    deliveryMethod: 'upload' as 'upload' | 'offline' | 'mixed',
    shippingMethod: '',
    trackingNumber: '',
    customShippingMethod: '',
  });

  const handleSubmit = async () => {
    if (formData.materialTypes.length === 0) {
      toast.error('请选择交付材料类型');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/preparation/authorizations/${applicationId}/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(extractErrorMessage(data, '创建失败'));
      }

      toast.success('交付记录已创建');
      setDialogOpen(false);
      setFormData({
        materialTypes: [],
        deliveryMethod: 'upload',
        shippingMethod: '',
        trackingNumber: '',
        customShippingMethod: '',
      });
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleMaterialType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      materialTypes: prev.materialTypes.includes(type)
        ? prev.materialTypes.filter(t => t !== type)
        : [...prev.materialTypes, type],
    }));
  };

  const parseMaterialTypes = (typesStr: string): string[] => {
    try {
      return JSON.parse(typesStr);
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>材料交付记录</CardTitle>
              <CardDescription>记录授权材料的交付情况和追溯记录</CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加交付记录
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="mx-auto h-12 w-12 mb-4" />
              <p>暂无交付记录</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>交付材料类型</TableHead>
                  <TableHead>交付方式</TableHead>
                  <TableHead>送达方式</TableHead>
                  <TableHead>快递单号</TableHead>
                  <TableHead>送达时间</TableHead>
                  <TableHead>接收人</TableHead>
                  <TableHead>追溯记录</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {parseMaterialTypes(delivery.materialTypes).map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {DELIVERY_METHOD_LABELS[delivery.deliveryMethod] || delivery.deliveryMethod}
                    </TableCell>
                    <TableCell>
                      {delivery.shippingMethod
                        ? SHIPPING_METHOD_LABELS[delivery.shippingMethod] || delivery.customShippingMethod
                        : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {delivery.trackingNumber || '-'}
                    </TableCell>
                    <TableCell>
                      {delivery.deliveredAt
                        ? format(new Date(delivery.deliveredAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {delivery.receiverName ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>{delivery.receiverName}</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {delivery.trackingRecordGenerated ? (
                        <Badge variant="secondary" className="text-xs">
                          已生成
                        </Badge>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 添加交付记录对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>添加交付记录</DialogTitle>
            <DialogDescription>记录材料交付情况</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>交付材料类型 *</Label>
              <div className="flex flex-wrap gap-2">
                {['全部纸质材料', '全部电子档材料', '部分纸质+部分电子档'].map((type) => (
                  <Button
                    key={type}
                    variant={formData.materialTypes.includes(type) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleMaterialType(type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>交付方式 *</Label>
              <Select
                value={formData.deliveryMethod}
                onValueChange={(v) => setFormData({ ...formData, deliveryMethod: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload">线上上传</SelectItem>
                  <SelectItem value="offline">线下提交</SelectItem>
                  <SelectItem value="mixed">混合交付</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.deliveryMethod !== 'upload' && (
              <>
                <div className="space-y-2">
                  <Label>送达方式</Label>
                  <Select
                    value={formData.shippingMethod}
                    onValueChange={(v) => setFormData({ ...formData, shippingMethod: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择送达方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="express">快递</SelectItem>
                      <SelectItem value="courier">同城人工送达</SelectItem>
                      <SelectItem value="flash">闪送</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.shippingMethod === 'express' || formData.shippingMethod === 'flash') && (
                  <div className="space-y-2">
                    <Label>快递单号</Label>
                    <Input
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      placeholder="输入快递单号"
                    />
                  </div>
                )}

                {formData.shippingMethod === 'other' && (
                  <div className="space-y-2">
                    <Label>送达方式说明</Label>
                    <Input
                      value={formData.customShippingMethod}
                      onChange={(e) => setFormData({ ...formData, customShippingMethod: e.target.value })}
                      placeholder="说明送达方式"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

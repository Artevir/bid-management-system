/**
 * 厂家配置组件
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2, Building2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/lib/error-message';

interface Manufacturer {
  id: number;
  type: string;
  companyId: number | null;
  manufacturerName: string;
  manufacturerAddress: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  productName: string | null;
  productConfig: string | null;
  deviationType: string;
  deviationNotes: string | null;
  sortOrder: number;
  qualifications: any[];
  supportingDoc: any;
}

interface ApplicationManufacturersProps {
  applicationId: number;
  manufacturers: Manufacturer[];
  canEdit: boolean;
  onUpdate: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  main: '主投',
  partner: '陪标',
};

const TYPE_COLORS: Record<string, string> = {
  main: 'bg-blue-100 text-blue-800',
  partner: 'bg-gray-100 text-gray-800',
};

const DEVIATION_LABELS: Record<string, string> = {
  none: '无偏离',
  positive: '正偏离',
  negative: '负偏离',
};

export function ApplicationManufacturers({
  applicationId,
  manufacturers,
  canEdit,
  onUpdate,
}: ApplicationManufacturersProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'partner' as 'main' | 'partner',
    manufacturerName: '',
    manufacturerAddress: '',
    contactPerson: '',
    contactPhone: '',
    productName: '',
    productConfig: '',
    deviationType: 'none' as 'none' | 'positive' | 'negative',
    deviationNotes: '',
  });

  const handleOpenDialog = (manufacturer?: Manufacturer) => {
    if (manufacturer) {
      setEditingManufacturer(manufacturer);
      setFormData({
        type: manufacturer.type as 'main' | 'partner',
        manufacturerName: manufacturer.manufacturerName,
        manufacturerAddress: manufacturer.manufacturerAddress || '',
        contactPerson: manufacturer.contactPerson || '',
        contactPhone: manufacturer.contactPhone || '',
        productName: manufacturer.productName || '',
        productConfig: manufacturer.productConfig || '',
        deviationType: manufacturer.deviationType as 'none' | 'positive' | 'negative',
        deviationNotes: manufacturer.deviationNotes || '',
      });
    } else {
      setEditingManufacturer(null);
      setFormData({
        type: 'partner',
        manufacturerName: '',
        manufacturerAddress: '',
        contactPerson: '',
        contactPhone: '',
        productName: '',
        productConfig: '',
        deviationType: 'none',
        deviationNotes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.manufacturerName.trim()) {
      toast.error('请输入厂家名称');
      return;
    }

    setLoading(true);
    try {
      const url = editingManufacturer
        ? `/api/preparation/authorizations/${applicationId}/manufacturers/${editingManufacturer.id}`
        : `/api/preparation/authorizations/${applicationId}/manufacturers`;
      
      const method = editingManufacturer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(extractErrorMessage(data, '操作失败'));
      }

      toast.success(editingManufacturer ? '厂家已更新' : '厂家已添加');
      setDialogOpen(false);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该厂家吗？相关的资质材料和配套材料也会被删除。')) return;

    try {
      const res = await fetch(`/api/preparation/authorizations/${applicationId}/manufacturers/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(extractErrorMessage(data, '删除失败'));
      }

      toast.success('厂家已删除');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 检查主投厂家数量
  const mainCount = manufacturers.filter(m => m.type === 'main').length;
  const mainCountWarning = mainCount > 1 ? '主投厂家仅能选择1家' : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>授权厂家及产品配置</CardTitle>
              <CardDescription>
                支持添加3-5家厂家（主投+陪标），主投产品配置可高于招标参数
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                添加厂家
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {mainCountWarning && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
              ⚠️ {mainCountWarning}
            </div>
          )}

          {manufacturers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4" />
              <p>暂无厂家配置</p>
              {canEdit && (
                <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加第一个厂家
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>厂家名称</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>配置偏离</TableHead>
                  <TableHead>资质材料</TableHead>
                  <TableHead className="w-16">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manufacturers.map((mfr) => (
                  <TableRow key={mfr.id}>
                    <TableCell>
                      <Badge className={TYPE_COLORS[mfr.type] || TYPE_COLORS.partner}>
                        {TYPE_LABELS[mfr.type] || mfr.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{mfr.manufacturerName}</div>
                      {mfr.manufacturerAddress && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {mfr.manufacturerAddress}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{mfr.productName || '-'}</TableCell>
                    <TableCell>
                      {mfr.contactPerson && (
                        <div>
                          <p>{mfr.contactPerson}</p>
                          {mfr.contactPhone && (
                            <p className="text-xs text-muted-foreground">{mfr.contactPhone}</p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {DEVIATION_LABELS[mfr.deviationType] || mfr.deviationType}
                      </Badge>
                      {mfr.deviationNotes && (
                        <p className="text-xs text-muted-foreground mt-1">{mfr.deviationNotes}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{mfr.qualifications?.length || 0} 项</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(mfr)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDelete(mfr.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {manufacturers.length > 0 && manufacturers.length < 3 && (
            <div className="mt-4 text-sm text-yellow-600">
              ⚠️ 最少需要添加3家厂家
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加/编辑厂家对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingManufacturer ? '编辑厂家' : '添加厂家'}</DialogTitle>
            <DialogDescription>
              {editingManufacturer ? '修改厂家信息' : '添加新的授权厂家'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型 *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as 'main' | 'partner' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">主投</SelectItem>
                    <SelectItem value="partner">陪标</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>厂家名称 *</Label>
                <Input
                  value={formData.manufacturerName}
                  onChange={(e) => setFormData({ ...formData, manufacturerName: e.target.value })}
                  placeholder="输入厂家名称"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>联系人</Label>
                <Input
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="联系人姓名"
                />
              </div>
              <div className="space-y-2">
                <Label>联系电话</Label>
                <Input
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="联系电话"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>厂家地址</Label>
              <Input
                value={formData.manufacturerAddress}
                onChange={(e) => setFormData({ ...formData, manufacturerAddress: e.target.value })}
                placeholder="厂家地址"
              />
            </div>

            <div className="space-y-2">
              <Label>授权产品名称</Label>
              <Input
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                placeholder="授权产品名称"
              />
            </div>

            <div className="space-y-2">
              <Label>产品配置参数</Label>
              <Textarea
                value={formData.productConfig}
                onChange={(e) => setFormData({ ...formData, productConfig: e.target.value })}
                placeholder="可粘贴参数或上传参数表"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>配置偏离说明</Label>
                <Select
                  value={formData.deviationType}
                  onValueChange={(v) => setFormData({ ...formData, deviationType: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无偏离</SelectItem>
                    <SelectItem value="positive">正偏离（主投可高于）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>偏离备注</Label>
                <Input
                  value={formData.deviationNotes}
                  onChange={(e) => setFormData({ ...formData, deviationNotes: e.target.value })}
                  placeholder="偏离说明"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingManufacturer ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

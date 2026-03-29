/**
 * 友司支持申请创建页面
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator as _Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

// 默认材料模板
const DEFAULT_MATERIALS = [
  { category: 'basic', materialName: '营业执照副本', isProvided: false, submitType: 'electronic' },
  { category: 'basic', materialName: '组织机构代码证', isProvided: false, submitType: 'electronic' },
  { category: 'basic', materialName: '税务登记证', isProvided: false, submitType: 'electronic' },
  { category: 'qualification', materialName: '资质证书', isProvided: false, submitType: 'electronic' },
  { category: 'qualification', materialName: '安全生产许可证', isProvided: false, submitType: 'electronic' },
  { category: 'performance', materialName: '类似项目业绩证明', isProvided: false, submitType: 'electronic' },
  { category: 'personnel', materialName: '法定代表人身份证复印件', isProvided: false, submitType: 'electronic' },
  { category: 'personnel', materialName: '投标代理人身份证复印件', isProvided: false, submitType: 'electronic' },
  { category: 'personnel', materialName: '授权委托书', isProvided: false, submitType: 'paper' },
];

// 默认费用模板
const DEFAULT_FEES = [
  { feeType: 'base', feeName: '基础支持费用', defaultAmount: '5000', actualAmount: '5000' },
  { feeType: 'agent', feeName: '投标代理费用', defaultAmount: '3000', actualAmount: '3000' },
  { feeType: 'accommodation', feeName: '差旅住宿费用', defaultAmount: '按实际发生', actualAmount: '0' },
  { feeType: 'other', feeName: '其他费用', defaultAmount: '按实际发生', actualAmount: '0' },
];

const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  basic: '基础资质材料',
  qualification: '资质材料',
  performance: '业绩材料',
  personnel: '人员相关材料',
  other: '其他材料',
};

export default function CreatePartnerApplicationPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 表单数据
  const [formData, setFormData] = useState({
    // 项目信息
    projectName: '',
    projectCode: '',
    tenderOrganization: '',
    submissionDeadline: '',
    biddingRequirements: '',
    interpretationFileId: '',
    
    // 经办人信息
    handlerName: '',
    handlerPhone: '',
    materialDeadline: '',
    smsReminderEnabled: false,
    
    // 友司基础信息
    partnerCompanyName: '',
    partnerContactPerson: '',
    partnerContactPhone: '',
    
    // 法定代表人信息
    legalRepName: '',
    legalRepIdCardProvided: false,
    legalRepIdCardType: 'electronic',
    
    // 投标代理人信息
    bidAgentName: '',
    bidAgentIdCardProvided: false,
    bidAgentIdCardType: 'electronic',
    bidAgentPhone: '',
    bidAgentWechat: '',
    
    // 友司对接人信息
    partnerLiaisonName: '',
    partnerLiaisonPhone: '',
    partnerLiaisonWechat: '',
    
    // 材料接收信息
    materialReceiverName: '',
    materialReceiverPhone: '',
    electronicReceiveAddress: '',
    paperReceiveAddress: '',
    
    // 补充说明
    notes: '',
  });

  // 材料清单
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS.map(m => ({ ...m, id: Date.now() + Math.random() })));

  // 费用明细
  const [fees, setFees] = useState(DEFAULT_FEES.map(f => ({ ...f, id: Date.now() + Math.random() })));

  // 待办事项
  const [todos, setTodos] = useState<{ id: number; title: string; assigneeName: string; deadline: string; type: string }[]>([]);

  // 更新表单字段
  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 添加材料
  const addMaterial = () => {
    setMaterials(prev => [...prev, {
      id: Date.now(),
      category: 'other',
      materialName: '',
      isProvided: false,
      submitType: 'electronic',
    }]);
  };

  // 更新材料
  const updateMaterial = (id: number, field: string, value: any) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // 删除材料
  const removeMaterial = (id: number) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  // 添加费用
  const addFee = () => {
    setFees(prev => [...prev, {
      id: Date.now(),
      feeType: 'other',
      feeName: '',
      defaultAmount: '',
      actualAmount: '0',
    }]);
  };

  // 更新费用
  const updateFee = (id: number, field: string, value: any) => {
    setFees(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  // 删除费用
  const removeFee = (id: number) => {
    setFees(prev => prev.filter(f => f.id !== id));
  };

  // 添加待办
  const addTodo = () => {
    setTodos(prev => [...prev, {
      id: Date.now(),
      title: '',
      assigneeName: '',
      deadline: '',
      type: 'confirm',
    }]);
  };

  // 更新待办
  const updateTodo = (id: number, field: string, value: any) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // 删除待办
  const removeTodo = (id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  // 提交表单
  const handleSubmit = async () => {
    // 验证必填字段
    if (!formData.partnerCompanyName) {
      setError('请填写友司名称');
      return;
    }
    if (!formData.handlerName) {
      setError('请填写经办人姓名');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/support/partner-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          materials: materials.map(({ _id, ...m }) => m),
          fees: fees.map(({ _id, ...f }) => f),
          todos: todos.map(({ _id, ...t }) => t),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '创建失败');
      }

      const application = await response.json();
      toast.success('友司支持申请创建成功');
      router.push(`/support/partner-applications/${application.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
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
            <span className="text-foreground">新建申请</span>
          </div>
          <h1 className="text-2xl font-bold">新建友司支持申请</h1>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 表单内容 */}
      <div className="space-y-6">
        {/* 项目信息 */}
        <Card>
          <CardHeader>
            <CardTitle>项目信息</CardTitle>
            <CardDescription>关联招标项目的基本信息（可选）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>项目名称</Label>
                <Input
                  value={formData.projectName}
                  onChange={(e) => updateField('projectName', e.target.value)}
                  placeholder="请输入项目名称"
                />
              </div>
              <div className="space-y-2">
                <Label>项目编号</Label>
                <Input
                  value={formData.projectCode}
                  onChange={(e) => updateField('projectCode', e.target.value)}
                  placeholder="请输入项目编号"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>招标单位</Label>
                <Input
                  value={formData.tenderOrganization}
                  onChange={(e) => updateField('tenderOrganization', e.target.value)}
                  placeholder="请输入招标单位"
                />
              </div>
              <div className="space-y-2">
                <Label>投标截止日期</Label>
                <Input
                  type="date"
                  value={formData.submissionDeadline}
                  onChange={(e) => updateField('submissionDeadline', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>投标相关要求</Label>
              <Textarea
                value={formData.biddingRequirements}
                onChange={(e) => updateField('biddingRequirements', e.target.value)}
                placeholder="请输入投标相关要求"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* 经办人信息 */}
        <Card>
          <CardHeader>
            <CardTitle>经办人信息 <span className="text-destructive">*</span></CardTitle>
            <CardDescription>负责本申请的经办人信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>经办人姓名 *</Label>
                <Input
                  value={formData.handlerName}
                  onChange={(e) => updateField('handlerName', e.target.value)}
                  placeholder="请输入经办人姓名"
                />
              </div>
              <div className="space-y-2">
                <Label>联系电话</Label>
                <Input
                  value={formData.handlerPhone}
                  onChange={(e) => updateField('handlerPhone', e.target.value)}
                  placeholder="请输入联系电话"
                />
              </div>
              <div className="space-y-2">
                <Label>材料最迟送达时间</Label>
                <Input
                  type="date"
                  value={formData.materialDeadline}
                  onChange={(e) => updateField('materialDeadline', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 友司基础信息 */}
        <Card>
          <CardHeader>
            <CardTitle>友司基础信息 <span className="text-destructive">*</span></CardTitle>
            <CardDescription>需要支持的友司基本信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>友司名称 *</Label>
                <Input
                  value={formData.partnerCompanyName}
                  onChange={(e) => updateField('partnerCompanyName', e.target.value)}
                  placeholder="请输入友司名称"
                />
              </div>
              <div className="space-y-2">
                <Label>联系人</Label>
                <Input
                  value={formData.partnerContactPerson}
                  onChange={(e) => updateField('partnerContactPerson', e.target.value)}
                  placeholder="请输入联系人"
                />
              </div>
              <div className="space-y-2">
                <Label>联系电话</Label>
                <Input
                  value={formData.partnerContactPhone}
                  onChange={(e) => updateField('partnerContactPhone', e.target.value)}
                  placeholder="请输入联系电话"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 法定代表人信息 */}
        <Card>
          <CardHeader>
            <CardTitle>法定代表人信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>法定代表人姓名</Label>
                <Input
                  value={formData.legalRepName}
                  onChange={(e) => updateField('legalRepName', e.target.value)}
                  placeholder="请输入法定代表人姓名"
                />
              </div>
              <div className="space-y-2">
                <Label>身份证复印件</Label>
                <Select
                  value={formData.legalRepIdCardProvided ? 'true' : 'false'}
                  onValueChange={(v) => updateField('legalRepIdCardProvided', v === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">未提供</SelectItem>
                    <SelectItem value="true">已提供</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>提交方式</Label>
                <Select
                  value={formData.legalRepIdCardType}
                  onValueChange={(v) => updateField('legalRepIdCardType', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electronic">电子档</SelectItem>
                    <SelectItem value="paper">纸质档</SelectItem>
                    <SelectItem value="both">两者都有</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 投标代理人信息 */}
        <Card>
          <CardHeader>
            <CardTitle>投标代理人信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>投标代理人姓名</Label>
                <Input
                  value={formData.bidAgentName}
                  onChange={(e) => updateField('bidAgentName', e.target.value)}
                  placeholder="请输入投标代理人姓名"
                />
              </div>
              <div className="space-y-2">
                <Label>身份证复印件</Label>
                <Select
                  value={formData.bidAgentIdCardProvided ? 'true' : 'false'}
                  onValueChange={(v) => updateField('bidAgentIdCardProvided', v === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">未提供</SelectItem>
                    <SelectItem value="true">已提供</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>提交方式</Label>
                <Select
                  value={formData.bidAgentIdCardType}
                  onValueChange={(v) => updateField('bidAgentIdCardType', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electronic">电子档</SelectItem>
                    <SelectItem value="paper">纸质档</SelectItem>
                    <SelectItem value="both">两者都有</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>联系电话</Label>
                <Input
                  value={formData.bidAgentPhone}
                  onChange={(e) => updateField('bidAgentPhone', e.target.value)}
                  placeholder="请输入联系电话"
                />
              </div>
              <div className="space-y-2">
                <Label>微信</Label>
                <Input
                  value={formData.bidAgentWechat}
                  onChange={(e) => updateField('bidAgentWechat', e.target.value)}
                  placeholder="请输入微信号"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 友司对接人信息 */}
        <Card>
          <CardHeader>
            <CardTitle>友司对接人信息</CardTitle>
            <CardDescription>友司负责本项目的对接人员</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>对接人姓名</Label>
                <Input
                  value={formData.partnerLiaisonName}
                  onChange={(e) => updateField('partnerLiaisonName', e.target.value)}
                  placeholder="请输入对接人姓名"
                />
              </div>
              <div className="space-y-2">
                <Label>联系电话</Label>
                <Input
                  value={formData.partnerLiaisonPhone}
                  onChange={(e) => updateField('partnerLiaisonPhone', e.target.value)}
                  placeholder="请输入联系电话"
                />
              </div>
              <div className="space-y-2">
                <Label>微信</Label>
                <Input
                  value={formData.partnerLiaisonWechat}
                  onChange={(e) => updateField('partnerLiaisonWechat', e.target.value)}
                  placeholder="请输入微信号"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 材料接收信息 */}
        <Card>
          <CardHeader>
            <CardTitle>材料接收信息</CardTitle>
            <CardDescription>友司提供的材料接收方式和地址</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>材料接收人</Label>
                <Input
                  value={formData.materialReceiverName}
                  onChange={(e) => updateField('materialReceiverName', e.target.value)}
                  placeholder="请输入材料接收人姓名"
                />
              </div>
              <div className="space-y-2">
                <Label>接收人电话</Label>
                <Input
                  value={formData.materialReceiverPhone}
                  onChange={(e) => updateField('materialReceiverPhone', e.target.value)}
                  placeholder="请输入接收人电话"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>电子档接收地址</Label>
                <Input
                  value={formData.electronicReceiveAddress}
                  onChange={(e) => updateField('electronicReceiveAddress', e.target.value)}
                  placeholder="如：邮箱地址或网盘链接"
                />
              </div>
              <div className="space-y-2">
                <Label>纸质材料接收地址</Label>
                <Input
                  value={formData.paperReceiveAddress}
                  onChange={(e) => updateField('paperReceiveAddress', e.target.value)}
                  placeholder="请输入邮寄地址"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 投标材料清单 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>投标材料清单</CardTitle>
                <CardDescription>友司需提供的投标资质及相关材料</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addMaterial}>
                <Plus className="mr-2 h-4 w-4" />
                添加材料
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {materials.map((material) => (
                <div key={material.id} className="flex items-end gap-3 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">材料类别</Label>
                      <Select
                        value={material.category}
                        onValueChange={(v) => updateMaterial(material.id, 'category', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(MATERIAL_CATEGORY_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">具体材料名称</Label>
                      <Input
                        className="h-9"
                        value={material.materialName}
                        onChange={(e) => updateMaterial(material.id, 'materialName', e.target.value)}
                        placeholder="请输入材料名称"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">提交方式</Label>
                      <Select
                        value={material.submitType}
                        onValueChange={(v) => updateMaterial(material.id, 'submitType', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="electronic">电子档</SelectItem>
                          <SelectItem value="paper">纸质档</SelectItem>
                          <SelectItem value="both">两者都有</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => removeMaterial(material.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 费用明细 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>费用明细</CardTitle>
                <CardDescription>友司支持相关费用</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addFee}>
                <Plus className="mr-2 h-4 w-4" />
                添加费用
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fees.map((fee) => (
                <div key={fee.id} className="flex items-end gap-3 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">费用类型</Label>
                      <Select
                        value={fee.feeType}
                        onValueChange={(v) => updateFee(fee.id, 'feeType', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="base">基础费用</SelectItem>
                          <SelectItem value="agent">代理费用</SelectItem>
                          <SelectItem value="accommodation">差旅住宿</SelectItem>
                          <SelectItem value="other">其他费用</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">费用项目</Label>
                      <Input
                        className="h-9"
                        value={fee.feeName}
                        onChange={(e) => updateFee(fee.id, 'feeName', e.target.value)}
                        placeholder="费用项目名称"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">默认标准</Label>
                      <Input
                        className="h-9"
                        value={fee.defaultAmount}
                        onChange={(e) => updateFee(fee.id, 'defaultAmount', e.target.value)}
                        placeholder="默认费用标准"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">实际金额（元）</Label>
                      <Input
                        className="h-9"
                        value={fee.actualAmount}
                        onChange={(e) => updateFee(fee.id, 'actualAmount', e.target.value)}
                        placeholder="实际费用金额"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => removeFee(fee.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-end pt-2 border-t">
                <div className="text-sm">
                  费用合计：<span className="font-bold text-lg">
                    {fees.reduce((sum, f) => sum + (parseFloat(f.actualAmount) || 0), 0).toFixed(2)}
                  </span> 元
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 待办事项 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>待办事项</CardTitle>
                <CardDescription>追踪需要完成的事项</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addTodo}>
                <Plus className="mr-2 h-4 w-4" />
                添加待办
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {todos.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                暂无待办事项，点击"添加待办"创建
              </div>
            ) : (
              <div className="space-y-3">
                {todos.map((todo) => (
                  <div key={todo.id} className="flex items-end gap-3 p-3 border rounded-lg">
                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">待办事项</Label>
                        <Input
                          className="h-9"
                          value={todo.title}
                          onChange={(e) => updateTodo(todo.id, 'title', e.target.value)}
                          placeholder="请输入待办事项"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">责任人</Label>
                        <Input
                          className="h-9"
                          value={todo.assigneeName}
                          onChange={(e) => updateTodo(todo.id, 'assigneeName', e.target.value)}
                          placeholder="责任人姓名"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">截止时间</Label>
                        <Input
                          type="date"
                          className="h-9"
                          value={todo.deadline}
                          onChange={(e) => updateTodo(todo.id, 'deadline', e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => removeTodo(todo.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 补充说明 */}
        <Card>
          <CardHeader>
            <CardTitle>补充说明</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="请输入其他需要说明的内容"
              rows={4}
            />
          </CardContent>
        </Card>

        {/* 提交按钮 */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.push('/support/partner-applications')}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建申请
          </Button>
        </div>
      </div>
    </div>
  );
}

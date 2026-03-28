/**
 * 购买招标文件安排表单组件
 * 支持联动选择政采单位、公司、对接人
 * 支持指派任务和推送到任务中心
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  Calendar,
  FileText,
  MapPin,
  Phone,
  Loader2,
  Send,
  UserPlus,
  Clock,
  AlertCircle,
} from 'lucide-react';

// 政采单位类型
interface Platform {
  id: number;
  name: string;
  shortName: string | null;
  type: string;
  address: string;
  phone: string | null;
}

// 公司类型
interface Company {
  id: number;
  name: string;
  shortName: string | null;
}

// 对接人类型
interface Contact {
  id: number;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  roles: string | null;
}

// 用户类型
interface User {
  id: number;
  realName: string;
  phone: string | null;
}

// 表单数据类型
export interface BidDocumentPurchaseFormData {
  projectName: string;
  projectCode: string;
  purchaseDeadline: string;
  plannedDate: string;
  platformId: number | null;
  platformName: string;
  platformAddress: string;
  platformContact: string;
  platformPhone: string;
  ourContactId: number | null;
  ourContactName: string;
  ourContactPhone: string;
  partnerCompanyId: number | null;
  partnerCompanyName: string;
  partnerContactId: number | null;
  partnerContactName: string;
  partnerContactPhone: string;
  assigneeId: number | null;
  assigneeName: string;
  priority: 'high' | 'medium' | 'low';
  requiredMaterials: Array<{
    name: string;
    required: boolean;
    category: string;
    checked: boolean;
  }>;
  remarks: string;
}

interface BidDocumentPurchaseFormProps {
  initialData?: {
    id: number;
    projectName: string;
    projectCode: string | null;
    purchaseDeadline: string | null;
    plannedDate: string | null;
    platformId: number | null;
    platformName: string | null;
    platformAddress: string | null;
    platformContact: string | null;
    platformPhone: string | null;
    ourContactId: number | null;
    ourContactName: string | null;
    ourContactPhone: string | null;
    partnerCompanyId: number | null;
    partnerCompanyName: string | null;
    partnerContactId: number | null;
    partnerContactName: string | null;
    partnerContactPhone: string | null;
    assigneeId: number | null;
    assigneeName: string | null;
    priority: string | null;
    requiredMaterials: string | null;
    remarks: string | null;
    pushedToTask: boolean | null;
    taskId: number | null;
  } | null;
  onSubmit: (data: BidDocumentPurchaseFormData) => void;
  onCancel: () => void;
  onPushToTask?: (id: number) => Promise<void>;
}

// 默认所需材料
const DEFAULT_MATERIALS = [
  { name: '营业执照副本', required: true, category: 'company', checked: false },
  { name: '法定代表人身份证明', required: true, category: 'company', checked: false },
  { name: '授权委托书', required: false, category: 'company', checked: false },
  { name: '相关资质证书', required: false, category: 'company', checked: false },
  { name: '代办人身份证', required: true, category: 'personal', checked: false },
  { name: '项目相关资质证明', required: false, category: 'other', checked: false },
  { name: '购买费用（现金/转账）', required: false, category: 'other', checked: false },
];

// 优先级配置
const PRIORITY_CONFIG = {
  high: { label: '紧急', color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '普通', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  low: { label: '低', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

export function BidDocumentPurchaseForm({
  initialData,
  onSubmit,
  onCancel,
  onPushToTask,
}: BidDocumentPurchaseFormProps) {
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [partnerContacts, setPartnerContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // 表单数据
  const [formData, setFormData] = useState<BidDocumentPurchaseFormData>({
    projectName: initialData?.projectName || '',
    projectCode: initialData?.projectCode || '',
    purchaseDeadline: initialData?.purchaseDeadline 
      ? new Date(initialData.purchaseDeadline).toISOString().slice(0, 16) 
      : '',
    plannedDate: initialData?.plannedDate 
      ? new Date(initialData.plannedDate).toISOString().slice(0, 10) 
      : '',
    platformId: initialData?.platformId || null,
    platformName: initialData?.platformName || '',
    platformAddress: initialData?.platformAddress || '',
    platformContact: initialData?.platformContact || '',
    platformPhone: initialData?.platformPhone || '',
    ourContactId: initialData?.ourContactId || null,
    ourContactName: initialData?.ourContactName || '',
    ourContactPhone: initialData?.ourContactPhone || '',
    partnerCompanyId: initialData?.partnerCompanyId || null,
    partnerCompanyName: initialData?.partnerCompanyName || '',
    partnerContactId: initialData?.partnerContactId || null,
    partnerContactName: initialData?.partnerContactName || '',
    partnerContactPhone: initialData?.partnerContactPhone || '',
    assigneeId: initialData?.assigneeId || null,
    assigneeName: initialData?.assigneeName || '',
    priority: (initialData?.priority as 'high' | 'medium' | 'low') || 'medium',
    requiredMaterials: initialData?.requiredMaterials 
      ? JSON.parse(initialData.requiredMaterials) 
      : DEFAULT_MATERIALS,
    remarks: initialData?.remarks || '',
  });

  // 加载政采单位列表
  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await fetch('/api/bidding-platforms');
        const result = await response.json();
        if (result.success) {
          setPlatforms(result.platforms);
        }
      } catch (error) {
        console.error('Failed to fetch platforms:', error);
      }
    };
    fetchPlatforms();
  }, []);

  // 加载公司列表
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/companies?pageSize=100');
        const result = await response.json();
        if (result.items) {
          setCompanies(result.items);
        }
      } catch (error) {
        console.error('Failed to fetch companies:', error);
      }
    };
    fetchCompanies();
  }, []);

  // 加载用户列表（我方负责人和指派人）
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users?pageSize=100');
        const result = await response.json();
        if (result.items) {
          setUsers(result.items);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();
  }, []);

  // 当选择友司时，加载其对接人列表
  useEffect(() => {
    const fetchPartnerContacts = async () => {
      if (!formData.partnerCompanyId) {
        setPartnerContacts([]);
        return;
      }
      try {
        const response = await fetch(`/api/company-contacts?companyId=${formData.partnerCompanyId}`);
        const result = await response.json();
        if (result.success) {
          setPartnerContacts(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch partner contacts:', error);
      }
    };
    fetchPartnerContacts();
  }, [formData.partnerCompanyId]);

  // 选择政采单位时，自动填充信息
  const handlePlatformChange = (platformId: string) => {
    if (!platformId) {
      setFormData({
        ...formData,
        platformId: null,
        platformName: '',
        platformAddress: '',
      });
      return;
    }
    
    const platform = platforms.find(p => p.id === parseInt(platformId));
    if (platform) {
      setFormData({
        ...formData,
        platformId: platform.id,
        platformName: platform.name,
        platformAddress: platform.address,
      });
    }
  };

  // 选择友司时，自动填充公司名称
  const handlePartnerCompanyChange = (companyId: string) => {
    if (!companyId) {
      setFormData({
        ...formData,
        partnerCompanyId: null,
        partnerCompanyName: '',
        partnerContactId: null,
        partnerContactName: '',
        partnerContactPhone: '',
      });
      return;
    }
    
    const company = companies.find(c => c.id === parseInt(companyId));
    if (company) {
      setFormData({
        ...formData,
        partnerCompanyId: company.id,
        partnerCompanyName: company.name,
        partnerContactId: null,
        partnerContactName: '',
        partnerContactPhone: '',
      });
    }
  };

  // 选择友司对接人时，自动填充信息
  const handlePartnerContactChange = (contactId: string) => {
    if (!contactId) {
      setFormData({
        ...formData,
        partnerContactId: null,
        partnerContactName: '',
        partnerContactPhone: '',
      });
      return;
    }
    
    const contact = partnerContacts.find(c => c.id === parseInt(contactId));
    if (contact) {
      setFormData({
        ...formData,
        partnerContactId: contact.id,
        partnerContactName: contact.name,
        partnerContactPhone: contact.phone || '',
      });
    }
  };

  // 选择我方负责人时，自动填充信息
  const handleOurContactChange = (userId: string) => {
    if (!userId) {
      setFormData({
        ...formData,
        ourContactId: null,
        ourContactName: '',
        ourContactPhone: '',
      });
      return;
    }
    
    const user = users.find(u => u.id === parseInt(userId));
    if (user) {
      setFormData({
        ...formData,
        ourContactId: user.id,
        ourContactName: user.realName,
        ourContactPhone: user.phone || '',
      });
    }
  };

  // 选择指派人时，自动填充姓名
  const handleAssigneeChange = (userId: string) => {
    if (!userId) {
      setFormData({
        ...formData,
        assigneeId: null,
        assigneeName: '',
      });
      return;
    }
    
    const user = users.find(u => u.id === parseInt(userId));
    if (user) {
      setFormData({
        ...formData,
        assigneeId: user.id,
        assigneeName: user.realName,
      });
    }
  };

  // 材料勾选变更
  const handleMaterialCheck = (index: number, checked: boolean) => {
    const newMaterials = [...formData.requiredMaterials];
    newMaterials[index] = { ...newMaterials[index], checked };
    setFormData({ ...formData, requiredMaterials: newMaterials });
  };

  // 推送到任务中心
  const handlePushToTask = async () => {
    if (!initialData?.id) return;
    if (!formData.assigneeId) {
      alert('请先指派负责人');
      return;
    }
    
    setPushing(true);
    try {
      if (onPushToTask) {
        await onPushToTask(initialData.id);
      }
    } finally {
      setPushing(false);
    }
  };

  // 提交表单
  const handleSubmit = () => {
    if (!formData.projectName) {
      alert('请填写项目名称');
      return;
    }
    onSubmit(formData);
  };

  const isAlreadyPushed = initialData?.pushedToTask && initialData?.taskId;

  return (
    <div className="space-y-6">
      {/* 项目核心信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            项目核心信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">
                项目名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="projectName"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="请输入项目名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectCode">项目编号</Label>
              <Input
                id="projectCode"
                value={formData.projectCode}
                onChange={(e) => setFormData({ ...formData, projectCode: e.target.value })}
                placeholder="请输入项目编号"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plannedDate">
                <Clock className="h-4 w-4 inline mr-1" />
                计划购买日期
              </Label>
              <Input
                id="plannedDate"
                type="date"
                value={formData.plannedDate}
                onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseDeadline">
                <AlertCircle className="h-4 w-4 inline mr-1 text-red-500" />
                购买截止时间
              </Label>
              <Input
                id="purchaseDeadline"
                type="datetime-local"
                value={formData.purchaseDeadline}
                onChange={(e) => setFormData({ ...formData, purchaseDeadline: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 任务指派 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            任务指派
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>指派负责人</Label>
              <Select
                value={formData.assigneeId?.toString() || ''}
                onValueChange={handleAssigneeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择负责人" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.realName}
                      {user.phone && ` (${user.phone})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>优先级</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'high' | 'medium' | 'low') => 
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择优先级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <Badge className={PRIORITY_CONFIG.high.color}>紧急</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <Badge className={PRIORITY_CONFIG.medium.color}>普通</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <Badge className={PRIORITY_CONFIG.low.color}>低</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* 推送任务中心状态 */}
          {initialData && (
            <div className="flex items-center gap-4 pt-2">
              {isAlreadyPushed ? (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  已推送到任务中心
                </Badge>
              ) : formData.assigneeId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePushToTask}
                  disabled={pushing}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  {pushing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  推送到任务中心
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  请先指派负责人后才能推送到任务中心
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 对接主体信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            对接主体（政采/招标代理机构）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>选择对接单位</Label>
            <Select
              value={formData.platformId?.toString() || ''}
              onValueChange={handlePlatformChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择政采单位或招标代理机构" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id.toString()}>
                    {platform.name}
                    {platform.shortName && ` (${platform.shortName})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platformName">单位名称</Label>
              <Input
                id="platformName"
                value={formData.platformName}
                onChange={(e) => setFormData({ ...formData, platformName: e.target.value })}
                placeholder="自动同步或手动填写"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platformContact">对接人</Label>
              <Input
                id="platformContact"
                value={formData.platformContact}
                onChange={(e) => setFormData({ ...formData, platformContact: e.target.value })}
                placeholder="对接人姓名"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platformAddress">
                <MapPin className="h-4 w-4 inline mr-1" />
                单位地址
              </Label>
              <Input
                id="platformAddress"
                value={formData.platformAddress}
                onChange={(e) => setFormData({ ...formData, platformAddress: e.target.value })}
                placeholder="自动同步或手动填写"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platformPhone">
                <Phone className="h-4 w-4 inline mr-1" />
                联系电话
              </Label>
              <Input
                id="platformPhone"
                value={formData.platformPhone}
                onChange={(e) => setFormData({ ...formData, platformPhone: e.target.value })}
                placeholder="联系电话"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 负责人信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            负责人信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 我方负责人 */}
          <div className="space-y-2">
            <Label>我方负责人</Label>
            <Select
              value={formData.ourContactId?.toString() || ''}
              onValueChange={handleOurContactChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择我方负责人" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.realName}
                    {user.phone && ` (${user.phone})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ourContactName">负责人姓名</Label>
              <Input
                id="ourContactName"
                value={formData.ourContactName}
                onChange={(e) => setFormData({ ...formData, ourContactName: e.target.value })}
                placeholder="自动填充或手动填写"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ourContactPhone">联系电话</Label>
              <Input
                id="ourContactPhone"
                value={formData.ourContactPhone}
                onChange={(e) => setFormData({ ...formData, ourContactPhone: e.target.value })}
                placeholder="自动填充或手动填写"
              />
            </div>
          </div>

          {/* 友司负责人 */}
          <div className="pt-4 border-t">
            <Label>友司信息（可选）</Label>
            <div className="mt-2 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">选择友司公司</Label>
                <Select
                  value={formData.partnerCompanyId?.toString() || ''}
                  onValueChange={handlePartnerCompanyChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择友司公司" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                        {company.shortName && ` (${company.shortName})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {formData.partnerCompanyId && partnerContacts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">选择友司对接人</Label>
                  <Select
                    value={formData.partnerContactId?.toString() || ''}
                    onValueChange={handlePartnerContactChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择友司对接人" />
                    </SelectTrigger>
                    <SelectContent>
                      {partnerContacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id.toString()}>
                          {contact.name}
                          {contact.department && ` - ${contact.department}`}
                          {contact.phone && ` (${contact.phone})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="partnerCompanyName">友司公司名称</Label>
                  <Input
                    id="partnerCompanyName"
                    value={formData.partnerCompanyName}
                    onChange={(e) => setFormData({ ...formData, partnerCompanyName: e.target.value })}
                    placeholder="自动填充或手动填写"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partnerContactName">友司对接人</Label>
                  <Input
                    id="partnerContactName"
                    value={formData.partnerContactName}
                    onChange={(e) => setFormData({ ...formData, partnerContactName: e.target.value })}
                    placeholder="自动填充或手动填写"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 所需材料提醒 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            购买所需材料提醒
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">公司相关材料</h4>
              <div className="space-y-2">
                {formData.requiredMaterials
                  .filter(m => m.category === 'company')
                  .map((material, idx) => {
                    const globalIdx = formData.requiredMaterials.findIndex(m => m.name === material.name);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <Checkbox
                          id={`material-${globalIdx}`}
                          checked={material.checked}
                          onCheckedChange={(checked) => handleMaterialCheck(globalIdx, checked as boolean)}
                        />
                        <Label htmlFor={`material-${globalIdx}`} className="font-normal">
                          {material.name}
                          {material.required && <span className="text-red-500 ml-1">*必带</span>}
                        </Label>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">代办人本人材料</h4>
              <div className="space-y-2">
                {formData.requiredMaterials
                  .filter(m => m.category === 'personal')
                  .map((material, idx) => {
                    const globalIdx = formData.requiredMaterials.findIndex(m => m.name === material.name);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <Checkbox
                          id={`material-${globalIdx}`}
                          checked={material.checked}
                          onCheckedChange={(checked) => handleMaterialCheck(globalIdx, checked as boolean)}
                        />
                        <Label htmlFor={`material-${globalIdx}`} className="font-normal">
                          {material.name}
                          {material.required && <span className="text-red-500 ml-1">*必带</span>}
                        </Label>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">其他补充材料</h4>
              <div className="space-y-2">
                {formData.requiredMaterials
                  .filter(m => m.category === 'other')
                  .map((material, idx) => {
                    const globalIdx = formData.requiredMaterials.findIndex(m => m.name === material.name);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <Checkbox
                          id={`material-${globalIdx}`}
                          checked={material.checked}
                          onCheckedChange={(checked) => handleMaterialCheck(globalIdx, checked as boolean)}
                        />
                        <Label htmlFor={`material-${globalIdx}`} className="font-normal">
                          {material.name}
                        </Label>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              提示：原件+复印件，复印件需加盖公章，具体可按对接单位要求调整
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 备注 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">备注说明</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            placeholder="其他需要说明的事项..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSubmit}>
          {initialData ? '保存修改' : '创建安排'}
        </Button>
      </div>
    </div>
  );
}

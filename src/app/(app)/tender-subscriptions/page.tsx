'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select as _Select,
  SelectContent as _SelectContent,
  SelectItem as _SelectItem,
  SelectTrigger as _SelectTrigger,
  SelectValue as _SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Search as _Search,
  Filter,
  RefreshCw,
  Settings,
  Tag,
  MapPin,
  Building2,
  DollarSign,
  CheckCircle2,
  XCircle as _XCircle,
  Sparkles,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

// 广西14个地市
const GUANGXI_REGIONS = [
  '南宁市', '柳州市', '桂林市', '梧州市', '北海市', '防城港市',
  '钦州市', '贵港市', '玉林市', '百色市', '贺州市', '河池市',
  '来宾市', '崇左市',
];

// 常见行业分类
const INDUSTRIES = [
  '工程建设', '政府采购', '交通运输', '水利水务', '能源电力',
  '医疗卫生', '教育科研', '信息技术', '环保绿化', '市政设施',
  '农业林业', '文化旅游', '金融服务', '其他',
];

// 采购方式
const PROCUREMENT_METHODS = [
  '公开招标', '邀请招标', '竞争性谈判', '竞争性磋商',
  '询价采购', '单一来源', '框架协议', '其他',
];

interface Subscription {
  id: number;
  name: string;
  keywords: string[];
  industries: string[];
  regions: string[];
  procurementMethods: string[];
  budgetMin: string | null;
  budgetMax: string | null;
  isActive: boolean;
  matchCount: number;
  lastMatchAt: string | null;
  createdAt: string;
}

interface AlertSetting {
  registerDays: number;
  questionDays: number;
  submissionDays: number;
  openBidDays: number;
  channels: string[];
  wechatWorkWebhook: string | null;
  dingtalkWebhook: string | null;
  isEnabled: boolean;
}

export default function TenderSubscriptionPage() {
  const _router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [alertSetting, setAlertSetting] = useState<AlertSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [activeTab, setActiveTab] = useState('subscriptions');

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    keywords: '',
    industries: [] as string[],
    regions: [] as string[],
    procurementMethods: [] as string[],
    budgetMin: '',
    budgetMax: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [subsRes, settingsRes] = await Promise.all([
        fetch('/api/tender-subscriptions'),
        fetch('/api/alert-settings'),
      ]);
      const subsData = await subsRes.json();
      const settingsData = await settingsRes.json();
      setSubscriptions(subsData.data || []);
      setAlertSetting(settingsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      keywords: '',
      industries: [],
      regions: [],
      procurementMethods: [],
      budgetMin: '',
      budgetMax: '',
    });
    setEditingSubscription(null);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(subscription: Subscription) {
    setEditingSubscription(subscription);
    setFormData({
      name: subscription.name,
      keywords: subscription.keywords.join(', '),
      industries: subscription.industries || [],
      regions: subscription.regions || [],
      procurementMethods: subscription.procurementMethods || [],
      budgetMin: subscription.budgetMin || '',
      budgetMax: subscription.budgetMax || '',
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      toast.error('请输入订阅名称');
      return;
    }
    if (!formData.keywords.trim()) {
      toast.error('请输入关键词');
      return;
    }

    const keywords = formData.keywords.split(/[,，]/).map(k => k.trim()).filter(Boolean);

    if (keywords.length === 0) {
      toast.error('请至少输入一个关键词');
      return;
    }

    try {
      const url = editingSubscription
        ? `/api/tender-subscriptions/${editingSubscription.id}`
        : '/api/tender-subscriptions';
      const method = editingSubscription ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          keywords,
          industries: formData.industries,
          regions: formData.regions,
          procurementMethods: formData.procurementMethods,
          budgetMin: formData.budgetMin || null,
          budgetMax: formData.budgetMax || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '操作失败');
      }

      toast.success(editingSubscription ? '订阅已更新' : '订阅已创建');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save subscription:', error);
      toast.error(error instanceof Error ? error.message : '保存失败');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确定要删除此订阅吗？')) return;

    try {
      const res = await fetch(`/api/tender-subscriptions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('删除失败');

      toast.success('订阅已删除');
      fetchData();
    } catch (error) {
      console.error('Failed to delete subscription:', error);
      toast.error('删除失败');
    }
  }

  async function toggleSubscription(subscription: Subscription) {
    try {
      const res = await fetch(`/api/tender-subscriptions/${subscription.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !subscription.isActive }),
      });

      if (!res.ok) throw new Error('操作失败');

      toast.success(subscription.isActive ? '订阅已禁用' : '订阅已启用');
      fetchData();
    } catch (error) {
      console.error('Failed to toggle subscription:', error);
      toast.error('操作失败');
    }
  }

  async function saveAlertSetting(key: string, value: any) {
    try {
      const res = await fetch('/api/alert-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!res.ok) throw new Error('保存失败');

      const data = await res.json();
      setAlertSetting(data);
      toast.success('设置已保存');
    } catch (error) {
      console.error('Failed to save alert setting:', error);
      toast.error('保存失败');
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-8 w-8" />
            招标信息订阅
          </h1>
          <p className="text-muted-foreground">设置关键词订阅，自动匹配招标信息并预警</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            新建订阅
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Tag className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{subscriptions.length}</p>
                <p className="text-sm text-muted-foreground">订阅规则</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {subscriptions.filter(s => s.isActive).length}
                </p>
                <p className="text-sm text-muted-foreground">已启用</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {subscriptions.reduce((sum, s) => sum + s.matchCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">匹配次数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {alertSetting?.submissionDays ?? 3}天
                </p>
                <p className="text-sm text-muted-foreground">投标截止预警</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主内容区 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="subscriptions">订阅规则</TabsTrigger>
          <TabsTrigger value="settings">预警设置</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>我的订阅</CardTitle>
              <CardDescription>管理您的招标信息订阅规则</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无订阅规则</p>
                  <p className="text-sm mt-2">点击上方"新建订阅"创建您的第一条订阅规则</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>订阅名称</TableHead>
                      <TableHead>关键词</TableHead>
                      <TableHead>行业/地区</TableHead>
                      <TableHead>预算区间</TableHead>
                      <TableHead>匹配次数</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell className="font-medium">
                          {subscription.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {subscription.keywords.slice(0, 3).map((keyword, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                            {subscription.keywords.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{subscription.keywords.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {subscription.industries?.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {subscription.industries.slice(0, 2).join('、')}
                              </div>
                            )}
                            {subscription.regions?.length > 0 && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {subscription.regions.slice(0, 2).join('、')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {subscription.budgetMin || subscription.budgetMax ? (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {subscription.budgetMin || '0'} - {subscription.budgetMax || '不限'}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">不限</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{subscription.matchCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={subscription.isActive}
                            onCheckedChange={() => toggleSubscription(subscription)}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(subscription)}>
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(subscription.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                预警时间设置
              </CardTitle>
              <CardDescription>设置各类时间节点的预警提前时间</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>报名截止提前（天）</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={alertSetting?.registerDays ?? 1}
                      onChange={(e) => saveAlertSetting('registerDays', parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">天前提醒</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>答疑截止提前（天）</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={alertSetting?.questionDays ?? 1}
                      onChange={(e) => saveAlertSetting('questionDays', parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">天前提醒</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>投标截止提前（天）</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={alertSetting?.submissionDays ?? 3}
                      onChange={(e) => saveAlertSetting('submissionDays', parseInt(e.target.value) || 3)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">天前提醒</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>开标时间提前（天）</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={alertSetting?.openBidDays ?? 1}
                      onChange={(e) => saveAlertSetting('openBidDays', parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">天前提醒</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>推送渠道设置</CardTitle>
              <CardDescription>配置预警消息的推送方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">系统内通知</p>
                  <p className="text-sm text-muted-foreground">在工作台显示预警通知</p>
                </div>
                <Switch
                  checked={alertSetting?.channels?.includes('system') ?? true}
                  onCheckedChange={(checked) => {
                    const channels = alertSetting?.channels || ['system'];
                    if (checked) {
                      saveAlertSetting('channels', [...channels, 'system']);
                    } else {
                      saveAlertSetting('channels', channels.filter(c => c !== 'system'));
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>企业微信机器人Webhook</Label>
                <Input
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                  value={alertSetting?.wechatWorkWebhook || ''}
                  onChange={(e) => setAlertSetting(prev => prev ? { ...prev, wechatWorkWebhook: e.target.value } : null)}
                  onBlur={() => saveAlertSetting('wechatWorkWebhook', alertSetting?.wechatWorkWebhook)}
                />
                <p className="text-xs text-muted-foreground">
                  在企业微信群中添加机器人，获取Webhook地址
                </p>
              </div>

              <div className="space-y-2">
                <Label>钉钉机器人Webhook</Label>
                <Input
                  placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"
                  value={alertSetting?.dingtalkWebhook || ''}
                  onChange={(e) => setAlertSetting(prev => prev ? { ...prev, dingtalkWebhook: e.target.value } : null)}
                  onBlur={() => saveAlertSetting('dingtalkWebhook', alertSetting?.dingtalkWebhook)}
                />
                <p className="text-xs text-muted-foreground">
                  在钉钉群中添加机器人，获取Webhook地址
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 创建/编辑订阅弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSubscription ? '编辑订阅' : '新建订阅'}
            </DialogTitle>
            <DialogDescription>
              设置订阅条件，系统将自动匹配符合条件的招标信息
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">订阅名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：广西IT项目订阅"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">关键词 *（多个关键词用逗号分隔）</Label>
                <Textarea
                  id="keywords"
                  placeholder="例如：信息化, 软件开发, 系统集成"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  至少输入一个关键词，系统将匹配招标标题和内容
                </p>
              </div>
            </div>

            {/* 筛选条件 */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                筛选条件（可选）
              </h4>

              <div className="space-y-2">
                <Label>行业分类</Label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((industry) => (
                    <Badge
                      key={industry}
                      variant={formData.industries.includes(industry) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const industries = formData.industries.includes(industry)
                          ? formData.industries.filter((i) => i !== industry)
                          : [...formData.industries, industry];
                        setFormData({ ...formData, industries });
                      }}
                    >
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>地区（广西）</Label>
                <div className="flex flex-wrap gap-2">
                  {GUANGXI_REGIONS.map((region) => (
                    <Badge
                      key={region}
                      variant={formData.regions.includes(region) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const regions = formData.regions.includes(region)
                          ? formData.regions.filter((r) => r !== region)
                          : [...formData.regions, region];
                        setFormData({ ...formData, regions });
                      }}
                    >
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>采购方式</Label>
                <div className="flex flex-wrap gap-2">
                  {PROCUREMENT_METHODS.map((method) => (
                    <Badge
                      key={method}
                      variant={formData.procurementMethods.includes(method) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const methods = formData.procurementMethods.includes(method)
                          ? formData.procurementMethods.filter((m) => m !== method)
                          : [...formData.procurementMethods, method];
                        setFormData({ ...formData, procurementMethods: methods });
                      }}
                    >
                      {method}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>预算最小值</Label>
                  <Input
                    placeholder="例如：100万"
                    value={formData.budgetMin}
                    onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>预算最大值</Label>
                  <Input
                    placeholder="例如：500万"
                    value={formData.budgetMax}
                    onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              {editingSubscription ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

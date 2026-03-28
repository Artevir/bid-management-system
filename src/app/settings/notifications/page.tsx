'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Settings,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Save,
  TestTube,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationSettings {
  email: {
    enabled: boolean;
    address: string;
    verified: boolean;
  };
  sms: {
    enabled: boolean;
    phone: string;
    verified: boolean;
  };
  wechat: {
    enabled: boolean;
    openid: string;
    bound: boolean;
  };
  web: {
    enabled: boolean;
    browserSupported: boolean;
  };
  preferences: {
    projectReminder: boolean;
    approvalNotification: boolean;
    deadlineAlert: boolean;
    systemNotice: boolean;
    weeklyReport: boolean;
    dailyDigest: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

const defaultSettings: NotificationSettings = {
  email: {
    enabled: true,
    address: '',
    verified: false,
  },
  sms: {
    enabled: false,
    phone: '',
    verified: false,
  },
  wechat: {
    enabled: false,
    openid: '',
    bound: false,
  },
  web: {
    enabled: true,
    browserSupported: true,
  },
  preferences: {
    projectReminder: true,
    approvalNotification: true,
    deadlineAlert: true,
    systemNotice: true,
    weeklyReport: false,
    dailyDigest: false,
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
};

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testChannel, setTestChannel] = useState<string>('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchSettings();
    checkBrowserNotification();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notification-settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...defaultSettings, ...data });
      }
    } catch (error) {
      console.error('获取设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBrowserNotification = () => {
    const supported = 'Notification' in window;
    setSettings(prev => ({
      ...prev,
      web: {
        ...prev.web,
        browserSupported: supported,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('保存失败');

      toast.success('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testChannel) {
      toast.error('请选择测试渠道');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/notification-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: testChannel }),
      });

      if (!res.ok) throw new Error('测试失败');

      toast.success('测试消息已发送');
      setTestDialogOpen(false);
    } catch (error) {
      console.error('测试失败:', error);
      toast.error('测试失败');
    } finally {
      setTesting(false);
    }
  };

  const requestBrowserNotification = async () => {
    if (!('Notification' in window)) {
      toast.error('您的浏览器不支持桌面通知');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      toast.success('已开启浏览器通知');
      setSettings(prev => ({
        ...prev,
        web: { ...prev.web, enabled: true },
      }));
    } else {
      toast.error('请允许浏览器通知权限');
    }
  };

  const updateSettings = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: any = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i] as keyof typeof current];
      }
      
      current[keys[keys.length - 1] as keyof typeof current] = value;
      return newSettings;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">消息推送设置</h1>
          <p className="text-muted-foreground">配置消息接收渠道和偏好设置</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <TestTube className="mr-2 h-4 w-4" />
                发送测试
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>发送测试消息</DialogTitle>
                <DialogDescription>选择要测试的消息渠道</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Select value={testChannel} onValueChange={setTestChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择渠道" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">邮件通知</SelectItem>
                    <SelectItem value="sms">短信通知</SelectItem>
                    <SelectItem value="wechat">企业微信</SelectItem>
                    <SelectItem value="web">浏览器通知</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleTest} disabled={testing}>
                  {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  发送
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            保存设置
          </Button>
        </div>
      </div>

      {/* 推送渠道设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            推送渠道
          </CardTitle>
          <CardDescription>选择接收消息的方式</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 邮件通知 */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">邮件通知</div>
                <div className="text-sm text-muted-foreground">
                  通过电子邮件接收重要通知
                </div>
                {settings.email.address && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {settings.email.address}
                    {settings.email.verified && (
                      <Badge variant="outline" className="ml-2 text-green-600">
                        已验证
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Switch
              checked={settings.email.enabled}
              onCheckedChange={(checked) => updateSettings('email.enabled', checked)}
            />
          </div>

          <Separator />

          {/* 短信通知 */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Smartphone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="font-medium">短信通知</div>
                <div className="text-sm text-muted-foreground">
                  通过手机短信接收紧急通知
                </div>
                {settings.sms.phone && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {settings.sms.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                    {settings.sms.verified && (
                      <Badge variant="outline" className="ml-2 text-green-600">
                        已验证
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Switch
              checked={settings.sms.enabled}
              onCheckedChange={(checked) => updateSettings('sms.enabled', checked)}
            />
          </div>

          <Separator />

          {/* 企业微信 */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="font-medium">企业微信</div>
                <div className="text-sm text-muted-foreground">
                  通过企业微信接收工作消息
                </div>
                {settings.wechat.bound && (
                  <Badge variant="outline" className="mt-1 text-green-600">
                    已绑定
                  </Badge>
                )}
              </div>
            </div>
            <Switch
              checked={settings.wechat.enabled}
              onCheckedChange={(checked) => updateSettings('wechat.enabled', checked)}
            />
          </div>

          <Separator />

          {/* 浏览器通知 */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Bell className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="font-medium">浏览器通知</div>
                <div className="text-sm text-muted-foreground">
                  在浏览器中弹出桌面通知
                </div>
                {!settings.web.browserSupported && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      您的浏览器不支持桌面通知
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {settings.web.enabled && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={requestBrowserNotification}
                disabled={!settings.web.browserSupported}
              >
                {settings.web.enabled ? '已开启' : '开启'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 消息类型偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            消息类型偏好
          </CardTitle>
          <CardDescription>选择需要接收的消息类型</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">项目提醒</div>
                <div className="text-sm text-muted-foreground">
                  项目状态变更、进度更新等
                </div>
              </div>
              <Switch
                checked={settings.preferences.projectReminder}
                onCheckedChange={(checked) => updateSettings('preferences.projectReminder', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">审批通知</div>
                <div className="text-sm text-muted-foreground">
                  审批请求、审批结果等
                </div>
              </div>
              <Switch
                checked={settings.preferences.approvalNotification}
                onCheckedChange={(checked) => updateSettings('preferences.approvalNotification', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">截止提醒</div>
                <div className="text-sm text-muted-foreground">
                  投标截止、资质到期等
                </div>
              </div>
              <Switch
                checked={settings.preferences.deadlineAlert}
                onCheckedChange={(checked) => updateSettings('preferences.deadlineAlert', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">系统通知</div>
                <div className="text-sm text-muted-foreground">
                  系统公告、维护通知等
                </div>
              </div>
              <Switch
                checked={settings.preferences.systemNotice}
                onCheckedChange={(checked) => updateSettings('preferences.systemNotice', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">周报汇总</div>
                <div className="text-sm text-muted-foreground">
                  每周工作汇总邮件
                </div>
              </div>
              <Switch
                checked={settings.preferences.weeklyReport}
                onCheckedChange={(checked) => updateSettings('preferences.weeklyReport', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">每日摘要</div>
                <div className="text-sm text-muted-foreground">
                  每日工作事项摘要
                </div>
              </div>
              <Switch
                checked={settings.preferences.dailyDigest}
                onCheckedChange={(checked) => updateSettings('preferences.dailyDigest', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 免打扰时段 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            免打扰时段
          </CardTitle>
          <CardDescription>在指定时间段内暂停消息推送</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">开启免打扰</div>
              <div className="text-sm text-muted-foreground">
                在指定时间段内不推送消息通知
              </div>
            </div>
            <Switch
              checked={settings.quietHours.enabled}
              onCheckedChange={(checked) => updateSettings('quietHours.enabled', checked)}
            />
          </div>

          {settings.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input
                  type="time"
                  value={settings.quietHours.startTime}
                  onChange={(e) => updateSettings('quietHours.startTime', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Input
                  type="time"
                  value={settings.quietHours.endTime}
                  onChange={(e) => updateSettings('quietHours.endTime', e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

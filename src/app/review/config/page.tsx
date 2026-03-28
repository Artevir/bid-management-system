'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  ListOrdered,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';

// ============================================
// 类型定义
// ============================================

interface ReviewConfig {
  id: number;
  name: string;
  description: string | null;
  documentType: string;
  totalSteps: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReviewRule {
  id: number;
  configId: number;
  ruleCode: string;
  ruleName: string;
  ruleType: string;
  severity: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface ReviewTemplate {
  id: number;
  configId: number;
  name: string;
  content: string;
  category: string;
  isActive: boolean;
}

export default function ReviewConfigPage() {
  const [configs, setConfigs] = useState<ReviewConfig[]>([]);
  const [rules, setRules] = useState<ReviewRule[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('configs');

  // 弹窗状态
  const [configDialog, setConfigDialog] = useState<ReviewConfig | null>(null);
  const [ruleDialog, setRuleDialog] = useState<ReviewRule | null>(null);
  const [templateDialog, setTemplateDialog] = useState<ReviewTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [configsRes, rulesRes, templatesRes] = await Promise.all([
        fetch('/api/review/config').catch(() => ({ json: () => ({ configs: [] }) })),
        fetch('/api/review/config?type=rules').catch(() => ({ json: () => ({ rules: [] }) })),
        fetch('/api/review/config?type=templates').catch(() => ({ json: () => ({ templates: [] }) })),
      ]);

      const [configsData, rulesData, templatesData] = await Promise.all([
        configsRes.json(),
        rulesRes.json(),
        templatesRes.json(),
      ]);

      setConfigs(configsData.configs || []);
      setRules(rulesData.rules || []);
      setTemplates(templatesData.templates || []);
    } catch (error) {
      console.error('Failed to fetch review config data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(config: Partial<ReviewConfig>) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/review/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setConfigDialog(null);
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveRule(rule: Partial<ReviewRule>) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/review/config?type=rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setRuleDialog(null);
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTemplate(template: Partial<ReviewTemplate>) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/review/config?type=template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setTemplateDialog(null);
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      critical: { variant: 'destructive', label: '严重' },
      major: { variant: 'default', label: '重要' },
      minor: { variant: 'secondary', label: '次要' },
      suggestion: { variant: 'outline', label: '建议' },
    };
    const config = variants[severity] || { variant: 'secondary', label: severity };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">审校配置</h1>
          <p className="text-muted-foreground">管理审校流程、规则与模板</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="configs">
            <Settings className="h-4 w-4 mr-2" />
            审校配置
          </TabsTrigger>
          <TabsTrigger value="rules">
            <ListOrdered className="h-4 w-4 mr-2" />
            审校规则
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="h-4 w-4 mr-2" />
            审校模板
          </TabsTrigger>
        </TabsList>

        {/* 审校配置 */}
        <TabsContent value="configs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>审校流程配置</CardTitle>
                  <CardDescription>配置不同类型文档的审校流程</CardDescription>
                </div>
                <Button onClick={() => setConfigDialog({} as ReviewConfig)}>
                  <Plus className="h-4 w-4 mr-2" />
                  新建配置
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>配置名称</TableHead>
                      <TableHead>文档类型</TableHead>
                      <TableHead>审批步骤</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>更新时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          暂无配置
                        </TableCell>
                      </TableRow>
                    ) : (
                      configs.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell className="font-medium">{config.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{config.documentType}</Badge>
                          </TableCell>
                          <TableCell>{config.totalSteps} 步</TableCell>
                          <TableCell>
                            <Badge variant={config.isActive ? 'default' : 'secondary'}>
                              {config.isActive ? '启用' : '禁用'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(config.updatedAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfigDialog(config)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 审校规则 */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>审校规则库</CardTitle>
                  <CardDescription>定义自动审校的检查规则</CardDescription>
                </div>
                <Button onClick={() => setRuleDialog({} as ReviewRule)}>
                  <Plus className="h-4 w-4 mr-2" />
                  新建规则
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>规则编码</TableHead>
                      <TableHead>规则名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>严重程度</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          暂无规则
                        </TableCell>
                      </TableRow>
                    ) : (
                      rules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-mono text-sm">{rule.ruleCode}</TableCell>
                          <TableCell className="font-medium">{rule.ruleName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{rule.ruleType}</Badge>
                          </TableCell>
                          <TableCell>{getSeverityBadge(rule.severity)}</TableCell>
                          <TableCell>
                            <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                              {rule.isActive ? '启用' : '禁用'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRuleDialog(rule)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 审校模板 */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>审校模板</CardTitle>
                  <CardDescription>预定义的审校内容模板</CardDescription>
                </div>
                <Button onClick={() => setTemplateDialog({} as ReviewTemplate)}>
                  <Plus className="h-4 w-4 mr-2" />
                  新建模板
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无模板</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setTemplateDialog(template)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <Badge variant={template.isActive ? 'default' : 'secondary'}>
                            {template.isActive ? '启用' : '禁用'}
                          </Badge>
                        </div>
                        <CardDescription>{template.category}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {template.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 配置编辑弹窗 */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{(configDialog as any)?.id ? '编辑配置' : '新建配置'}</DialogTitle>
            <DialogDescription>配置审校流程参数</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">配置名称</Label>
              <Input
                id="name"
                defaultValue={(configDialog as any)?.name}
                placeholder="例如: 技术方案审批流程"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentType">文档类型</Label>
              <Select defaultValue={(configDialog as any)?.documentType}>
                <SelectTrigger>
                  <SelectValue placeholder="选择文档类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">技术方案</SelectItem>
                  <SelectItem value="business">商务标书</SelectItem>
                  <SelectItem value="contract">合同文档</SelectItem>
                  <SelectItem value="proposal">投标建议书</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalSteps">审批步骤数</Label>
              <Input
                id="totalSteps"
                type="number"
                min={1}
                max={5}
                defaultValue={(configDialog as any)?.totalSteps || 3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                defaultValue={(configDialog as any)?.description}
                placeholder="配置说明..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>
              取消
            </Button>
            <Button onClick={() => saveConfig(configDialog as any)} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 规则编辑弹窗 */}
      <Dialog open={!!ruleDialog} onOpenChange={() => setRuleDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{(ruleDialog as any)?.id ? '编辑规则' : '新建规则'}</DialogTitle>
            <DialogDescription>定义自动审校检查规则</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ruleCode">规则编码</Label>
              <Input
                id="ruleCode"
                defaultValue={(ruleDialog as any)?.ruleCode}
                placeholder="例如: R001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruleName">规则名称</Label>
              <Input
                id="ruleName"
                defaultValue={(ruleDialog as any)?.ruleName}
                placeholder="例如: 检查报价金额格式"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruleType">规则类型</Label>
              <Select defaultValue={(ruleDialog as any)?.ruleType}>
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="format">格式检查</SelectItem>
                  <SelectItem value="content">内容检查</SelectItem>
                  <SelectItem value="compliance">合规检查</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">严重程度</Label>
              <Select defaultValue={(ruleDialog as any)?.severity}>
                <SelectTrigger>
                  <SelectValue placeholder="选择程度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">严重</SelectItem>
                  <SelectItem value="major">重要</SelectItem>
                  <SelectItem value="minor">次要</SelectItem>
                  <SelectItem value="suggestion">建议</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">规则描述</Label>
              <Textarea
                id="description"
                defaultValue={(ruleDialog as any)?.description}
                placeholder="详细描述规则检查的内容和标准..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialog(null)}>
              取消
            </Button>
            <Button onClick={() => saveRule(ruleDialog as any)} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 模板编辑弹窗 */}
      <Dialog open={!!templateDialog} onOpenChange={() => setTemplateDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{(templateDialog as any)?.id ? '编辑模板' : '新建模板'}</DialogTitle>
            <DialogDescription>定义审校模板内容</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">模板名称</Label>
              <Input
                id="templateName"
                defaultValue={(templateDialog as any)?.name}
                placeholder="例如: 技术方案审校要点"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">分类</Label>
              <Select defaultValue={(templateDialog as any)?.category}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">技术类</SelectItem>
                  <SelectItem value="business">商务类</SelectItem>
                  <SelectItem value="legal">法务类</SelectItem>
                  <SelectItem value="finance">财务类</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateContent">模板内容</Label>
              <Textarea
                id="templateContent"
                defaultValue={(templateDialog as any)?.content}
                placeholder="输入审校要点清单，每行一个要点..."
                rows={10}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(null)}>
              取消
            </Button>
            <Button onClick={() => saveTemplate(templateDialog as any)} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

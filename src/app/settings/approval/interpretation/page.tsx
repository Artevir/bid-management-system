'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Settings,
  Plus,
  Edit2,
  Trash2,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
} from 'lucide-react';

interface ApprovalRule {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  levels: number;
  autoApprove: boolean;
  accuracyThreshold: number;
}

interface CommentTemplate {
  id: number;
  name: string;
  content: string;
  category: string;
}

const defaultRules: ApprovalRule[] = [
  {
    id: 1,
    name: '标准审核流程',
    description: '适用于一般招标文件解读的审核',
    enabled: true,
    levels: 1,
    autoApprove: false,
    accuracyThreshold: 80,
  },
  {
    id: 2,
    name: '快速通过',
    description: '准确率≥95%时自动通过',
    enabled: false,
    levels: 0,
    autoApprove: true,
    accuracyThreshold: 95,
  },
  {
    id: 3,
    name: '严格审核',
    description: '重要项目需要二级审核',
    enabled: false,
    levels: 2,
    autoApprove: false,
    accuracyThreshold: 90,
  },
];

const defaultTemplates: CommentTemplate[] = [
  { id: 1, name: '通过-格式正确', content: '文件格式规范，信息提取完整，审核通过', category: 'approve' },
  { id: 2, name: '通过-建议修改', content: '核心信息准确，建议补充XX材料后通过', category: 'approve' },
  { id: 3, name: '驳回-信息不全', content: '缺少关键信息（如项目预算、招标单位），请补充后重新提交', category: 'reject' },
  { id: 4, name: '驳回-格式错误', content: '文件格式不符合要求，请按模板重新整理后提交', category: 'reject' },
];

export default function InterpretationApprovalConfigPage() {
  const [rules, setRules] = useState<ApprovalRule[]>(defaultRules);
  const [templates, setTemplates] = useState<CommentTemplate[]>(defaultTemplates);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<CommentTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    levels: 1,
    autoApprove: false,
    accuracyThreshold: 80,
  });
  const [templateForm, setTemplateForm] = useState({
    name: '',
    content: '',
    category: 'approve',
  });

  useEffect(() => {
    fetchConfig();
    fetchTemplates();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/review/config');
      const data = await res.json();
      if (data.success && data.rules) {
        setRules(data.rules);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/review/templates?configType=interpretation');
      const data = await res.json();
      if (data.success && data.templates) {
        setTemplates(data.templates.map((t: any) => ({
          id: t.id,
          name: t.name,
          content: t.content,
          category: t.category,
        })));
      }
    } catch (error) {
      console.error('获取模板失败:', error);
    }
  };

  const handleOpenDialog = (rule?: ApprovalRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        levels: rule.levels,
        autoApprove: rule.autoApprove,
        accuracyThreshold: rule.accuracyThreshold,
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        enabled: true,
        levels: 1,
        autoApprove: false,
        accuracyThreshold: 80,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/review/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'interpretation',
          ...formData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDialogOpen(false);
        fetchConfig();
      }
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleToggle = async (rule: ApprovalRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    try {
      const res = await fetch('/api/review/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'interpretation', ...updated }),
      });
      const data = await res.json();
      if (data.success) {
        setRules(rules.map(r => r.id === rule.id ? updated : r));
      }
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该审核规则？')) return;
    try {
      const res = await fetch(`/api/review/config?type=interpretation&id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setRules(rules.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleOpenTemplateDialog = (template?: CommentTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        content: template.content,
        category: template.category,
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        name: '',
        content: '',
        category: 'approve',
      });
    }
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await fetch(`/api/review/templates?id=${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateForm),
        });
      } else {
        await fetch('/api/review/templates?configType=interpretation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateForm),
        });
      }
      fetchTemplates();
      setTemplateDialogOpen(false);
    } catch (error) {
      console.error('保存模板失败:', error);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确定删除该模板？')) return;
    try {
      await fetch(`/api/review/templates?id=${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (error) {
      console.error('删除模板失败:', error);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">解读审核配置</h1>
          <p className="text-muted-foreground">配置招标文件解读的审核规则</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          新增规则
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            审核规则配置
          </CardTitle>
          <CardDescription>
            配置多级审核规则、自动通过阈值等
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>规则名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>审核级别</TableHead>
                <TableHead>自动通过</TableHead>
                <TableHead>准确率阈值</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.description}</TableCell>
                  <TableCell>
                    {rule.levels === 0 ? (
                      <Badge variant="outline">自动</Badge>
                    ) : (
                      <Badge>{rule.levels} 级</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {rule.autoApprove ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> 是
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-4 h-4" /> 否
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{rule.accuracyThreshold}%</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`px-2 py-1 rounded text-xs ${
                        rule.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {rule.enabled ? '启用' : '禁用'}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(rule)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>审核级别</strong>：0级为自动审核，1级为单人审核，2级为二级审核</p>
          <p>• <strong>自动通过</strong>：当AI提取准确率≥阈值时自动通过审核</p>
          <p>• <strong>准确率阈值</strong>：设置自动通过的最低准确率要求</p>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? '编辑规则' : '新增规则'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>规则名称</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入规则名称"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="请输入规则描述"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>审核级别</Label>
                <Input
                  type="number"
                  min="0"
                  max="3"
                  value={formData.levels}
                  onChange={(e) => setFormData({ ...formData, levels: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>准确率阈值 (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.accuracyThreshold}
                  onChange={(e) => setFormData({ ...formData, accuracyThreshold: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoApprove"
                checked={formData.autoApprove}
                onChange={(e) => setFormData({ ...formData, autoApprove: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="autoApprove">启用自动通过</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审核意见模板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            审核意见模板
          </CardTitle>
          <CardDescription>预定义审核意见，快速填写</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={() => handleOpenTemplateDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              新增模板
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模板名称</TableHead>
                <TableHead>模板内容</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="max-w-md truncate">{template.content}</TableCell>
                  <TableCell>
                    <Badge variant={template.category === 'approve' ? 'default' : 'destructive'}>
                      {template.category === 'approve' ? '通过' : '驳回'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenTemplateDialog(template)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 模板编辑对话框 */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '编辑模板' : '新增模板'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>模板名称</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="请输入模板名称"
              />
            </div>
            <div className="space-y-2">
              <Label>模板内容</Label>
              <Textarea
                value={templateForm.content}
                onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                placeholder="请输入审核意见模板内容"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>类型</Label>
              <div className="flex gap-2">
                <Button
                  variant={templateForm.category === 'approve' ? 'default' : 'outline'}
                  onClick={() => setTemplateForm({ ...templateForm, category: 'approve' })}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  通过
                </Button>
                <Button
                  variant={templateForm.category === 'reject' ? 'destructive' : 'outline'}
                  onClick={() => setTemplateForm({ ...templateForm, category: 'reject' })}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  驳回
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveTemplate}>
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
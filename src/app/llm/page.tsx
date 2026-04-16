'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Tabs as _Tabs,
  TabsContent as _TabsContent,
  TabsList as _TabsList,
  TabsTrigger as _TabsTrigger,
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Search,
  Settings as _Settings,
  Trash2,
  Star,
  CheckCircle,
  XCircle,
  Cpu,
  Edit,
  Copy as _Copy,
  MessageSquare,
  BookOpen as _BookOpen,
  BarChart3,
} from 'lucide-react';

// 模型配置接口
interface LLMConfig {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  provider: string;
  modelId: string;
  apiEndpoint?: string | null;
  hasApiKey?: boolean;
  defaultTemperature: string;
  maxTokens: number;
  defaultThinking: boolean;
  defaultCaching: boolean;
  status: string;
  isDefault: boolean;
  lastUsedAt: string | null;
  scope: string;
  createdAt: string;
  creatorName: string | null;
}

// 详情接口返回（包含掩码后的 apiKey）
interface LLMConfigDetail extends LLMConfig {
  apiKey?: string | null;
  apiEndpoint?: string | null;
}

// 模型接口
interface Model {
  id: string;
  provider: string;
  name: string;
  description?: string;
  officialDocUrl?: string | null;
}

// 提供商配置
const providerConfig: Record<string, { label: string; color: string }> = {
  doubao: { label: '豆包', color: 'bg-blue-100 text-blue-700' },
  deepseek: { label: 'DeepSeek', color: 'bg-purple-100 text-purple-700' },
  qwen: { label: '千问', color: 'bg-orange-100 text-orange-700' },
  openai: { label: 'OpenAI', color: 'bg-green-100 text-green-700' },
  kimi: { label: 'Kimi', color: 'bg-cyan-100 text-cyan-700' },
  glm: { label: 'GLM', color: 'bg-pink-100 text-pink-700' },
  custom: { label: '自定义', color: 'bg-gray-100 text-gray-700' },
};

export default function LLMConfigsPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    provider: 'doubao',
    modelId: '',
    apiKey: '',
    apiEndpoint: '',
    defaultTemperature: '0.7',
    maxTokens: 4096,
    defaultThinking: false,
    defaultCaching: false,
  });

  useEffect(() => {
    loadModels();
    loadConfigs();
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [providerFilter, searchQuery]);

  const loadModels = async () => {
    try {
      const res = await fetch('/api/llm/configs?models=true');
      const data = await res.json();
      setModels(Array.isArray(data?.models) ? data.models : []);
    } catch (error) {
      console.error('加载模型列表失败:', error);
    }
  };

  const loadConfigs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (providerFilter !== 'all') {
        params.append('provider', providerFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/llm/configs?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data?.configs)) {
        // 客户端过滤搜索
        if (searchQuery) {
          setConfigs(
            data.configs.filter(
              (c: LLMConfig) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.modelId.toLowerCase().includes(searchQuery.toLowerCase())
            )
          );
        } else {
          setConfigs(data.configs);
        }
      } else setConfigs([]);
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      provider: 'doubao',
      modelId: '',
      apiKey: '',
      apiEndpoint: '',
      defaultTemperature: '0.7',
      maxTokens: 4096,
      defaultThinking: false,
      defaultCaching: false,
    });
    setDialogOpen(true);
  };

  const handleEdit = (config: LLMConfig) => {
    (async () => {
      setEditingConfig(config);
      try {
        const res = await fetch(`/api/llm/configs/${config.id}`);
        const data = await res.json();
        const fullConfig: LLMConfigDetail | null = data?.config || null;
        setFormData({
          name: config.name,
          code: config.code || '',
          description: config.description || '',
          provider: config.provider,
          modelId: config.modelId,
          apiKey: fullConfig?.apiKey ? String(fullConfig.apiKey) : '******',
          apiEndpoint: fullConfig?.apiEndpoint ? String(fullConfig.apiEndpoint) : '',
          defaultTemperature: config.defaultTemperature,
          maxTokens: config.maxTokens,
          defaultThinking: config.defaultThinking,
          defaultCaching: config.defaultCaching,
        });
      } catch {
        setFormData({
          name: config.name,
          code: config.code || '',
          description: config.description || '',
          provider: config.provider,
          modelId: config.modelId,
          apiKey: '******',
          apiEndpoint: config.apiEndpoint ? String(config.apiEndpoint) : '',
          defaultTemperature: config.defaultTemperature,
          maxTokens: config.maxTokens,
          defaultThinking: config.defaultThinking,
          defaultCaching: config.defaultCaching,
        });
      }
      setDialogOpen(true);
    })();
  };

  const handleSave = async () => {
    if (!formData.name || !formData.modelId) {
      alert('请填写必要信息');
      return;
    }

    try {
      const url = editingConfig ? `/api/llm/configs/${editingConfig.id}` : '/api/llm/configs';
      const method = editingConfig ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setDialogOpen(false);
        loadConfigs();
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此配置吗？')) return;

    try {
      const res = await fetch(`/api/llm/configs/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadConfigs();
      }
    } catch (error) {
      console.error('删除配置失败:', error);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      const res = await fetch(`/api/llm/configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setDefault' }),
      });
      const data = await res.json();
      if (data.success) {
        loadConfigs();
      }
    } catch (error) {
      console.error('设置默认配置失败:', error);
    }
  };

  // 根据提供商过滤模型
  const filteredModels = models.filter((m) => m.provider === formData.provider);
  const selectedModel = models.find((m) => m.id === formData.modelId);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">LLM 配置</h1>
          <p className="text-muted-foreground mt-1">
            管理大语言模型配置，支持豆包、DeepSeek、千问、OpenAI、Kimi等
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/llm/usage">
            <Button variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              用量统计
            </Button>
          </Link>
          <Link href="/llm/chat">
            <Button variant="outline">
              <MessageSquare className="h-4 w-4 mr-2" />
              对话测试
            </Button>
          </Link>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新建配置
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索配置..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部提供商</SelectItem>
                <SelectItem value="doubao">豆包</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="qwen">千问</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="kimi">Kimi</SelectItem>
                <SelectItem value="glm">GLM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 配置列表 */}
      {error ? (
        <ListStateBlock state="error" error={error} onRetry={loadModels} />
      ) : loading ? (
        <ListStateBlock state="loading" />
      ) : configs.length === 0 ? (
        <ListStateBlock state="empty" emptyText="暂无配置" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map((config) => (
            <Card key={config.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{config.name}</CardTitle>
                      {config.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          默认
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm mt-1">{config.modelId}</CardDescription>
                  </div>
                  <Badge variant="outline" className={providerConfig[config.provider]?.color || ''}>
                    {providerConfig[config.provider]?.label || config.provider}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  {config.description && <p className="line-clamp-2">{config.description}</p>}
                  <div className="flex items-center gap-4">
                    <span>Temperature: {config.defaultTemperature}</span>
                    <span>Max Tokens: {config.maxTokens}</span>
                  </div>
                  {config.apiEndpoint && (
                    <div className="text-xs text-muted-foreground break-all">
                      API: {config.apiEndpoint}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {config.defaultThinking && (
                      <Badge variant="outline" className="text-xs">
                        思考模式
                      </Badge>
                    )}
                    {config.defaultCaching && (
                      <Badge variant="outline" className="text-xs">
                        缓存
                      </Badge>
                    )}
                    {config.hasApiKey && (
                      <Badge variant="outline" className="text-xs">
                        Key已配置
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-1">
                    {config.status === 'active' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs text-gray-500">
                      {config.status === 'active' ? '已启用' : '已禁用'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!config.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(config.id)}
                        title="设为默认"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑配置对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingConfig ? '编辑配置' : '新建配置'}</DialogTitle>
            <DialogDescription>配置大语言模型参数，支持多种提供商</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">配置名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：豆包Pro"
                />
              </div>
              <div>
                <Label htmlFor="code">配置编码</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="选填"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="配置用途说明"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">提供商 *</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) =>
                    setFormData({ ...formData, provider: value, modelId: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doubao">豆包</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="qwen">千问</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="kimi">Kimi</SelectItem>
                    <SelectItem value="glm">GLM</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="modelId">模型 *</Label>
                <Select
                  value={formData.modelId}
                  onValueChange={(value) => setFormData({ ...formData, modelId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col">
                          <span>{model.name}</span>
                          {model.description && (
                            <span className="text-xs text-muted-foreground">
                              {model.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedModel?.officialDocUrl && (
              <div className="text-sm">
                <span className="text-muted-foreground">官方文档：</span>
                <Link
                  href={selectedModel.officialDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {selectedModel.officialDocUrl}
                </Link>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="必填（用于服务端调用），保存后仅显示掩码"
                />
              </div>
              <div>
                <Label htmlFor="apiEndpoint">API Endpoint</Label>
                <Input
                  id="apiEndpoint"
                  value={formData.apiEndpoint}
                  onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                  placeholder="如：https://api.openai.com 或自建网关地址"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  value={formData.defaultTemperature}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultTemperature: e.target.value,
                    })
                  }
                  placeholder="0.0-2.0"
                />
              </div>
              <div>
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={formData.maxTokens}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxTokens: parseInt(e.target.value) || 4096,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.defaultThinking}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, defaultThinking: checked })
                  }
                />
                <Label>思考模式</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.defaultCaching}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, defaultCaching: checked })
                  }
                />
                <Label>启用缓存</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

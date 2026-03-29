'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader as _CardHeader, CardTitle as _CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Star,
  StarOff,
  Cpu,
  Eye,
  Code,
  Image,
  Mic,
  FileAudio,
  Database,
  Shield,
  Bot,
} from 'lucide-react';

// 模型接口
interface Model {
  id: number;
  modelId: string;
  name: string;
  provider: string;
  modelType: string;
  description: string | null;
  tags: string[];
  contextWindow: number | null;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsFunctionCall: boolean;
  supportsStreaming: boolean;
  supportsThinking: boolean;
  supportsCaching: boolean;
  defaultTemperature: string;
  pricingInput: string | null;
  pricingOutput: string | null;
  releaseDate: string | null;
  deprecationDate: string | null;
  officialDocUrl: string | null;
  status: string;
  sortOrder: number;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
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

// 模型类型配置
const modelTypeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  chat: { label: '对话', icon: Bot },
  reasoning: { label: '推理', icon: Cpu },
  code: { label: '代码', icon: Code },
  image: { label: '图片', icon: Image },
  audio_tts: { label: '语音合成', icon: Mic },
  audio_stt: { label: '语音识别', icon: FileAudio },
  embedding: { label: '向量', icon: Database },
  moderation: { label: '审核', icon: Shield },
  vision: { label: '视觉', icon: Eye },
  multimodal: { label: '多模态', icon: Cpu },
};

// 状态配置
const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: '可用', color: 'bg-green-100 text-green-700' },
  deprecated_soon: { label: '即将废弃', color: 'bg-yellow-100 text-yellow-700' },
  deprecated: { label: '已废弃', color: 'bg-orange-100 text-orange-700' },
  inactive: { label: '已下架', color: 'bg-red-100 text-red-700' },
};

export default function ModelManagementPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [formData, setFormData] = useState({
    modelId: '',
    name: '',
    provider: 'openai',
    modelType: 'chat',
    description: '',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctionCall: true,
    supportsStreaming: true,
    supportsThinking: false,
    supportsCaching: false,
    defaultTemperature: '0.7',
    pricingInput: '',
    pricingOutput: '',
    officialDocUrl: '',
    status: 'active',
    sortOrder: 0,
    isFeatured: false,
  });

  // 加载模型列表
  const loadModels = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (providerFilter !== 'all') params.append('provider', providerFilter);
      if (typeFilter !== 'all') params.append('modelType', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('includeInactive', 'true');

      const response = await fetch(`/api/llm/models?${params.toString()}`);
      const data = await response.json();

      if (data.models) {
        setModels(data.models);
      }
    } catch (error) {
      console.error('加载模型失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, [providerFilter, typeFilter, statusFilter]);

  // 过滤搜索
  const filteredModels = searchQuery
    ? models.filter(
        (m) =>
          m.modelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : models;

  // 创建模型
  const handleCreate = () => {
    setEditingModel(null);
    setFormData({
      modelId: '',
      name: '',
      provider: 'openai',
      modelType: 'chat',
      description: '',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsVision: false,
      supportsFunctionCall: true,
      supportsStreaming: true,
      supportsThinking: false,
      supportsCaching: false,
      defaultTemperature: '0.7',
      pricingInput: '',
      pricingOutput: '',
      officialDocUrl: '',
      status: 'active',
      sortOrder: 0,
      isFeatured: false,
    });
    setDialogOpen(true);
  };

  // 编辑模型
  const handleEdit = (model: Model) => {
    setEditingModel(model);
    setFormData({
      modelId: model.modelId,
      name: model.name,
      provider: model.provider,
      modelType: model.modelType,
      description: model.description || '',
      contextWindow: model.contextWindow || 128000,
      maxOutputTokens: model.maxOutputTokens,
      supportsVision: model.supportsVision,
      supportsFunctionCall: model.supportsFunctionCall,
      supportsStreaming: model.supportsStreaming,
      supportsThinking: model.supportsThinking,
      supportsCaching: model.supportsCaching,
      defaultTemperature: model.defaultTemperature,
      pricingInput: model.pricingInput || '',
      pricingOutput: model.pricingOutput || '',
      officialDocUrl: model.officialDocUrl || '',
      status: model.status,
      sortOrder: model.sortOrder,
      isFeatured: model.isFeatured,
    });
    setDialogOpen(true);
  };

  // 保存模型
  const handleSave = async () => {
    if (!formData.modelId || !formData.name) {
      alert('请填写必要信息');
      return;
    }

    try {
      const url = editingModel
        ? `/api/llm/models/${encodeURIComponent(editingModel.modelId)}`
        : '/api/llm/models';
      const method = editingModel ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setDialogOpen(false);
        loadModels();
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  // 删除模型
  const handleDelete = async (modelId: string) => {
    if (!confirm('确定要删除这个模型吗？')) return;

    try {
      const response = await fetch(`/api/llm/models/${encodeURIComponent(modelId)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        loadModels();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  // 切换推荐状态
  const handleToggleFeatured = async (model: Model) => {
    try {
      const response = await fetch(`/api/llm/models/${encodeURIComponent(model.modelId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: !model.isFeatured }),
      });

      const data = await response.json();

      if (data.success) {
        loadModels();
      }
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  // 初始化默认模型
  const handleInitModels = async () => {
    if (!confirm('确定要初始化默认模型列表吗？这将添加预设的模型数据。')) return;

    try {
      const response = await fetch('/api/llm/models?init=true');
      const data = await response.json();

      if (data.models) {
        setModels(data.models);
        alert('初始化成功');
      }
    } catch (error) {
      console.error('初始化失败:', error);
      alert('初始化失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">模型管理</h1>
          <p className="text-muted-foreground mt-1">
            管理LLM模型列表，支持动态添加、编辑和删除模型配置
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleInitModels}>
            <RefreshCw className="h-4 w-4 mr-2" />
            初始化默认模型
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            添加模型
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
                placeholder="搜索模型..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="提供商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部提供商</SelectItem>
                {Object.entries(providerConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(modelTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 模型列表 */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Cpu className="h-12 w-12 mx-auto mb-4" />
              <p>暂无模型数据</p>
              <Button variant="outline" className="mt-4" onClick={handleInitModels}>
                初始化默认模型
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模型ID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>提供商</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>推荐</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((model) => {
                  const typeConfig = modelTypeConfig[model.modelType] || { label: model.modelType, icon: Cpu };
                  const TypeIcon = typeConfig.icon;
                  const statusConf = statusConfig[model.status] || statusConfig.active;

                  return (
                    <TableRow key={model.id}>
                      <TableCell className="font-mono text-sm">{model.modelId}</TableCell>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell>
                        <Badge className={providerConfig[model.provider]?.color || 'bg-gray-100'}>
                          {providerConfig[model.provider]?.label || model.provider}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TypeIcon className="h-3 w-3" />
                          <span className="text-sm">{typeConfig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {model.description}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConf.color}>{statusConf.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFeatured(model)}
                        >
                          {model.isFeatured ? (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          ) : (
                            <StarOff className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(model)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(model.modelId)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑模型对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingModel ? '编辑模型' : '添加模型'}</DialogTitle>
            <DialogDescription>
              配置LLM模型参数，支持多种提供商和模型类型
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="modelId">模型ID *</Label>
                <Input
                  id="modelId"
                  value={formData.modelId}
                  onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                  placeholder="如：gpt-5.4"
                  disabled={!!editingModel}
                />
              </div>
              <div>
                <Label htmlFor="name">显示名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：GPT-5.4"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">提供商 *</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) => setFormData({ ...formData, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(providerConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="modelType">模型类型 *</Label>
                <Select
                  value={formData.modelType}
                  onValueChange={(value) => setFormData({ ...formData, modelType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modelTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="模型用途说明"
                rows={2}
              />
            </div>

            {/* 技术规格 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contextWindow">上下文窗口</Label>
                <Input
                  id="contextWindow"
                  type="number"
                  value={formData.contextWindow}
                  onChange={(e) =>
                    setFormData({ ...formData, contextWindow: parseInt(e.target.value) || 0 })
                  }
                  placeholder="如：128000"
                />
              </div>
              <div>
                <Label htmlFor="maxOutputTokens">最大输出Token</Label>
                <Input
                  id="maxOutputTokens"
                  type="number"
                  value={formData.maxOutputTokens}
                  onChange={(e) =>
                    setFormData({ ...formData, maxOutputTokens: parseInt(e.target.value) || 4096 })
                  }
                />
              </div>
            </div>

            {/* 功能支持 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.supportsVision}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, supportsVision: checked })
                  }
                />
                <Label>支持视觉</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.supportsFunctionCall}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, supportsFunctionCall: checked })
                  }
                />
                <Label>函数调用</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.supportsStreaming}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, supportsStreaming: checked })
                  }
                />
                <Label>流式输出</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.supportsThinking}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, supportsThinking: checked })
                  }
                />
                <Label>思考模式</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.supportsCaching}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, supportsCaching: checked })
                  }
                />
                <Label>缓存支持</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isFeatured: checked })
                  }
                />
                <Label>推荐模型</Label>
              </div>
            </div>

            {/* 定价信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pricingInput">输入价格 ($/百万Token)</Label>
                <Input
                  id="pricingInput"
                  value={formData.pricingInput}
                  onChange={(e) => setFormData({ ...formData, pricingInput: e.target.value })}
                  placeholder="如：2.50"
                />
              </div>
              <div>
                <Label htmlFor="pricingOutput">输出价格 ($/百万Token)</Label>
                <Input
                  id="pricingOutput"
                  value={formData.pricingOutput}
                  onChange={(e) => setFormData({ ...formData, pricingOutput: e.target.value })}
                  placeholder="如：10.00"
                />
              </div>
            </div>

            {/* 其他配置 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sortOrder">排序权重</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="officialDocUrl">官方文档链接</Label>
              <Input
                id="officialDocUrl"
                value={formData.officialDocUrl}
                onChange={(e) => setFormData({ ...formData, officialDocUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

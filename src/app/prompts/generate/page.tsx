'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Play,
  Copy,
  Download,
  FileText,
  History,
  Settings,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

interface PromptTemplate {
  id: number;
  name: string;
  code: string;
  description?: string;
  categoryId?: number;
  category?: { name: string };
  content: string;
  systemPrompt?: string;
  modelProvider?: string;
  modelName?: string;
  temperature?: string;
  maxTokens?: number;
  status: string;
  parameters?: PromptParameter[];
}

interface PromptParameter {
  id: number;
  name: string;
  code: string;
  type: string;
  defaultValue?: string;
  description?: string;
  required: boolean;
}

interface GenerationHistory {
  id: number;
  templateId: number;
  template?: PromptTemplate;
  content: string;
  parameters: Record<string, string>;
  tokensUsed?: number;
  createdAt: string;
}

export default function SchemeGeneratePage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  // Parameters
  const [parameters, setParameters] = useState<Record<string, string>>({});
  
  // Generation
  const [generating, setGenerating] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  
  // Advanced settings
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customSettings, setCustomSettings] = useState({
    modelProvider: '',
    modelName: '',
    temperature: '0.7',
    maxTokens: '4096',
  });

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedTemplate?.parameters) {
      const defaults: Record<string, string> = {};
      selectedTemplate.parameters.forEach((param) => {
        defaults[param.code] = param.defaultValue || '';
      });
      setParameters(defaults);
      
      // Reset custom settings to template defaults
      setCustomSettings({
        modelProvider: selectedTemplate.modelProvider || '',
        modelName: selectedTemplate.modelName || '',
        temperature: selectedTemplate.temperature || '0.7',
        maxTokens: String(selectedTemplate.maxTokens || 4096),
      });
    }
  }, [selectedTemplate]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'published');
      if (selectedCategoryId) params.set('categoryId', selectedCategoryId);
      
      const res = await fetch(`/api/prompts/templates?${params.toString()}`);
      const data = await res.json();
      
      if (data.items) {
        setTemplates(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/prompts/categories');
      const data = await res.json();
      if (data.items) {
        setCategories(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    
    setGenerating(true);
    setGeneratedContent('');
    setStreaming(true);

    try {
      const response = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          parameters,
          modelProvider: customSettings.modelProvider || undefined,
          modelName: customSettings.modelName || undefined,
          temperature: customSettings.temperature,
          maxTokens: parseInt(customSettings.maxTokens),
          stream: true,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content') {
                  setGeneratedContent((prev) => prev + data.content);
                } else if (data.type === 'done') {
                  setStreaming(false);
                } else if (data.type === 'error') {
                  console.error('Generation error:', data.error);
                  setStreaming(false);
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate:', error);
    } finally {
      setGenerating(false);
      setStreaming(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `方案_${selectedTemplate?.name}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setGeneratedContent('');
    if (selectedTemplate?.parameters) {
      const defaults: Record<string, string> = {};
      selectedTemplate.parameters.forEach((param) => {
        defaults[param.code] = param.defaultValue || '';
      });
      setParameters(defaults);
    }
  };

  const getModelProviderLabel = (provider?: string) => {
    const labels: Record<string, string> = {
      doubao: '豆包',
      deepseek: 'DeepSeek',
      qwen: '千问',
      wenxin: '文心一言',
      spark: '讯飞星火',
    };
    return labels[provider || ''] || provider || '默认';
  };

  const filteredTemplates = selectedCategoryId
    ? templates.filter((t) => t.categoryId === parseInt(selectedCategoryId))
    : templates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">方案生成</h1>
          <p className="text-muted-foreground">基于提示词模板生成方案内容</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel - Template Selection & Parameters */}
        <div className="col-span-4 space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">选择模板</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>分类筛选</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部分类</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>模板</Label>
                {loading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select 
                    value={selectedTemplate?.id?.toString() || ''} 
                    onValueChange={(v) => {
                      const template = templates.find((t) => t.id === parseInt(v));
                      setSelectedTemplate(template || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模板" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>{template.name}</span>
                            {template.category && (
                              <Badge variant="outline" className="text-xs">
                                {template.category.name}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {selectedTemplate && (
                <div className="text-sm text-muted-foreground">
                  <p>{selectedTemplate.description}</p>
                  <p className="mt-2">
                    模型: {getModelProviderLabel(selectedTemplate.modelProvider)}
                    {selectedTemplate.modelName && ` / ${selectedTemplate.modelName}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parameters */}
          {selectedTemplate?.parameters && selectedTemplate.parameters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">参数配置</CardTitle>
                <CardDescription>
                  填写模板参数，系统将自动渲染生成提示词
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTemplate.parameters.map((param) => (
                  <div key={param.id} className="space-y-2">
                    <Label>
                      {param.name}
                      {param.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {param.type === 'textarea' ? (
                      <Textarea
                        value={parameters[param.code] || ''}
                        onChange={(e) => setParameters({ ...parameters, [param.code]: e.target.value })}
                        placeholder={param.description}
                        className="min-h-[100px]"
                      />
                    ) : param.type === 'number' ? (
                      <Input
                        type="number"
                        value={parameters[param.code] || ''}
                        onChange={(e) => setParameters({ ...parameters, [param.code]: e.target.value })}
                        placeholder={param.description}
                      />
                    ) : (
                      <Input
                        value={parameters[param.code] || ''}
                        onChange={(e) => setParameters({ ...parameters, [param.code]: e.target.value })}
                        placeholder={param.description}
                      />
                    )}
                    {param.description && (
                      <p className="text-xs text-muted-foreground">{param.description}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Advanced Settings */}
          <Card>
            <CardHeader 
              className="cursor-pointer" 
              onClick={() => setAdvancedOpen(!advancedOpen)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">高级设置</CardTitle>
                {advancedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
            {advancedOpen && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>模型提供商</Label>
                    <Select 
                      value={customSettings.modelProvider} 
                      onValueChange={(v) => setCustomSettings({ ...customSettings, modelProvider: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="使用模板默认" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">使用模板默认</SelectItem>
                        <SelectItem value="doubao">豆包</SelectItem>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="qwen">千问</SelectItem>
                        <SelectItem value="wenxin">文心一言</SelectItem>
                        <SelectItem value="spark">讯飞星火</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>模型名称</Label>
                    <Input
                      value={customSettings.modelName}
                      onChange={(e) => setCustomSettings({ ...customSettings, modelName: e.target.value })}
                      placeholder="如：doubao-pro-32k"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>温度</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={customSettings.temperature}
                      onChange={(e) => setCustomSettings({ ...customSettings, temperature: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>最大令牌</Label>
                    <Input
                      type="number"
                      value={customSettings.maxTokens}
                      onChange={(e) => setCustomSettings({ ...customSettings, maxTokens: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              className="flex-1" 
              onClick={handleGenerate} 
              disabled={!selectedTemplate || generating}
            >
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  开始生成
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              重置
            </Button>
          </div>
        </div>

        {/* Right Panel - Generated Content */}
        <div className="col-span-8">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">生成结果</CardTitle>
                <CardDescription>
                  {selectedTemplate 
                    ? `基于模板"${selectedTemplate.name}"生成`
                    : '请先选择模板'
                  }
                </CardDescription>
              </div>
              {generatedContent && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    复制
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    下载
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="result">
                <TabsList>
                  <TabsTrigger value="result">生成结果</TabsTrigger>
                  {showPreview && selectedTemplate && (
                    <TabsTrigger value="preview">提示词预览</TabsTrigger>
                  )}
                </TabsList>
                
                <TabsContent value="result" className="mt-4">
                  {generating || generatedContent ? (
                    <div className="bg-muted p-4 rounded-lg min-h-[500px] whitespace-pre-wrap font-mono text-sm overflow-auto">
                      {generatedContent}
                      {streaming && <span className="animate-pulse">▌</span>}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                      <Sparkles className="h-16 w-16 mb-4 opacity-50" />
                      <p>选择模板并填写参数后，点击"开始生成"</p>
                    </div>
                  )}
                </TabsContent>
                
                {showPreview && selectedTemplate && (
                  <TabsContent value="preview" className="mt-4">
                    <div className="space-y-4">
                      {selectedTemplate.systemPrompt && (
                        <div>
                          <h4 className="font-medium mb-2">系统提示词</h4>
                          <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap overflow-auto">
                            {selectedTemplate.systemPrompt}
                          </pre>
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium mb-2">用户提示词</h4>
                        <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap overflow-auto">
                          {renderTemplatePreview(selectedTemplate.content, parameters)}
                        </pre>
                      </div>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper function to render template preview with parameters
function renderTemplatePreview(template: string, parameters: Record<string, string>): string {
  let result = template;
  Object.entries(parameters).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || `[${key}]`);
  });
  return result;
}

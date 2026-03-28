'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Target,
  Bot,
  Image as ImageIcon,
  Loader2,
  Download,
  RefreshCw,
  Settings,
  Palette,
} from 'lucide-react';
import { IMAGE_TYPE_CONFIG } from '@/lib/image/constants';
import { type ImageType, type ImageSize, type GenerateMode } from '@/lib/image/service';

// 图片类型分组
const IMAGE_TYPE_GROUPS = [
  { label: '组织管理', types: ['org_chart', 'dept_chart', 'role_chart'] },
  { label: '逻辑梳理', types: ['mind_map', 'flowchart'] },
  { label: '流程图专项', types: ['flowchart_it_ops', 'flowchart_bidding', 'flowchart_project', 'flowchart_construction', 'flowchart_approval'] },
  { label: '项目进度', types: ['gantt_chart', 'milestone_chart', 'progress_chart'] },
  { label: '技术架构', types: ['topology', 'architecture', 'device_layout'] },
  { label: '数据可视化', types: ['bar_chart', 'line_chart', 'pie_chart', 'heatmap'] },
  { label: '其他', types: ['icon_set', 'diagram', 'other'] },
];

// 尺寸选项
const SIZE_OPTIONS = [
  { value: '2K', label: '2K', desc: '2560×1440' },
  { value: '4K', label: '4K', desc: '3840×2160' },
  { value: 'A4_LANDSCAPE', label: 'A4 横向', desc: '适合投标文件' },
  { value: 'RATIO_16_9', label: '16:9', desc: '宽屏比例' },
];

// 示例提示词
const EXAMPLE_PROMPTS: Record<string, string[]> = {
  flowchart_it_ops: ['生成IT运维故障响应流程图，包含客户、客户服务热线、项目经理、技术负责人、现场工程师，流程：客户反馈→热线转接→填写case表单→技术分配→故障处理→满意度调查'],
  flowchart_bidding: ['生成投标文件编制流程图，节点：需求对接→资料收集→初稿编制→审核修改→定稿打印'],
  org_chart: ['生成项目团队组织架构图，包含项目经理、技术负责人、商务负责人'],
  gantt_chart: ['生成项目甘特图，包含需求分析、方案设计、开发实施、测试验收四阶段'],
};

export default function ImageGeneratePage() {
  const [mode, setMode] = useState<GenerateMode>('quick');
  const [imageType, setImageType] = useState<ImageType>('flowchart');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ImageSize>('2K');
  const [style, setStyle] = useState('简洁商务');
  const [colorScheme, setColorScheme] = useState('蓝白商务风');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; imageId?: number; imageUrl?: string; error?: string } | null>(null);

  const currentExamples = EXAMPLE_PROMPTS[imageType] || [];

  const handleGenerate = async () => {
    if (!prompt.trim()) { alert('请输入提示词'); return; }
    setGenerating(true);
    setResult(null);
    try {
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageType, generateMode: mode, size, style, colorScheme }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: '网络错误' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.imageUrl) return;
    const response = await fetch(result.imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image_${Date.now()}.png`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI 图片生成</h1>
        <p className="text-muted-foreground mt-1">支持组织架构图、流程图、甘特图、拓扑图等多种专业图片生成</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* 生成模式 */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">生成模式</CardTitle></CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as GenerateMode)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="quick"><Zap className="h-4 w-4 mr-1" />快速</TabsTrigger>
                  <TabsTrigger value="precise"><Target className="h-4 w-4 mr-1" />精准</TabsTrigger>
                  <TabsTrigger value="agent"><Bot className="h-4 w-4 mr-1" />角色</TabsTrigger>
                </TabsList>
                <TabsContent value="quick" className="mt-3 text-sm text-muted-foreground">选择类型，输入需求，快速生成</TabsContent>
                <TabsContent value="precise" className="mt-3 text-sm text-muted-foreground">详细提示词，精准控制细节</TabsContent>
                <TabsContent value="agent" className="mt-3 text-sm text-muted-foreground">AI角色自动生成专业图片</TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* 图片类型 */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">图片类型</CardTitle></CardHeader>
            <CardContent>
              <Select value={imageType} onValueChange={(v) => setImageType(v as ImageType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {IMAGE_TYPE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
                      {group.types.map((type) => {
                        const config = IMAGE_TYPE_CONFIG[type];
                        return (
                          <SelectItem key={type} value={type}>
                            <span>{config?.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">{config?.description}</span>
                          </SelectItem>
                        );
                      })}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              {IMAGE_TYPE_CONFIG[imageType] && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline">{IMAGE_TYPE_CONFIG[imageType].category}</Badge>
                  <p className="text-sm text-muted-foreground mt-1">{IMAGE_TYPE_CONFIG[imageType].description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 提示词 */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">提示词</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="请输入图片描述..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} />
              {currentExamples.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentExamples.map((ex, i) => (
                    <Button key={i} variant="outline" size="sm" onClick={() => setPrompt(ex)}>示例{i + 1}</Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 参数 */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" />参数设置</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>尺寸</Label>
                <Select value={size} onValueChange={(v) => setSize(v as ImageSize)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label} ({opt.desc})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-2"><Palette className="h-4 w-4" />配色</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['蓝白商务风', '绿色科技风', '灰色简约风'].map((c) => (
                    <Button key={c} variant={colorScheme === c ? 'default' : 'outline'} size="sm" onClick={() => setColorScheme(c)}>{c}</Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={handleGenerate} disabled={generating || !prompt.trim()}>
            {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />生成中...</> : <><ImageIcon className="h-4 w-4 mr-2" />生成图片</>}
          </Button>
        </div>

        {/* 预览 */}
        <Card className="min-h-[500px]">
          <CardHeader><CardTitle className="text-base">生成结果</CardTitle></CardHeader>
          <CardContent>
            {generating ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">图片生成中，预计30-60秒...</p>
              </div>
            ) : result?.success && result.imageUrl ? (
              <div className="space-y-4">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img src={result.imageUrl} alt="生成图片" className="w-full h-full object-contain" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleGenerate}><RefreshCw className="h-4 w-4 mr-2" />重新生成</Button>
                  <Button onClick={handleDownload}><Download className="h-4 w-4 mr-2" />下载</Button>
                </div>
              </div>
            ) : result?.error ? (
              <div className="flex flex-col items-center justify-center py-20 text-destructive">
                <ImageIcon className="h-12 w-12 mb-4" />
                <p>生成失败: {result.error}</p>
                <Button variant="outline" className="mt-4" onClick={handleGenerate}>重试</Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-4" />
                <p>输入提示词后点击生成</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

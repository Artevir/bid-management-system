'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Building, Tag, Bot } from 'lucide-react';

interface AIConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: any) => void;
  templates: any[];
  companies: any[];
  availableTags: any[];
}

export function AIConfigDialog({
  open,
  onOpenChange,
  onGenerate,
  templates,
  companies,
  availableTags,
}: AIConfigDialogProps) {
  const [config, setConfig] = useState({
    style: 'formal',
    useKnowledge: true,
    templateId: '',
    parameters: {} as Record<string, string>,
    companyId: '',
    tags: [] as string[],
  });

  const handleGenerate = () => {
    onGenerate(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI 内容生成配置
          </DialogTitle>
          <DialogDescription>
            配置 AI 生成的参考信息和风格，以获得更准确的投标内容。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* 提示词模板 */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              提示词模板
            </Label>
            <Select 
              value={config.templateId} 
              onValueChange={(val) => setConfig({ ...config, templateId: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择生成模板..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 参考公司 */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              参考公司信息
            </Label>
            <Select 
              value={config.companyId} 
              onValueChange={(val) => setConfig({ ...config, companyId: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择参考公司..." />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 知识库与风格 */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label>使用企业知识库</Label>
              <p className="text-xs text-muted-foreground">从历史标书中检索相关素材</p>
            </div>
            <Switch 
              checked={config.useKnowledge} 
              onCheckedChange={(val) => setConfig({ ...config, useKnowledge: val })} 
            />
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              参考标签
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={config.tags.includes(tag.id.toString()) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    const newTags = config.tags.includes(tag.id.toString())
                      ? config.tags.filter(id => id !== tag.id.toString())
                      : [...config.tags, tag.id.toString()];
                    setConfig({ ...config, tags: newTags });
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleGenerate}>开始生成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

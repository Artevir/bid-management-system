'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Loader2,
  FileText,
  Building2,
  Layers,
  Merge,
  ChevronRight,
  ChevronDown as _ChevronDown,
  CheckCircle as _CheckCircle,
  AlertCircle as _AlertCircle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// 类型定义
// ============================================

interface TenderFramework {
  id: number;
  type: 'tender';
  name: string;
  chapterCount: number;
  createdAt: string;
}

interface CompanyFramework {
  id: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  sourceType: string;
  createdAt: string;
}

interface CompanyWithFrameworks {
  companyId: number;
  companyName: string;
  frameworks: CompanyFramework[];
}

interface AvailableFrameworks {
  tenderFrameworks: TenderFramework[];
  companyFrameworks: CompanyWithFrameworks[];
}

interface MergedChapter {
  id: number;
  title: string;
  titleNumber: string | null;
  level: number;
  isRequired: boolean;
  source?: 'tender' | 'company' | 'merged';
  sourceCompanyName?: string;
  children?: MergedChapter[];
}

interface MergedFramework {
  name: string;
  chapters: MergedChapter[];
  stats: {
    totalChapters: number;
    tenderChapters: number;
    companyChapters: number;
    mergedChapters: number;
  };
  details: {
    tenderFramework?: { id: number; name: string };
    companyFrameworks: Array<{ id: number; name: string; companyName: string }>;
  };
}

// ============================================
// 组件
// ============================================

interface CreateBidDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
  onSuccess?: (documentId: number) => void;
}

export function CreateBidDocumentDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSuccess,
}: CreateBidDocumentDialogProps) {
  const router = useRouter();

  // 状态
  const [step, setStep] = useState<'select' | 'preview' | 'creating'>('select');
  const [loading, setLoading] = useState(false);
  const [availableFrameworks, setAvailableFrameworks] = useState<AvailableFrameworks | null>(null);
  const [mergedResult, setMergedResult] = useState<MergedFramework | null>(null);

  // 表单数据
  const [documentName, setDocumentName] = useState(`${projectName} - 投标文件`);
  const [selectedTenderFramework, setSelectedTenderFramework] = useState<string>('');
  const [selectedCompanyFrameworks, setSelectedCompanyFrameworks] = useState<number[]>([]);
  const [mergeStrategy, setMergeStrategy] = useState<'tender_first' | 'company_first' | 'smart_merge'>('smart_merge');

  // 加载可用框架
  useEffect(() => {
    if (open && projectId) {
      loadAvailableFrameworks();
    }
  }, [open, projectId]);

  const loadAvailableFrameworks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bid/frameworks/merge?projectId=${projectId}`);
      const data = await res.json();
      if (data.success) {
        setAvailableFrameworks(data.data);

        // 默认选择第一个招标文件框架
        if (data.data.tenderFrameworks.length > 0) {
          setSelectedTenderFramework(String(data.data.tenderFrameworks[0].id));
        }

        // 默认选择每个公司的默认框架
        const defaultFrameworks: number[] = [];
        data.data.companyFrameworks.forEach((company: CompanyWithFrameworks) => {
          const defaultFw = company.frameworks.find((f) => f.isDefault);
          if (defaultFw) {
            defaultFrameworks.push(defaultFw.id);
          }
        });
        setSelectedCompanyFrameworks(defaultFrameworks);
      }
    } catch (error) {
      console.error('Load frameworks error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewMerge = async () => {
    if (selectedCompanyFrameworks.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/bid/frameworks/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderInterpretationId: selectedTenderFramework ? parseInt(selectedTenderFramework) : undefined,
          companyFrameworkIds: selectedCompanyFrameworks,
          mergeStrategy,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMergedResult(data.data);
        setStep('preview');
      }
    } catch (error) {
      console.error('Preview merge error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async () => {
    if (!mergedResult) return;

    setStep('creating');
    try {
      const res = await fetch('/api/bid/documents/create-from-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          documentName,
          tenderInterpretationId: selectedTenderFramework ? parseInt(selectedTenderFramework) : undefined,
          companyFrameworkIds: selectedCompanyFrameworks,
          mergeStrategy,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess?.(data.documentId);
        onOpenChange(false);
        router.push(`/bid-documents/${data.documentId}`);
      }
    } catch (error) {
      console.error('Create document error:', error);
      setStep('preview');
    }
  };

  const toggleCompanyFramework = (frameworkId: number) => {
    setSelectedCompanyFrameworks((prev) =>
      prev.includes(frameworkId)
        ? prev.filter((id) => id !== frameworkId)
        : [...prev, frameworkId]
    );
  };

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'tender':
        return <FileText className="h-3 w-3 text-blue-500" />;
      case 'company':
        return <Building2 className="h-3 w-3 text-green-500" />;
      case 'merged':
        return <Merge className="h-3 w-3 text-purple-500" />;
      default:
        return <Layers className="h-3 w-3 text-gray-400" />;
    }
  };

  const renderChapterTree = (chapters: MergedChapter[], depth = 0) => {
    return chapters.map((chapter, index) => (
      <div key={`${chapter.id}-${index}`} className="select-none">
        <div
          className={cn(
            'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50',
            depth > 0 && 'ml-4'
          )}
        >
          {chapter.children && chapter.children.length > 0 ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          ) : (
            <span className="w-3" />
          )}
          {getSourceIcon(chapter.source)}
          <span className="text-sm">
            {chapter.titleNumber && (
              <span className="text-muted-foreground mr-1">{chapter.titleNumber}</span>
            )}
            {chapter.title}
          </span>
          {chapter.isRequired && (
            <Badge variant="outline" className="text-xs h-4">
              必须
            </Badge>
          )}
          {chapter.sourceCompanyName && (
            <Badge variant="secondary" className="text-xs h-4">
              {chapter.sourceCompanyName}
            </Badge>
          )}
        </div>
        {chapter.children && chapter.children.length > 0 && (
          <div>{renderChapterTree(chapter.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            创建投标文件
          </DialogTitle>
          <DialogDescription>
            选择文档框架，合并生成投标文件目录结构
          </DialogDescription>
        </DialogHeader>

        {loading && step !== 'creating' ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : step === 'select' ? (
          <>
            <div className="flex-1 overflow-auto space-y-6">
              {/* 文档名称 */}
              <div className="space-y-2">
                <Label htmlFor="documentName">文档名称</Label>
                <Input
                  id="documentName"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="请输入文档名称"
                />
              </div>

              {/* 招标文件框架 */}
              {availableFrameworks?.tenderFrameworks && availableFrameworks.tenderFrameworks.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      招标文件框架
                    </CardTitle>
                    <CardDescription>
                      从招标文件解读中提取的文档框架
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={selectedTenderFramework}
                      onValueChange={setSelectedTenderFramework}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择招标文件框架（可选）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">不使用招标文件框架</SelectItem>
                        {availableFrameworks.tenderFrameworks.map((fw) => (
                          <SelectItem key={fw.id} value={String(fw.id)}>
                            {fw.name} ({fw.chapterCount} 个章节)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}

              {/* 公司文档框架 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-green-500" />
                    公司文档框架
                  </CardTitle>
                  <CardDescription>
                    选择要合并的公司文档框架（至少选择一个）
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {availableFrameworks?.companyFrameworks.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      暂无公司文档框架，请先创建
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {availableFrameworks?.companyFrameworks.map((company) => (
                        <div key={company.companyId} className="space-y-2">
                          <div className="font-medium text-sm flex items-center gap-2">
                            <Building2 className="h-3 w-3" />
                            {company.companyName}
                          </div>
                          <div className="grid grid-cols-2 gap-2 ml-5">
                            {company.frameworks.map((fw) => (
                              <label
                                key={fw.id}
                                className={cn(
                                  'flex items-start gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50',
                                  selectedCompanyFrameworks.includes(fw.id) &&
                                    'border-primary bg-primary/5'
                                )}
                              >
                                <Checkbox
                                  checked={selectedCompanyFrameworks.includes(fw.id)}
                                  onCheckedChange={() => toggleCompanyFramework(fw.id)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {fw.name}
                                    {fw.isDefault && (
                                      <Badge variant="secondary" className="ml-1 text-xs">
                                        默认
                                      </Badge>
                                    )}
                                  </div>
                                  {fw.description && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {fw.description}
                                    </div>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 合并策略 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Merge className="h-4 w-4 text-purple-500" />
                    合并策略
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={mergeStrategy}
                    onValueChange={(v) => setMergeStrategy(v as typeof mergeStrategy)}
                    className="space-y-2"
                  >
                    <label className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary">
                      <RadioGroupItem value="tender_first" />
                      <div>
                        <div className="font-medium text-sm">招标框架优先</div>
                        <div className="text-xs text-muted-foreground">
                          以招标文件框架为基础，补充公司独特章节
                        </div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary">
                      <RadioGroupItem value="company_first" />
                      <div>
                        <div className="font-medium text-sm">公司框架优先</div>
                        <div className="text-xs text-muted-foreground">
                          以公司框架为基础，前置招标必要章节
                        </div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary">
                      <RadioGroupItem value="smart_merge" />
                      <div>
                        <div className="font-medium text-sm">智能合并</div>
                        <div className="text-xs text-muted-foreground">
                          根据章节标题相似度智能合并相同主题
                        </div>
                      </div>
                    </label>
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={handlePreviewMerge}
                disabled={selectedCompanyFrameworks.length === 0}
              >
                预览合并结果
              </Button>
            </DialogFooter>
          </>
        ) : step === 'preview' && mergedResult ? (
          <>
            <div className="flex-1 overflow-auto space-y-4">
              {/* 合并统计 */}
              <div className="grid grid-cols-4 gap-3">
                <Card className="p-3">
                  <div className="text-2xl font-bold">{mergedResult.stats.totalChapters}</div>
                  <div className="text-xs text-muted-foreground">总章节数</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-blue-500">{mergedResult.stats.tenderChapters}</div>
                  <div className="text-xs text-muted-foreground">招标文件章节</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-green-500">{mergedResult.stats.companyChapters}</div>
                  <div className="text-xs text-muted-foreground">公司框架章节</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-purple-500">{mergedResult.stats.mergedChapters}</div>
                  <div className="text-xs text-muted-foreground">合并章节</div>
                </Card>
              </div>

              <Separator />

              {/* 章节预览 */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">章节结构预览</h4>
                <ScrollArea className="h-[300px] border rounded-lg p-2">
                  {renderChapterTree(mergedResult.chapters)}
                </ScrollArea>
              </div>

              {/* 来源信息 */}
              <div className="text-xs text-muted-foreground">
                <div className="font-medium mb-1">合并来源：</div>
                <div className="flex flex-wrap gap-2">
                  {mergedResult.details.tenderFramework && (
                    <Badge variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1 text-blue-500" />
                      {mergedResult.details.tenderFramework.name}
                    </Badge>
                  )}
                  {mergedResult.details.companyFrameworks.map((fw) => (
                    <Badge key={fw.id} variant="outline" className="text-xs">
                      <Building2 className="h-3 w-3 mr-1 text-green-500" />
                      {fw.companyName}: {fw.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select')}>
                返回修改
              </Button>
              <Button onClick={handleCreateDocument}>
                创建投标文件
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-muted-foreground">正在创建投标文件...</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CreateBidDocumentDialog;

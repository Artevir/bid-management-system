'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Sparkles, Building2, Users, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OneClickGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  interpretationId: number;
  interpretationName?: string;
  onSuccess?: (documentId: number) => void;
}

interface DataSource {
  companies: Array<{
    id: number;
    name: string;
    code: string;
    type: string;
  }>;
  partnerApplications: Array<{
    id: number;
    partnerCompanyName: string;
    status: string;
    createdAt: string;
  }>;
}

export function OneClickGenerateDialog({
  open,
  onOpenChange,
  projectId,
  interpretationId,
  interpretationName,
  onSuccess,
}: OneClickGenerateDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [dataSources, setDataSources] = useState<DataSource | null>(null);
  const [loadingDataSources, setLoadingDataSources] = useState(false);

  // 表单状态
  const [documentName, setDocumentName] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<number[]>([]);
  const [selectedPartnerApps, setSelectedPartnerApps] = useState<number[]>([]);
  const [generateOptions, setGenerateOptions] = useState({
    includeQualification: true,
    includePerformance: true,
    includeTechnical: true,
    includeBusiness: true,
    style: 'formal' as 'formal' | 'technical' | 'concise',
  });

  // 加载数据源
  useEffect(() => {
    if (open && projectId) {
      loadDataSources();
    }
  }, [open, projectId]);

  const loadDataSources = async () => {
    setLoadingDataSources(true);
    try {
      const response = await fetch(`/api/bid/documents/data-sources?projectId=${projectId}`);
      const result = await response.json();
      if (result.success) {
        setDataSources(result.data);
      }
    } catch (error) {
      console.error('Load data sources error:', error);
    } finally {
      setLoadingDataSources(false);
    }
  };

  const handleCompanyToggle = (companyId: number) => {
    setSelectedCompanies((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  };

  const handlePartnerAppToggle = (appId: number) => {
    setSelectedPartnerApps((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  };

  const handleGenerate = async () => {
    if (!documentName.trim()) {
      toast({
        title: '请输入文档名称',
        variant: 'destructive',
      });
      return;
    }

    if (selectedCompanies.length === 0) {
      toast({
        title: '请选择至少一个投标主体',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/bid/documents/one-click-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          documentName,
          interpretationId,
          companyIds: selectedCompanies,
          partnerApplicationIds: selectedPartnerApps,
          generateOptions,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: '生成成功',
          description: `已生成 ${result.data.generatedChapters} 个章节，共 ${result.data.totalWordCount} 字`,
        });
        onOpenChange(false);
        onSuccess?.(result.data.documentId);
        router.push(`/bid/documents/${result.data.documentId}?tab=review`);
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (error: any) {
      toast({
        title: '生成失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            一键生成投标文档
          </DialogTitle>
          <DialogDescription>
            基于招标文件解读结果，AI将自动生成整篇投标文档
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="documentName">文档名称 *</Label>
                <Input
                  id="documentName"
                  placeholder="请输入投标文档名称"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>招标文件解读</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{interpretationName || '已选择的解读结果'}</span>
                  <Badge variant="secondary" className="ml-auto">
                    已解析
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* 数据源选择 */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                投标主体（公司）*
              </Label>
              {loadingDataSources ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {dataSources?.companies.map((company) => (
                    <div
                      key={company.id}
                      className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCompanies.includes(company.id)
                          ? 'bg-blue-50 border-blue-300'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleCompanyToggle(company.id)}
                    >
                      <Checkbox
                        checked={selectedCompanies.includes(company.id)}
                        onCheckedChange={() => handleCompanyToggle(company.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{company.name}</div>
                        <div className="text-xs text-muted-foreground">{company.code}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 友司支持 */}
            {dataSources?.partnerApplications && dataSources.partnerApplications.length > 0 && (
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  友司支持材料（可选）
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {dataSources.partnerApplications.map((app) => (
                    <div
                      key={app.id}
                      className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPartnerApps.includes(app.id)
                          ? 'bg-green-50 border-green-300'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handlePartnerAppToggle(app.id)}
                    >
                      <Checkbox
                        checked={selectedPartnerApps.includes(app.id)}
                        onCheckedChange={() => handlePartnerAppToggle(app.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{app.partnerCompanyName}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* 生成选项 */}
            <div className="space-y-4">
              <Label>生成选项</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={generateOptions.includeQualification}
                    onCheckedChange={(checked) =>
                      setGenerateOptions({ ...generateOptions, includeQualification: !!checked })
                    }
                  />
                  <span className="text-sm">资质部分</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={generateOptions.includePerformance}
                    onCheckedChange={(checked) =>
                      setGenerateOptions({ ...generateOptions, includePerformance: !!checked })
                    }
                  />
                  <span className="text-sm">业绩部分</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={generateOptions.includeTechnical}
                    onCheckedChange={(checked) =>
                      setGenerateOptions({ ...generateOptions, includeTechnical: !!checked })
                    }
                  />
                  <span className="text-sm">技术方案</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={generateOptions.includeBusiness}
                    onCheckedChange={(checked) =>
                      setGenerateOptions({ ...generateOptions, includeBusiness: !!checked })
                    }
                  />
                  <span className="text-sm">商务部分</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>文档风格</Label>
                <Select
                  value={generateOptions.style}
                  onValueChange={(value: 'formal' | 'technical' | 'concise') =>
                    setGenerateOptions({ ...generateOptions, style: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">正式规范</SelectItem>
                    <SelectItem value="technical">技术导向</SelectItem>
                    <SelectItem value="concise">简洁明了</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 提示信息 */}
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <p>AI生成后文档将进入审核流程，审核通过后方可使用。</p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            开始生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OneClickGenerateDialog;

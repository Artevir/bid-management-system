'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type TemplateBlock = {
  blockId: number;
  blockType: string;
  orderNo: number;
  blockText: string | null;
};

type TemplateVariableBinding = {
  bindingId: number;
  bindingTargetType: string;
  bindingKey: string;
};

type TemplateVariable = {
  variableId: number;
  variableName: string;
  variableLabel: string | null;
  variableType: string;
  requiredFlag: boolean;
  editableFlag: boolean;
  bindings: TemplateVariableBinding[];
};

type TemplateDetail = {
  templateId: number;
  templateName: string;
  templateType: string;
  sourceTitle: string | null;
  templateText: string | null;
  fixedFormatFlag: boolean;
  originalFormatRequiredFlag: boolean;
  signatureRequiredFlag: boolean;
  sealRequiredFlag: boolean;
  dateRequiredFlag: boolean;
  reviewStatus: string;
  blocks: TemplateBlock[];
  variables: TemplateVariable[];
};

type TabType = 'templates' | 'blocks' | 'variables';

export function TemplatesWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [templates, setTemplates] = useState<TemplateDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('templates');

  const loadTemplates = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/template-detail`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载模板失败');
      }
      setTemplates(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载模板数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, [projectId, versionId]);

  const filteredTemplates = keyword.trim()
    ? templates.filter((t) =>
        `${t.templateName || ''} ${t.templateType || ''} ${t.sourceTitle || ''}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      )
    : templates;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      confirmed: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const getRequirementBadges = (tpl: TemplateDetail) => {
    const badges: { label: string; present: boolean }[] = [
      { label: '固定格式', present: tpl.fixedFormatFlag },
      { label: '原格式', present: tpl.originalFormatRequiredFlag },
      { label: '需签字', present: tpl.signatureRequiredFlag },
      { label: '需盖章', present: tpl.sealRequiredFlag },
      { label: '需日期', present: tpl.dateRequiredFlag },
    ];
    return badges
      .filter((b) => b.present)
      .map((b) => (
        <Badge key={b.label} variant="outline" className="text-xs">
          {b.label}
        </Badge>
      ));
  };

  const allBlocks = filteredTemplates.flatMap((t) =>
    t.blocks.map((b) => ({ ...b, templateName: t.templateName }))
  );
  const allVariables = filteredTemplates.flatMap((t) =>
    t.variables.map((v) => ({ ...v, templateName: t.templateName }))
  );

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'templates', label: '模板', count: filteredTemplates.length },
    { key: 'blocks', label: '模板块', count: allBlocks.length },
    { key: 'variables', label: '变量', count: allVariables.length },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'templates':
        return (
          <div className="space-y-3">
            {filteredTemplates.map((tpl) => (
              <div key={tpl.templateId} className="rounded border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{tpl.templateName || `模板 #${tpl.templateId}`}</p>
                    <p className="text-xs text-muted-foreground">
                      类别：{tpl.templateType || 'other_template'} | 来源：{tpl.sourceTitle || '-'}
                    </p>
                    {tpl.templateText && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        内容预览：{tpl.templateText.slice(0, 100)}
                        {tpl.templateText.length > 100 ? '...' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(tpl.reviewStatus)}
                    <div className="flex flex-wrap gap-1 justify-end">
                      {getRequirementBadges(tpl)}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {tpl.blocks.length} 个板块 | {tpl.variables.length} 个变量
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无模板数据</p>
            )}
          </div>
        );
      case 'blocks':
        return (
          <div className="space-y-3">
            {allBlocks.map((block) => (
              <div
                key={`${block.templateName}-${block.blockId}`}
                className="rounded border p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      板块 #{block.blockId} ({block.blockType})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      模板：{block.templateName} | 排序：{block.orderNo}
                    </p>
                  </div>
                  <Badge variant="outline">#{block.orderNo}</Badge>
                </div>
                {block.blockText && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{block.blockText}</p>
                )}
              </div>
            ))}
            {allBlocks.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无模板块数据</p>
            )}
          </div>
        );
      case 'variables':
        return (
          <div className="space-y-3">
            {allVariables.map((variable) => (
              <div
                key={`${variable.templateName}-${variable.variableId}`}
                className="rounded border p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{variable.variableName}</p>
                    <p className="text-xs text-muted-foreground">
                      模板：{variable.templateName} | 类型：{variable.variableType} | 标签：
                      {variable.variableLabel || '-'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {variable.requiredFlag && <Badge variant="destructive">必填</Badge>}
                    {variable.editableFlag && <Badge variant="outline">可编辑</Badge>}
                  </div>
                </div>
                {variable.bindings.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    绑定：
                    {variable.bindings
                      .map((b) => `${b.bindingTargetType}:${b.bindingKey}`)
                      .join(', ')}
                  </div>
                )}
              </div>
            ))}
            {allVariables.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无模板变量数据</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>模板工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索模板名称/类别/来源标题"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => void loadTemplates()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}

        <div className="flex flex-wrap gap-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {activeTab === 'templates'
            ? `共 ${filteredTemplates.length} 个模板`
            : activeTab === 'blocks'
              ? `共 ${allBlocks.length} 个模板块`
              : `共 ${allVariables.length} 个变量`}
        </p>
        {renderTabContent()}
      </CardContent>
    </Card>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  bindingValue?: string | null;
};

type TemplateVariable = {
  variableId: number;
  variableName: string;
  variableLabel: string | null;
  variableType: string;
  requiredFlag: boolean;
  editableFlag: boolean;
  defaultValue?: string | null;
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

type FilterState = {
  templateType: string;
  fixedFormat: string;
  originalFormat: string;
  signature: string;
  seal: string;
  reviewStatus: string;
};

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [selectedVariableId, setSelectedVariableId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    templateType: '',
    fixedFormat: '',
    originalFormat: '',
    signature: '',
    seal: '',
    reviewStatus: '',
  });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

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

  const stats = useMemo(() => {
    const total = templates.length;
    const originalFormatCount = templates.filter((t) => t.originalFormatRequiredFlag).length;
    const fixedFormatCount = templates.filter((t) => t.fixedFormatFlag).length;
    const signatureCount = templates.filter((t) => t.signatureRequiredFlag).length;
    const sealCount = templates.filter((t) => t.sealRequiredFlag).length;
    const totalVariables = templates.reduce((sum, t) => sum + t.variables.length, 0);
    return {
      total,
      originalFormatCount,
      fixedFormatCount,
      signatureCount,
      sealCount,
      totalVariables,
    };
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((t) =>
        `${t.templateName || ''} ${t.templateType || ''} ${t.sourceTitle || ''}`
          .toLowerCase()
          .includes(kw)
      );
    }
    if (filters.templateType)
      result = result.filter((t) => t.templateType === filters.templateType);
    if (filters.fixedFormat === 'yes') result = result.filter((t) => t.fixedFormatFlag);
    if (filters.fixedFormat === 'no') result = result.filter((t) => !t.fixedFormatFlag);
    if (filters.originalFormat === 'yes')
      result = result.filter((t) => t.originalFormatRequiredFlag);
    if (filters.originalFormat === 'no')
      result = result.filter((t) => !t.originalFormatRequiredFlag);
    if (filters.signature === 'yes') result = result.filter((t) => t.signatureRequiredFlag);
    if (filters.signature === 'no') result = result.filter((t) => !t.signatureRequiredFlag);
    if (filters.seal === 'yes') result = result.filter((t) => t.sealRequiredFlag);
    if (filters.seal === 'no') result = result.filter((t) => !t.sealRequiredFlag);
    if (filters.reviewStatus)
      result = result.filter((t) => t.reviewStatus === filters.reviewStatus);
    return result;
  }, [templates, keyword, filters]);

  const allBlocks = filteredTemplates.flatMap((t) =>
    t.blocks.map((b) => ({ ...b, templateId: t.templateId, templateName: t.templateName }))
  );
  const allVariables = filteredTemplates.flatMap((t) =>
    t.variables.map((v) => ({ ...v, templateId: t.templateId, templateName: t.templateName }))
  );

  const selectedTemplate = useMemo(() => {
    if (selectedTemplateId === null) return null;
    return templates.find((t) => t.templateId === selectedTemplateId) ?? null;
  }, [templates, selectedTemplateId]);

  const selectedBlock = useMemo(() => {
    if (selectedBlockId === null) return null;
    for (const tpl of templates) {
      const block = tpl.blocks.find((b) => b.blockId === selectedBlockId);
      if (block) return { ...block, templateName: tpl.templateName };
    }
    return null;
  }, [templates, selectedBlockId]);

  const selectedVariable = useMemo(() => {
    if (selectedVariableId === null) return null;
    for (const tpl of templates) {
      const variable = tpl.variables.find((v) => v.variableId === selectedVariableId);
      if (variable) return { ...variable, templateName: tpl.templateName };
    }
    return null;
  }, [templates, selectedVariableId]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      confirmed: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const handleConfirmObject = async (templateId: number) => {
    const key = `confirm_object-${templateId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/templates/${templateId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewStatus: 'confirmed' }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '确认对象失败');
      setTemplates((prev) =>
        prev.map((t) => (t.templateId === templateId ? { ...t, reviewStatus: 'confirmed' } : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认对象失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleModifyAndConfirm = async (templateId: number) => {
    const key = `modify_and_confirm-${templateId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/templates/${templateId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewStatus: 'confirmed', modifiedFlag: true }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '修改后确认失败');
      setTemplates((prev) =>
        prev.map((t) =>
          t.templateId === templateId ? { ...t, reviewStatus: 'confirmed', modifiedFlag: true } : t
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改后确认失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const renderDetailPanel = () => {
    if (activeTab === 'templates' && selectedTemplate) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">模板详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">模板名称</Label>
              <p className="font-medium">{selectedTemplate.templateName ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">模板类型</Label>
              <p>{selectedTemplate.templateType ?? 'other'}</p>
            </div>
            {selectedTemplate.sourceTitle && (
              <div>
                <Label className="text-muted-foreground">来源标题</Label>
                <p>{selectedTemplate.sourceTitle}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">模板全文</Label>
              <p className="whitespace-pre-wrap text-xs max-h-[200px] overflow-y-auto">
                {selectedTemplate.templateText ?? '-'}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedTemplate.fixedFormatFlag && <Badge variant="outline">固定格式</Badge>}
              {selectedTemplate.originalFormatRequiredFlag && (
                <Badge variant="outline">原样响应</Badge>
              )}
              {selectedTemplate.signatureRequiredFlag && <Badge variant="outline">需签字</Badge>}
              {selectedTemplate.sealRequiredFlag && <Badge variant="outline">需盖章</Badge>}
              {selectedTemplate.dateRequiredFlag && <Badge variant="outline">需日期</Badge>}
            </div>
            <div>
              <Label className="text-muted-foreground">复核状态</Label>
              <div className="mt-1">{getStatusBadge(selectedTemplate.reviewStatus)}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">块级结构</Label>
              <p>{selectedTemplate.blocks.length} 个板块</p>
            </div>
            <div>
              <Label className="text-muted-foreground">变量列表</Label>
              <div className="space-y-1 mt-1">
                {selectedTemplate.variables.map((v) => (
                  <div key={v.variableId} className="text-xs flex gap-2">
                    <span>{v.variableName}</span>
                    <span className="text-muted-foreground">({v.variableType})</span>
                    {v.requiredFlag && (
                      <Badge variant="destructive" className="text-[8px]">
                        必填
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`confirm_object-${selectedTemplate.templateId}`]}
                onClick={() => handleConfirmObject(selectedTemplate.templateId)}
              >
                确认对象 (confirm_object)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading[`modify_and_confirm-${selectedTemplate.templateId}`]}
                onClick={() => handleModifyAndConfirm(selectedTemplate.templateId)}
              >
                修改后确认 (modify_and_confirm)
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedTemplateId(null)}>
                关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (activeTab === 'blocks' && selectedBlock) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">模板块详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">所属模板</Label>
              <p className="font-medium">{selectedBlock.templateName}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">板块ID</Label>
                <p>{selectedBlock.blockId}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">排序号</Label>
                <p>{selectedBlock.orderNo}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">板块类型</Label>
              <Badge variant="outline">{selectedBlock.blockType}</Badge>
            </div>
            <div>
              <Label className="text-muted-foreground">板块内容</Label>
              <p className="whitespace-pre-wrap text-xs">{selectedBlock.blockText ?? '-'}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelectedBlockId(null)}>
              关闭
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (activeTab === 'variables' && selectedVariable) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">变量详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">变量名称</Label>
              <p className="font-medium">{selectedVariable.variableName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">所属模板</Label>
              <p>{selectedVariable.templateName}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">变量类型</Label>
                <p>{selectedVariable.variableType}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">变量标签</Label>
                <p>{selectedVariable.variableLabel ?? '-'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedVariable.requiredFlag && <Badge variant="destructive">必填</Badge>}
              {selectedVariable.editableFlag && <Badge variant="outline">可编辑</Badge>}
            </div>
            {selectedVariable.defaultValue && (
              <div>
                <Label className="text-muted-foreground">默认值</Label>
                <p>{selectedVariable.defaultValue}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">绑定预留</Label>
              <div className="space-y-1 mt-1">
                {selectedVariable.bindings.length > 0 ? (
                  selectedVariable.bindings.map((b) => (
                    <div key={b.bindingId} className="text-xs">
                      {b.bindingTargetType}:{b.bindingKey}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">暂无绑定</p>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelectedVariableId(null)}>
              关闭
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="h-fit">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>点击左侧项查看详情</p>
        </CardContent>
      </Card>
    );
  };

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
              <div
                key={tpl.templateId}
                className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                  selectedTemplateId === tpl.templateId
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/30'
                }`}
                onClick={() => setSelectedTemplateId(tpl.templateId)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{tpl.templateName || `模板 #${tpl.templateId}`}</p>
                    <p className="text-xs text-muted-foreground">
                      类别：{tpl.templateType || 'other'} | 来源：{tpl.sourceTitle || '-'}
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
                      {tpl.fixedFormatFlag && (
                        <Badge variant="outline" className="text-[10px]">
                          固定
                        </Badge>
                      )}
                      {tpl.originalFormatRequiredFlag && (
                        <Badge variant="outline" className="text-[10px]">
                          原样
                        </Badge>
                      )}
                      {tpl.signatureRequiredFlag && (
                        <Badge variant="outline" className="text-[10px]">
                          签字
                        </Badge>
                      )}
                      {tpl.sealRequiredFlag && (
                        <Badge variant="outline" className="text-[10px]">
                          盖章
                        </Badge>
                      )}
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
                className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                  selectedBlockId === block.blockId
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/30'
                }`}
                onClick={() => setSelectedBlockId(block.blockId)}
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
                className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                  selectedVariableId === variable.variableId
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/30'
                }`}
                onClick={() => setSelectedVariableId(variable.variableId)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{variable.variableName}</p>
                    <p className="text-xs text-muted-foreground">
                      模板：{variable.templateName} | 类型：{variable.variableType}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {variable.requiredFlag && (
                      <Badge variant="destructive" className="text-[10px]">
                        必填
                      </Badge>
                    )}
                    {variable.editableFlag && (
                      <Badge variant="outline" className="text-[10px]">
                        可编辑
                      </Badge>
                    )}
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">模板与变量</CardTitle>
              <Button variant="outline" onClick={() => void loadTemplates()} disabled={loading}>
                刷新
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="text-sm bg-muted px-3 py-1 rounded">
                模板: <strong>{stats.total}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                原样响应: <strong>{stats.originalFormatCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                固定格式: <strong>{stats.fixedFormatCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                需签字: <strong>{stats.signatureCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                需盖章: <strong>{stats.sealCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                变量: <strong>{stats.totalVariables}</strong>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && <p className="text-sm text-muted-foreground">加载中...</p>}

            <div className="flex flex-wrap gap-2 items-center border-b pb-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="关键词搜索"
                className="max-w-[200px]"
              />
              {activeTab === 'templates' && (
                <>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.templateType}
                    onChange={(e) => setFilters((f) => ({ ...f, templateType: e.target.value }))}
                  >
                    <option value="">全部类型</option>
                    <option value="certificate_template">证书模板</option>
                    <option value="form_template">表单模板</option>
                    <option value="statement_template">声明模板</option>
                    <option value="other_template">其他</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.fixedFormat}
                    onChange={(e) => setFilters((f) => ({ ...f, fixedFormat: e.target.value }))}
                  >
                    <option value="">固定格式</option>
                    <option value="yes">是</option>
                    <option value="no">否</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.signature}
                    onChange={(e) => setFilters((f) => ({ ...f, signature: e.target.value }))}
                  >
                    <option value="">需签字</option>
                    <option value="yes">是</option>
                    <option value="no">否</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.seal}
                    onChange={(e) => setFilters((f) => ({ ...f, seal: e.target.value }))}
                  >
                    <option value="">需盖章</option>
                    <option value="yes">是</option>
                    <option value="no">否</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.reviewStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, reviewStatus: e.target.value }))}
                  >
                    <option value="">复核状态</option>
                    <option value="draft">draft</option>
                    <option value="pending_review">pending_review</option>
                    <option value="confirmed">confirmed</option>
                  </select>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-1 border-b">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSelectedTemplateId(null);
                    setSelectedBlockId(null);
                    setSelectedVariableId(null);
                  }}
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
      </div>

      <div className="space-y-4">{renderDetailPanel()}</div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type FrameworkNode = {
  nodeId: number;
  id: number;
  parentId: number | null;
  title: string | null;
  chapterNumber: string | null;
  level: number | null;
  type: string | null;
  requiredType: string;
  reviewStatus: string;
  sortOrder: number;
  sourceSection?: string | null;
  sourcePage?: number | null;
  note?: string | null;
};

type FrameworkBinding = {
  bindingId: number;
  bidFrameworkNodeId: number;
  tenderRequirementId: number;
  bindingType: string;
  requiredLevel: string | null;
  frameworkTitle: string | null;
  requirementTitle: string | null;
  requirementType: string | null;
};

type TabType = 'nodes' | 'bindings';

type FilterState = {
  requiredType: string;
  contentType: string;
  reviewStatus: string;
  boundStatus: string;
};

export function FrameworkWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [nodes, setNodes] = useState<FrameworkNode[]>([]);
  const [bindings, setBindings] = useState<FrameworkBinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>('nodes');
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedBindingId, setSelectedBindingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    requiredType: '',
    contentType: '',
    reviewStatus: '',
    boundStatus: '',
  });

  const loadData = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const [nodesRes, bindingsRes] = await Promise.all([
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/framework`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/framework-bindings`),
      ]);
      const nodesPayload = await nodesRes.json();
      const bindingsPayload = await bindingsRes.json();
      if (nodesRes.ok && nodesPayload.success)
        setNodes(Array.isArray(nodesPayload.data) ? nodesPayload.data : []);
      if (bindingsRes.ok && bindingsPayload.success)
        setBindings(Array.isArray(bindingsPayload.data) ? bindingsPayload.data : []);
      if (nodesPayload.data?.length > 0) {
        setExpandedIds(new Set(nodesPayload.data.slice(0, 5).map((n: FrameworkNode) => n.nodeId)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId, versionId]);

  const stats = useMemo(() => {
    const uniqueRootLevels = new Set(nodes.filter((n) => !n.parentId).map((n) => n.level ?? 1))
      .size;
    const totalNodes = nodes.length;
    const requiredNodes = nodes.filter((n) => n.requiredType === 'required').length;
    const templateNodes = nodes.filter(
      (n) => n.type === 'template' || n.type === 'form_template'
    ).length;
    const tableNodes = nodes.filter((n) => n.type === 'table').length;
    const attachmentNodes = nodes.filter((n) => n.type === 'attachment').length;
    const boundNodeIds = new Set(bindings.map((b) => b.bidFrameworkNodeId));
    const boundCount = nodes.filter((n) => boundNodeIds.has(n.nodeId)).length;
    return {
      uniqueRootLevels,
      totalNodes,
      requiredNodes,
      templateNodes,
      tableNodes,
      attachmentNodes,
      boundCount,
    };
  }, [nodes, bindings]);

  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((node) => {
        const text = `${node.title || ''} ${node.chapterNumber || ''}`.toLowerCase();
        return text.includes(kw);
      });
    }
    if (filters.requiredType)
      result = result.filter((n) => n.requiredType === filters.requiredType);
    if (filters.contentType) result = result.filter((n) => n.type === filters.contentType);
    if (filters.reviewStatus)
      result = result.filter((n) => n.reviewStatus === filters.reviewStatus);
    if (filters.boundStatus === 'bound') {
      const boundIds = new Set(bindings.map((b) => b.bidFrameworkNodeId));
      result = result.filter((n) => boundIds.has(n.nodeId));
    } else if (filters.boundStatus === 'unbound') {
      const boundIds = new Set(bindings.map((b) => b.bidFrameworkNodeId));
      result = result.filter((n) => !boundIds.has(n.nodeId));
    }
    return result;
  }, [nodes, keyword, filters, bindings]);

  const filteredBindings = useMemo(() => {
    if (!keyword.trim()) return bindings;
    const kw = keyword.trim().toLowerCase();
    return bindings.filter((b) => {
      const text = `${b.frameworkTitle || ''} ${b.requirementTitle || ''}`.toLowerCase();
      return text.includes(kw);
    });
  }, [bindings, keyword]);

  const nodeMap = useMemo(() => {
    const map = new Map<number, FrameworkNode>();
    for (const node of filteredNodes) {
      map.set(node.nodeId, node);
    }
    return map;
  }, [filteredNodes]);

  const rootNodes = useMemo(() => {
    return filteredNodes.filter((node) => !node.parentId || !nodeMap.has(node.parentId));
  }, [filteredNodes, nodeMap]);

  const getChildren = (parentId: number): FrameworkNode[] => {
    return filteredNodes.filter((node) => node.parentId === parentId);
  };

  const toggleExpand = (nodeId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const selectedNode = useMemo(() => {
    if (selectedNodeId === null) return null;
    return nodes.find((n) => n.nodeId === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

  const selectedBinding = useMemo(() => {
    if (selectedBindingId === null) return null;
    return bindings.find((b) => b.bindingId === selectedBindingId) ?? null;
  }, [bindings, selectedBindingId]);

  const renderNode = (node: FrameworkNode, depth: number = 0) => {
    const children = getChildren(node.nodeId);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(node.nodeId);
    const isBound = bindings.some((b) => b.bidFrameworkNodeId === node.nodeId);

    return (
      <div key={node.nodeId} style={{ marginLeft: depth * 16 }}>
        <div
          className={`flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/30 rounded ${
            selectedNodeId === node.nodeId ? 'bg-primary/10' : ''
          }`}
          onClick={() => setSelectedNodeId(node.nodeId)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.nodeId);
              }}
              className="w-4 h-4 flex items-center justify-center text-xs border rounded hover:bg-muted"
            >
              {isExpanded ? '−' : '+'}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span className="font-medium text-sm">{node.title || `节点 #${node.nodeId}`}</span>
          <div className="flex gap-1">
            <Badge variant="outline" className="text-[10px]">
              {node.chapterNumber || '-'}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {node.type || 'text'}
            </Badge>
            {node.requiredType === 'required' && (
              <Badge variant="destructive" className="text-[10px]">
                必选
              </Badge>
            )}
            {isBound && (
              <Badge variant="default" className="text-[10px]">
                已绑定
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {node.reviewStatus}
            </Badge>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>{children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const renderDetailPanel = () => {
    if (activeTab === 'nodes' && selectedNode) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">框架节点详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">节点标题</Label>
              <p className="font-medium">{selectedNode.title ?? '-'}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">章节号</Label>
                <p>{selectedNode.chapterNumber ?? '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">层级</Label>
                <p>{selectedNode.level ?? '-'}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">内容类型</Label>
                <p>{selectedNode.type ?? 'text'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">必选类型</Label>
                <p>{selectedNode.requiredType}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">复核状态</Label>
              <Badge variant={selectedNode.reviewStatus === 'confirmed' ? 'default' : 'secondary'}>
                {selectedNode.reviewStatus}
              </Badge>
            </div>
            {selectedNode.sourceSection && (
              <div>
                <Label className="text-muted-foreground">来源章节</Label>
                <p>{selectedNode.sourceSection}</p>
              </div>
            )}
            {selectedNode.sourcePage && (
              <div>
                <Label className="text-muted-foreground">来源页码</Label>
                <p>第 {selectedNode.sourcePage} 页</p>
              </div>
            )}
            {selectedNode.note && (
              <div>
                <Label className="text-muted-foreground">节点说明</Label>
                <p>{selectedNode.note}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" disabled>
                确认对象 (confirm_object)
              </Button>
              <Button size="sm" variant="outline" disabled>
                转响应任务 (create_response_task)
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedNodeId(null)}>
                关闭
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (activeTab === 'bindings' && selectedBinding) {
      return (
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">绑定关系详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label className="text-muted-foreground">框架节点</Label>
              <p className="font-medium">{selectedBinding.frameworkTitle ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">关联要求</Label>
              <p>{selectedBinding.requirementTitle ?? '-'}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-muted-foreground">绑定类型</Label>
                <Badge variant="outline">{selectedBinding.bindingType}</Badge>
              </div>
              {selectedBinding.requiredLevel && (
                <div>
                  <Label className="text-muted-foreground">要求级别</Label>
                  <Badge variant="secondary">{selectedBinding.requiredLevel}</Badge>
                </div>
              )}
            </div>
            {selectedBinding.requirementType && (
              <div>
                <Label className="text-muted-foreground">要求类型</Label>
                <p>{selectedBinding.requirementType}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedBindingId(null)}>
                关闭
              </Button>
            </div>
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">投标框架</CardTitle>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                刷新
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="text-sm bg-muted px-3 py-1 rounded">
                一级章节: <strong>{stats.uniqueRootLevels}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                总节点: <strong>{stats.totalNodes}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                必选: <strong>{stats.requiredNodes}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                模板: <strong>{stats.templateNodes}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                表格: <strong>{stats.tableNodes}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                附件: <strong>{stats.attachmentNodes}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                已绑定: <strong>{stats.boundCount}</strong>
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
              {activeTab === 'nodes' && (
                <>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.requiredType}
                    onChange={(e) => setFilters((f) => ({ ...f, requiredType: e.target.value }))}
                  >
                    <option value="">必选类型</option>
                    <option value="required">必选</option>
                    <option value="optional">可选</option>
                  </select>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.contentType}
                    onChange={(e) => setFilters((f) => ({ ...f, contentType: e.target.value }))}
                  >
                    <option value="">内容类型</option>
                    <option value="text_chapter">文本章节</option>
                    <option value="template">模板</option>
                    <option value="form_template">表单模板</option>
                    <option value="table">表格</option>
                    <option value="attachment">附件</option>
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
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={filters.boundStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, boundStatus: e.target.value }))}
                  >
                    <option value="">绑定状态</option>
                    <option value="bound">已绑定</option>
                    <option value="unbound">未绑定</option>
                  </select>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-1 border-b">
              <button
                onClick={() => {
                  setActiveTab('nodes');
                  setSelectedNodeId(null);
                  setSelectedBindingId(null);
                }}
                className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                  activeTab === 'nodes'
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                框架节点 ({nodes.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('bindings');
                  setSelectedNodeId(null);
                  setSelectedBindingId(null);
                }}
                className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                  activeTab === 'bindings'
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                要求绑定 ({bindings.length})
              </button>
            </div>

            {activeTab === 'nodes' && (
              <>
                <p className="text-xs text-muted-foreground">
                  显示 {filteredNodes.length} 个节点（根节点 {rootNodes.length} 个）
                </p>
                <div className="border rounded p-3 space-y-1 max-h-[500px] overflow-y-auto">
                  {rootNodes.map((node) => renderNode(node))}
                  {filteredNodes.length === 0 && (
                    <p className="text-sm text-muted-foreground">暂无框架节点数据</p>
                  )}
                </div>
              </>
            )}

            {activeTab === 'bindings' && (
              <>
                <p className="text-xs text-muted-foreground">
                  显示 {filteredBindings.length} 条绑定
                </p>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredBindings.map((binding) => (
                    <div
                      key={binding.bindingId}
                      className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                        selectedBindingId === binding.bindingId
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/30'
                      }`}
                      onClick={() => setSelectedBindingId(binding.bindingId)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {binding.frameworkTitle || `框架节点 #${binding.bidFrameworkNodeId}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            → {binding.requirementTitle || `要求 #${binding.tenderRequirementId}`}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {binding.bindingType}
                          </Badge>
                          {binding.requiredLevel && (
                            <Badge variant="secondary" className="text-[10px]">
                              {binding.requiredLevel}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {binding.requirementType && (
                        <p className="text-xs text-muted-foreground">
                          要求类型：{binding.requirementType}
                        </p>
                      )}
                    </div>
                  ))}
                  {filteredBindings.length === 0 && (
                    <p className="text-sm text-muted-foreground">暂无绑定关系</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">{renderDetailPanel()}</div>
    </div>
  );
}

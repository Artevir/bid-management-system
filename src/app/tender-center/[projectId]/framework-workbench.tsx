'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
};

export function FrameworkWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [nodes, setNodes] = useState<FrameworkNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const loadNodes = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/framework`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载框架节点失败');
      }
      setNodes(Array.isArray(payload.data) ? payload.data : []);
      if (payload.data?.length > 0) {
        setExpandedIds(new Set(payload.data.slice(0, 5).map((n: FrameworkNode) => n.nodeId)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载框架数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNodes();
  }, [projectId, versionId]);

  const filteredNodes = useMemo(() => {
    if (!keyword.trim()) return nodes;
    const kw = keyword.trim().toLowerCase();
    return nodes.filter((node) => {
      const text = `${node.title || ''} ${node.chapterNumber || ''}`.toLowerCase();
      return text.includes(kw);
    });
  }, [nodes, keyword]);

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
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const renderNode = (node: FrameworkNode, depth: number = 0) => {
    const children = getChildren(node.nodeId);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(node.nodeId);

    return (
      <div key={node.nodeId} style={{ marginLeft: depth * 16 }}>
        <div className="flex items-center gap-2 py-1">
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(node.nodeId)}
              className="w-4 h-4 flex items-center justify-center text-xs border rounded hover:bg-muted"
            >
              {isExpanded ? '−' : '+'}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span className="font-medium text-sm">{node.title || `节点 #${node.nodeId}`}</span>
          <span className="text-xs text-muted-foreground">
            [{node.chapterNumber || '-'}] {node.type || 'text_chapter'} | {node.requiredType} |{' '}
            {node.reviewStatus}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <div>{children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>框架节点工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索框架标题/章节号"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => void loadNodes()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
        <p className="text-xs text-muted-foreground">
          共 {filteredNodes.length} 个框架节点（根节点 {rootNodes.length} 个）
        </p>
        <div className="border rounded p-3 space-y-1">
          {rootNodes.map((node) => renderNode(node))}
          {filteredNodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无框架节点数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

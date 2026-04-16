'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type DocumentSection = {
  sectionId: number;
  title: string | null;
  number: string | null;
  level: number | null;
  parentSectionId: number | null;
  pageNumber: number | null;
  pathText: string | null;
};

export function SectionsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [rows, setRows] = useState<DocumentSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const loadRows = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/sections`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载章节失败');
      }
      setRows(Array.isArray(payload.data) ? payload.data : []);
      if (payload.data?.length > 0) {
        setExpandedIds(new Set(payload.data.slice(0, 10).map((s: DocumentSection) => s.sectionId)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载章节失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId]);

  const filteredRows = keyword.trim()
    ? rows.filter((row) =>
        `${row.title || ''} ${row.number || ''} ${row.pathText || ''}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      )
    : rows;

  const sectionMap = useMemo(() => {
    const map = new Map<number, DocumentSection>();
    for (const section of filteredRows) {
      map.set(section.sectionId, section);
    }
    return map;
  }, [filteredRows]);

  const rootSections = useMemo(() => {
    return filteredRows.filter(
      (section) => !section.parentSectionId || !sectionMap.has(section.parentSectionId)
    );
  }, [filteredRows, sectionMap]);

  const getChildren = (parentId: number): DocumentSection[] => {
    return filteredRows.filter((section) => section.parentSectionId === parentId);
  };

  const toggleExpand = (sectionId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const renderSection = (section: DocumentSection, depth: number = 0) => {
    const children = getChildren(section.sectionId);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(section.sectionId);

    return (
      <div key={section.sectionId} style={{ marginLeft: depth * 16 }}>
        <div className="flex items-center gap-2 py-1">
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(section.sectionId)}
              className="w-5 h-5 flex items-center justify-center text-xs border rounded hover:bg-muted"
            >
              {isExpanded ? '−' : '+'}
            </button>
          ) : (
            <span className="w-5" />
          )}
          {section.level && (
            <span className="text-xs px-1 py-0.5 bg-blue-100 text-blue-800 rounded">
              L{section.level}
            </span>
          )}
          <span className="font-medium text-sm">
            {section.title || `章节 #${section.sectionId}`}
          </span>
          <span className="text-xs text-muted-foreground">
            [{section.number || '-'}] 页码: {section.pageNumber ?? '-'}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <div>{children.map((child) => renderSection(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>正文章节工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索章节标题/编号"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => void loadRows()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
        <p className="text-xs text-muted-foreground">
          共 {filteredRows.length} 个章节（根章节 {rootSections.length} 个）
        </p>
        <div className="border rounded p-3 space-y-1 max-h-[500px] overflow-y-auto">
          {rootSections.map((section) => renderSection(section))}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无章节数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

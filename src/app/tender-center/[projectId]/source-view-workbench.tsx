'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type SourceDocument = {
  id: number;
  fileName: string;
  fileExt: string | null;
  fileSize: number | null;
  pageCount: number | null;
  docCategory: string;
  parseStatus: string;
};

type DocumentPage = {
  pageId: number;
  pageNumber: number;
  hasContent: boolean;
};

type SourceSegment = {
  id: number;
  segmentType: string;
  sectionPath: string | null;
  rawText: string | null;
  normalizedText: string | null;
  isHeading: boolean;
  headingLevel: number | null;
  documentPageId: number | null;
  metadata?: Record<string, unknown> | null;
};

type DocumentSection = {
  id: number;
  sectionNumber: string | null;
  sectionTitle: string | null;
  level: number | null;
  parentSectionId: number | null;
};

type SourceViewData = {
  documents: SourceDocument[];
  pages: DocumentPage[];
  segments: SourceSegment[];
  sections: DocumentSection[];
};

export function SourceViewWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [data, setData] = useState<SourceViewData>({
    documents: [],
    pages: [],
    segments: [],
    sections: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedPageNum, setSelectedPageNum] = useState<number | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');

  const loadData = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const [docsRes, pagesRes, segmentsRes, sectionsRes] = await Promise.all([
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/documents`),
        selectedDocId
          ? fetch(
              `/api/tender-center/projects/${projectId}/versions/${versionId}/pages?documentId=${selectedDocId}`
            )
          : Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/segments`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/sections`),
      ]);
      const [docsPayload, pagesPayload, segmentsPayload, sectionsPayload] = await Promise.all([
        docsRes.json(),
        pagesRes.json(),
        segmentsRes.json(),
        sectionsRes.json(),
      ]);
      setData({
        documents: docsPayload.success ? docsPayload.data?.documents || [] : [],
        pages: pagesPayload.success ? pagesPayload.data || [] : [],
        segments: segmentsPayload.success ? segmentsPayload.data || [] : [],
        sections: sectionsPayload.success ? sectionsPayload.data || [] : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载原文定位数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId, versionId, selectedDocId]);

  const stats = useMemo(() => {
    const docCount = data.documents.length;
    const pageCount = data.pages.length;
    const segmentCount = data.segments.length;
    const sectionCount = data.sections.length;
    return { docCount, pageCount, segmentCount, sectionCount };
  }, [data]);

  const filteredSegments = useMemo(() => {
    let result = data.segments;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((s) =>
        `${s.rawText || ''} ${s.sectionPath || ''} ${s.segmentType || ''}`
          .toLowerCase()
          .includes(kw)
      );
    }
    if (selectedPageNum) {
      result = result.filter((s) => s.documentPageId === selectedPageNum);
    }
    return result;
  }, [data.segments, keyword, selectedPageNum]);

  const selectedSegment = useMemo(() => {
    if (selectedSegmentId === null) return null;
    return data.segments.find((s) => s.id === selectedSegmentId) ?? null;
  }, [data.segments, selectedSegmentId]);

  const contextSegments = useMemo(() => {
    if (!selectedSegment) return [];
    const idx = data.segments.findIndex((s) => s.id === selectedSegmentId);
    const start = Math.max(0, idx - 2);
    const end = Math.min(data.segments.length, idx + 3);
    return data.segments.slice(start, end);
  }, [data.segments, selectedSegmentId]);

  const navigateSegment = (direction: 'prev' | 'next') => {
    if (filteredSegments.length === 0) return;
    const currentIdx = selectedSegmentId
      ? filteredSegments.findIndex((s) => s.id === selectedSegmentId)
      : -1;
    let newIdx: number;
    if (direction === 'prev') {
      newIdx = currentIdx <= 0 ? filteredSegments.length - 1 : currentIdx - 1;
    } else {
      newIdx = currentIdx >= filteredSegments.length - 1 ? 0 : currentIdx + 1;
    }
    setSelectedSegmentId(filteredSegments[newIdx].id);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">原文定位视图</CardTitle>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                刷新
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="text-sm bg-muted px-3 py-1 rounded">
                文件: <strong>{stats.docCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                页码: <strong>{stats.pageCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                分片: <strong>{stats.segmentCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                章节: <strong>{stats.sectionCount}</strong>
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
                placeholder="关键词搜索分片内容"
                className="max-w-[200px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">A10 文件导航区</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {data.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`rounded border p-2 cursor-pointer transition-colors ${
                        selectedDocId === doc.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/30'
                      }`}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setSelectedPageNum(null);
                        setSelectedSegmentId(null);
                      }}
                    >
                      <p className="font-medium text-sm">{doc.fileName}</p>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {doc.fileExt?.toUpperCase() || '-'}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {doc.docCategory}
                        </Badge>
                        <Badge
                          variant={doc.parseStatus === 'completed' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {doc.parseStatus}
                        </Badge>
                      </div>
                      {doc.pageCount && (
                        <p className="text-xs text-muted-foreground mt-1">{doc.pageCount} 页</p>
                      )}
                    </div>
                  ))}
                  {data.documents.length === 0 && (
                    <p className="text-sm text-muted-foreground">暂无文档数据</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm">页码导航</h4>
                <div className="flex flex-wrap gap-1">
                  {data.pages.slice(0, 20).map((page) => (
                    <Button
                      key={page.pageId}
                      size="sm"
                      variant={selectedPageNum === page.pageId ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedPageNum(page.pageId);
                        setSelectedSegmentId(null);
                      }}
                      disabled={!selectedDocId}
                    >
                      {page.pageNumber}
                    </Button>
                  ))}
                  {data.pages.length > 20 && (
                    <p className="text-xs text-muted-foreground self-center">
                      ... 共 {data.pages.length} 页
                    </p>
                  )}
                  {data.pages.length === 0 && (
                    <p className="text-sm text-muted-foreground">请先选择文档</p>
                  )}
                </div>

                <h4 className="font-medium text-sm mt-4">章节导航</h4>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {data.sections
                    .filter((s) => s.level === 1)
                    .slice(0, 10)
                    .map((section) => (
                      <div key={section.id} className="text-sm text-muted-foreground">
                        {section.sectionNumber || ''} {section.sectionTitle || '-'}
                      </div>
                    ))}
                  {data.sections.length === 0 && (
                    <p className="text-xs text-muted-foreground">暂无章节数据</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">C10 高亮片段区 / D10 上下文区</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded p-3">
                {contextSegments.map((seg, idx) => (
                  <div
                    key={seg.id}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedSegmentId === seg.id
                        ? 'bg-primary/10 border-l-2 border-primary'
                        : 'hover:bg-muted/30'
                    }`}
                    onClick={() => setSelectedSegmentId(seg.id)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">
                        {seg.segmentType}
                      </Badge>
                      {seg.isHeading && (
                        <Badge variant="secondary" className="text-[10px]">
                          标题{seg.headingLevel ? ` L${seg.headingLevel}` : ''}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {seg.sectionPath || '-'}
                      </span>
                    </div>
                    <p
                      className={`text-sm whitespace-pre-wrap ${selectedSegmentId === seg.id ? 'font-medium' : ''}`}
                    >
                      {seg.rawText?.slice(0, 150) || '-'}
                      {(seg.rawText?.length || 0) > 150 ? '...' : ''}
                    </p>
                  </div>
                ))}
                {contextSegments.length === 0 && (
                  <p className="text-sm text-muted-foreground">点击左侧分片查看高亮</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">分片列表</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {filteredSegments.slice(0, 30).map((seg) => (
                  <div
                    key={seg.id}
                    className={`rounded border p-2 cursor-pointer transition-colors text-xs ${
                      selectedSegmentId === seg.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/30'
                    }`}
                    onClick={() => setSelectedSegmentId(seg.id)}
                  >
                    <span className="font-medium">{seg.segmentType}</span>
                    <span className="text-muted-foreground ml-2">
                      {seg.rawText?.slice(0, 80) || '-'}
                    </span>
                  </div>
                ))}
                {filteredSegments.length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无分片数据</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">E10 元信息区</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {selectedSegment ? (
              <>
                <div>
                  <Label className="text-muted-foreground">分片ID</Label>
                  <p className="font-medium">{selectedSegment.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">分片类型</Label>
                  <Badge variant="outline">{selectedSegment.segmentType}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">所属章节</Label>
                  <p>{selectedSegment.sectionPath ?? '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">页码</Label>
                  <p>{selectedSegment.documentPageId ?? '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">是否标题</Label>
                  <p>
                    {selectedSegment.isHeading ? '是' : '否'}
                    {selectedSegment.headingLevel ? ` (Level ${selectedSegment.headingLevel})` : ''}
                  </p>
                </div>
                {selectedSegment.normalizedText && (
                  <div>
                    <Label className="text-muted-foreground">归一化内容</Label>
                    <p className="text-xs whitespace-pre-wrap">{selectedSegment.normalizedText}</p>
                  </div>
                )}
                {selectedSegment.metadata && Object.keys(selectedSegment.metadata).length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">元数据</Label>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(selectedSegment.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-center">点击分片查看详情</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">F10 跳转动作区</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigateSegment('prev')}
              disabled={filteredSegments.length === 0}
            >
              上一处命中
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigateSegment('next')}
              disabled={filteredSegments.length === 0}
            >
              下一处命中
            </Button>
            <Button variant="outline" className="w-full" disabled={!selectedSegment}>
              打开原文件
            </Button>
            <Button variant="outline" className="w-full" disabled={!selectedSegment}>
              固定当前依据
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

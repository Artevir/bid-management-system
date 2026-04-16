'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ScoringScheme = {
  schemeId: number;
  schemeName: string;
  itemCount: number;
  totalScore: string | null;
  businessScore: string | null;
  technicalScore: string | null;
  priceScore: string | null;
};

type ScoringItem = {
  scoringItemId: number;
  scoringSchemeId: number;
  category: string | null;
  itemName: string | null;
  scoreText: string | null;
  scoreValue: string | null;
  criteria: string | null;
  reviewStatus: string;
  subCategory: string | null;
  maxScore: number | null;
  minScore: number | null;
  scoringMethod: string | null;
  pageNumber: number | null;
};

export function ScoringWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [schemes, setSchemes] = useState<ScoringScheme[]>([]);
  const [items, setItems] = useState<ScoringItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | null>(null);

  const loadData = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const [schemesRes, itemsRes] = await Promise.all([
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/scoring-schemes`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/scoring-items`),
      ]);
      const schemesPayload = await schemesRes.json();
      const itemsPayload = await itemsRes.json();
      if (!schemesRes.ok || !schemesPayload.success) {
        throw new Error(schemesPayload.error || schemesPayload.message || '加载评分方案失败');
      }
      if (!itemsRes.ok || !itemsPayload.success) {
        throw new Error(itemsPayload.error || itemsPayload.message || '加载评分项失败');
      }
      setSchemes(Array.isArray(schemesPayload.data) ? schemesPayload.data : []);
      setItems(Array.isArray(itemsPayload.data) ? itemsPayload.data : []);
      if (schemesPayload.data?.length > 0 && !selectedSchemeId) {
        setSelectedSchemeId(schemesPayload.data[0].schemeId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载评分数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId, versionId]);

  const filteredItems = useMemo(() => {
    const result = selectedSchemeId
      ? items.filter((item) => item.scoringSchemeId === selectedSchemeId)
      : items;
    if (!keyword.trim()) return result;
    const kw = keyword.trim().toLowerCase();
    return result.filter((item) => {
      const text =
        `${item.itemName || ''} ${item.category || ''} ${item.criteria || ''}`.toLowerCase();
      return text.includes(kw);
    });
  }, [items, selectedSchemeId, keyword]);

  const totalScore = filteredItems.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>评分方案工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索评分项名称/类别/标准"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}

        <div className="flex flex-wrap gap-2">
          {schemes.map((scheme) => (
            <Button
              key={scheme.schemeId}
              variant={selectedSchemeId === scheme.schemeId ? 'default' : 'outline'}
              onClick={() => setSelectedSchemeId(scheme.schemeId)}
            >
              {scheme.schemeName} ({scheme.itemCount}项)
            </Button>
          ))}
          {schemes.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无评分方案</p>
          ) : null}
        </div>

        {selectedSchemeId && (
          <div className="rounded border p-3 space-y-2">
            <p className="text-sm font-medium">
              当前方案：{schemes.find((s) => s.schemeId === selectedSchemeId)?.schemeName}
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>总分：{totalScore}</span>
              <span>
                商务分：{schemes.find((s) => s.schemeId === selectedSchemeId)?.businessScore ?? '-'}
              </span>
              <span>
                技术分：
                {schemes.find((s) => s.schemeId === selectedSchemeId)?.technicalScore ?? '-'}
              </span>
              <span>
                价格分：{schemes.find((s) => s.schemeId === selectedSchemeId)?.priceScore ?? '-'}
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">共 {filteredItems.length} 条评分项</p>
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div key={item.scoringItemId} className="rounded border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.itemName || `评分项 #${item.scoringItemId}`}</p>
                  <p className="text-xs text-muted-foreground">
                    类别：{item.category || 'other'} | 最高分：{item.maxScore ?? '-'} | 审阅：
                    {item.reviewStatus}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">评分标准：{item.criteria || '-'}</p>
            </div>
          ))}
          {filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无评分项数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

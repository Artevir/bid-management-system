'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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
  materialRequired?: boolean;
  materialHint?: string | null;
};

const CATEGORIES = ['technical', 'business', 'price', 'service', 'other'];
const SCORE_RANGES = ['0-10', '10-20', '20-50', '50+'];

type FilterState = {
  category: string;
  scoreRange: string;
  materialRequired: string;
  reviewStatus: string;
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
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: '',
    scoreRange: '',
    materialRequired: '',
    reviewStatus: '',
  });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

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

  const stats = useMemo(() => {
    const schemeItems = selectedSchemeId
      ? items.filter((i) => i.scoringSchemeId === selectedSchemeId)
      : items;
    const total = schemeItems.length;
    const withMaterial = schemeItems.filter((i) => i.materialRequired === true).length;
    const currentScheme = schemes.find((s) => s.schemeId === selectedSchemeId);
    return {
      total,
      withMaterial,
      totalScore: currentScheme?.totalScore ?? '-',
      businessScore: currentScheme?.businessScore ?? '-',
      technicalScore: currentScheme?.technicalScore ?? '-',
      priceScore: currentScheme?.priceScore ?? '-',
    };
  }, [items, schemes, selectedSchemeId]);

  const filteredItems = useMemo(() => {
    let result = selectedSchemeId
      ? items.filter((item) => item.scoringSchemeId === selectedSchemeId)
      : items;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((item) => {
        const text =
          `${item.itemName || ''} ${item.category || ''} ${item.criteria || ''}`.toLowerCase();
        return text.includes(kw);
      });
    }
    if (filters.category) result = result.filter((i) => i.category === filters.category);
    if (filters.reviewStatus)
      result = result.filter((i) => i.reviewStatus === filters.reviewStatus);
    if (filters.materialRequired === 'yes')
      result = result.filter((i) => i.materialRequired === true);
    if (filters.materialRequired === 'no')
      result = result.filter((i) => i.materialRequired !== true);
    if (filters.scoreRange) {
      const [min, max] = filters.scoreRange.split('-').map(Number);
      result = result.filter((i) => {
        const score = i.maxScore ?? 0;
        return score >= min && (max ? score < max : true);
      });
    }
    return result;
  }, [items, selectedSchemeId, keyword, filters]);

  const selectedItem = useMemo(() => {
    if (selectedItemId === null) return null;
    return items.find((i) => i.scoringItemId === selectedItemId) ?? null;
  }, [items, selectedItemId]);

  const handleCreateReview = async (scoringItemId: number) => {
    const key = `create_review-${scoringItemId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch('/api/tender-center/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: Number(projectId),
          versionId,
          note: `评分项 #${scoringItemId} 发起复核`,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '发起复核失败');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发起复核失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleConfirmObject = async (scoringItemId: number) => {
    const key = `confirm_object-${scoringItemId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/scoring-items/${scoringItemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewStatus: 'confirmed' }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '确认对象失败');
      setItems((prev) =>
        prev.map((i) =>
          i.scoringItemId === scoringItemId ? { ...i, reviewStatus: 'confirmed' } : i
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认对象失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleMaterializeRequirement = async (scoringItemId: number) => {
    const key = `materialize_requirement-${scoringItemId}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/materials`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceType: 'scoring_item', sourceId: scoringItemId }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || '转材料清单失败');
    } catch (err) {
      setError(err instanceof Error ? err.message : '转材料清单失败');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const totalFilteredScore = filteredItems.reduce(
    (sum, item) => sum + (Number(item.maxScore) || 0),
    0
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">评分办法</CardTitle>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                刷新
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="text-sm bg-muted px-3 py-1 rounded">
                评分项: <strong>{stats.total}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                总分: <strong>{stats.totalScore}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                商务分: <strong>{stats.businessScore}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                技术分: <strong>{stats.technicalScore}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                价格分: <strong>{stats.priceScore}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                需证明材料: <strong>{stats.withMaterial}</strong>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && <p className="text-sm text-muted-foreground">加载中...</p>}

            <div className="flex flex-wrap gap-2">
              {schemes.map((scheme) => (
                <Button
                  key={scheme.schemeId}
                  variant={selectedSchemeId === scheme.schemeId ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedSchemeId(scheme.schemeId);
                    setSelectedItemId(null);
                  }}
                >
                  {scheme.schemeName} ({scheme.itemCount}项)
                </Button>
              ))}
              {schemes.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无评分方案</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center border-b pb-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="关键词搜索"
                className="max-w-[200px]"
              />
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">全部类别</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.scoreRange}
                onChange={(e) => setFilters((f) => ({ ...f, scoreRange: e.target.value }))}
              >
                <option value="">全部分值</option>
                {SCORE_RANGES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.materialRequired}
                onChange={(e) => setFilters((f) => ({ ...f, materialRequired: e.target.value }))}
              >
                <option value="">证明材料</option>
                <option value="yes">需要</option>
                <option value="no">不需要</option>
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.reviewStatus}
                onChange={(e) => setFilters((f) => ({ ...f, reviewStatus: e.target.value }))}
              >
                <option value="">全部状态</option>
                <option value="draft">draft</option>
                <option value="pending_review">pending_review</option>
                <option value="confirmed">confirmed</option>
              </select>
            </div>

            <p className="text-xs text-muted-foreground">
              显示 {filteredItems.length} 条（满分 {totalFilteredScore}）
            </p>

            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.scoringItemId}
                  className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                    selectedItemId === item.scoringItemId
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/30'
                  }`}
                  onClick={() => setSelectedItemId(item.scoringItemId)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {item.itemName || `评分项 #${item.scoringItemId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        类别：{item.category || 'other'} | 分值：{item.minScore ?? 0}～
                        {item.maxScore ?? '-'} | 审阅：{item.reviewStatus}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.materialRequired && <Badge variant="outline">需材料</Badge>}
                      {item.pageNumber && <Badge variant="secondary">P{item.pageNumber}</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">评分标准：{item.criteria || '-'}</p>
                  {item.materialHint && (
                    <p className="text-xs text-muted-foreground">材料提示：{item.materialHint}</p>
                  )}
                </div>
              ))}
              {filteredItems.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无评分项数据</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {selectedItem ? (
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">评分项详情</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <Label className="text-muted-foreground">评分项名称</Label>
                <p className="font-medium">{selectedItem.itemName ?? '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">类别</Label>
                <p>{selectedItem.category || 'other'}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <Label className="text-muted-foreground">最低分</Label>
                  <p>{selectedItem.minScore ?? '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">最高分</Label>
                  <p>{selectedItem.maxScore ?? '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">评分方法</Label>
                <p>{selectedItem.scoringMethod ?? '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">评分标准全文</Label>
                <p className="whitespace-pre-wrap text-xs">{selectedItem.criteria || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">证明材料要求</Label>
                <p>
                  {selectedItem.materialRequired
                    ? (selectedItem.materialHint ?? '需要证明材料')
                    : '未要求'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">复核状态</Label>
                <Badge
                  variant={selectedItem.reviewStatus === 'confirmed' ? 'default' : 'secondary'}
                >
                  {selectedItem.reviewStatus}
                </Badge>
              </div>
              {selectedItem.pageNumber && (
                <div>
                  <Label className="text-muted-foreground">来源页码</Label>
                  <p>第 {selectedItem.pageNumber} 页</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading[`create_review-${selectedItem.scoringItemId}`]}
                  onClick={() => handleCreateReview(selectedItem.scoringItemId)}
                >
                  发起复核 (create_review)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading[`confirm_object-${selectedItem.scoringItemId}`]}
                  onClick={() => handleConfirmObject(selectedItem.scoringItemId)}
                >
                  确认对象 (confirm_object)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading[`materialize_requirement-${selectedItem.scoringItemId}`]}
                  onClick={() => handleMaterializeRequirement(selectedItem.scoringItemId)}
                >
                  转材料清单 (materialize_requirement)
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedItemId(null)}>
                  关闭
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-fit">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>点击左侧评分项查看详情</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

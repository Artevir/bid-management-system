'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type TechnicalGroup = {
  groupId: number;
  groupName: string;
  groupType: string;
  itemCount: number;
  orderNo: number;
};

type TechnicalItem = {
  technicalItemId: number;
  group: string | null;
  name: string | null;
  requirement: string | null;
  value: string | null;
  unit: string | null;
  mandatory: boolean;
  keyParam: boolean;
  pageNumber: number | null;
  allowDeviation?: boolean | null;
  negativeDeviationAllowed?: boolean | null;
  reviewStatus?: string;
  note?: string | null;
};

type FilterState = {
  groupId: string;
  mandatory: string;
  keyParam: string;
  allowDeviation: string;
  negativeDeviation: string;
  reviewStatus: string;
};

export function TechnicalWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [groups, setGroups] = useState<TechnicalGroup[]>([]);
  const [items, setItems] = useState<TechnicalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    groupId: '',
    mandatory: '',
    keyParam: '',
    allowDeviation: '',
    negativeDeviation: '',
    reviewStatus: '',
  });

  const loadData = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const [groupsRes, itemsRes] = await Promise.all([
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/technical-groups`),
        fetch(`/api/tender-center/projects/${projectId}/versions/${versionId}/technical-items`),
      ]);
      const groupsPayload = await groupsRes.json();
      const itemsPayload = await itemsRes.json();
      if (!groupsRes.ok || !groupsPayload.success) {
        throw new Error(groupsPayload.error || groupsPayload.message || '加载技术组失败');
      }
      if (!itemsRes.ok || !itemsPayload.success) {
        throw new Error(itemsPayload.error || itemsPayload.message || '加载技术项失败');
      }
      setGroups(Array.isArray(groupsPayload.data) ? groupsPayload.data : []);
      setItems(Array.isArray(itemsPayload.data) ? itemsPayload.data : []);
      if (groupsPayload.data?.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groupsPayload.data[0].groupId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载技术规格数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId, versionId]);

  const stats = useMemo(() => {
    const groupItems = selectedGroupId
      ? items.filter(
          (i) => groups.find((g) => g.groupId === selectedGroupId)?.groupName === i.group
        )
      : items;
    const total = groupItems.length;
    const starCount = groupItems.filter((i) => i.mandatory).length;
    const keyParamCount = groupItems.filter((i) => i.keyParam).length;
    const noDeviationCount = groupItems.filter((i) => i.negativeDeviationAllowed === false).length;
    const pendingReviewCount = groupItems.filter(
      (i) => i.reviewStatus === 'pending_review' || i.reviewStatus === 'reviewing'
    ).length;
    return {
      total,
      groupCount: groups.length,
      starCount,
      keyParamCount,
      noDeviationCount,
      pendingReviewCount,
    };
  }, [items, groups, selectedGroupId]);

  const filteredItems = useMemo(() => {
    let result = selectedGroupId
      ? items.filter(
          (item) => groups.find((g) => g.groupId === selectedGroupId)?.groupName === item.group
        )
      : items;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((item) => {
        const text =
          `${item.name || ''} ${item.requirement || ''} ${item.group || ''}`.toLowerCase();
        return text.includes(kw);
      });
    }
    if (filters.mandatory === 'yes') result = result.filter((i) => i.mandatory === true);
    if (filters.mandatory === 'no') result = result.filter((i) => i.mandatory !== true);
    if (filters.keyParam === 'yes') result = result.filter((i) => i.keyParam === true);
    if (filters.keyParam === 'no') result = result.filter((i) => i.keyParam !== true);
    if (filters.allowDeviation === 'yes') result = result.filter((i) => i.allowDeviation === true);
    if (filters.allowDeviation === 'no') result = result.filter((i) => i.allowDeviation !== true);
    if (filters.negativeDeviation === 'no')
      result = result.filter((i) => i.negativeDeviationAllowed === false);
    if (filters.negativeDeviation === 'yes')
      result = result.filter((i) => i.negativeDeviationAllowed === true);
    if (filters.reviewStatus)
      result = result.filter((i) => i.reviewStatus === filters.reviewStatus);
    return result;
  }, [items, selectedGroupId, keyword, filters, groups]);

  const selectedItem = useMemo(() => {
    if (selectedItemId === null) return null;
    return items.find((i) => i.technicalItemId === selectedItemId) ?? null;
  }, [items, selectedItemId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">技术参数</CardTitle>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                刷新
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="text-sm bg-muted px-3 py-1 rounded">
                参数组: <strong>{stats.groupCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                参数项: <strong>{stats.total}</strong>
              </div>
              <div className="text-sm bg-destructive/10 text-destructive px-3 py-1 rounded">
                星号项: <strong>{stats.starCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                关键参数: <strong>{stats.keyParamCount}</strong>
              </div>
              <div className="text-sm bg-destructive/10 text-destructive px-3 py-1 rounded">
                禁止负偏离: <strong>{stats.noDeviationCount}</strong>
              </div>
              <div className="text-sm bg-muted px-3 py-1 rounded">
                待复核: <strong>{stats.pendingReviewCount}</strong>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && <p className="text-sm text-muted-foreground">加载中...</p>}

            <div className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <Button
                  key={group.groupId}
                  variant={selectedGroupId === group.groupId ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedGroupId(group.groupId);
                    setSelectedItemId(null);
                  }}
                >
                  {group.groupName} ({group.itemCount}项)
                </Button>
              ))}
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无技术规格组</p>
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
                value={filters.mandatory}
                onChange={(e) => setFilters((f) => ({ ...f, mandatory: e.target.value }))}
              >
                <option value="">星号项</option>
                <option value="yes">是</option>
                <option value="no">否</option>
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.keyParam}
                onChange={(e) => setFilters((f) => ({ ...f, keyParam: e.target.value }))}
              >
                <option value="">关键参数</option>
                <option value="yes">是</option>
                <option value="no">否</option>
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.allowDeviation}
                onChange={(e) => setFilters((f) => ({ ...f, allowDeviation: e.target.value }))}
              >
                <option value="">允许偏离</option>
                <option value="yes">允许</option>
                <option value="no">不允许</option>
              </select>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={filters.negativeDeviation}
                onChange={(e) => setFilters((f) => ({ ...f, negativeDeviation: e.target.value }))}
              >
                <option value="">负偏离</option>
                <option value="no">禁止</option>
                <option value="yes">允许</option>
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
            </div>

            <p className="text-xs text-muted-foreground">显示 {filteredItems.length} 条参数</p>

            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.technicalItemId}
                  className={`rounded border p-3 space-y-2 cursor-pointer transition-colors ${
                    selectedItemId === item.technicalItemId
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/30'
                  }`}
                  onClick={() => setSelectedItemId(item.technicalItemId)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {item.name || `技术项 #${item.technicalItemId}`}
                      </span>
                      {item.mandatory && <Badge variant="destructive">★</Badge>}
                      {item.keyParam && <Badge variant="outline">关键</Badge>}
                    </div>
                    <div className="flex gap-1">
                      {item.pageNumber && <Badge variant="secondary">P{item.pageNumber}</Badge>}
                      {item.reviewStatus && (
                        <Badge
                          variant={item.reviewStatus === 'confirmed' ? 'default' : 'secondary'}
                        >
                          {item.reviewStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    规格要求：{item.requirement || '-'} | 要求值：{item.value ?? '-'} | 单位：
                    {item.unit ?? '-'}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {item.allowDeviation === false && <Badge variant="outline">不允许偏离</Badge>}
                    {item.negativeDeviationAllowed === false && (
                      <Badge variant="destructive">禁止负偏离</Badge>
                    )}
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无技术规格数据</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {selectedItem ? (
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">技术参数详情</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-2">
                {selectedItem.mandatory && <Badge variant="destructive">星号项</Badge>}
                {selectedItem.keyParam && <Badge variant="outline">关键参数</Badge>}
              </div>
              <div>
                <Label className="text-muted-foreground">参数名称</Label>
                <p className="font-medium">{selectedItem.name ?? '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">所属分组</Label>
                <p>{selectedItem.group ?? '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">参数要求</Label>
                <p className="whitespace-pre-wrap">{selectedItem.requirement ?? '-'}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <Label className="text-muted-foreground">要求值</Label>
                  <p>{selectedItem.value ?? '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">单位</Label>
                  <p>{selectedItem.unit ?? '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">偏离规则</Label>
                <div className="flex gap-2 mt-1">
                  <span>{selectedItem.allowDeviation === false ? '不允许偏离' : '允许偏离'}</span>
                  {selectedItem.negativeDeviationAllowed === false && (
                    <span className="text-destructive">禁止负偏离</span>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">复核状态</Label>
                <p>{selectedItem.reviewStatus ?? 'draft'}</p>
              </div>
              {selectedItem.note && (
                <div>
                  <Label className="text-muted-foreground">备注</Label>
                  <p>{selectedItem.note}</p>
                </div>
              )}
              {selectedItem.pageNumber && (
                <div>
                  <Label className="text-muted-foreground">来源页码</Label>
                  <p>第 {selectedItem.pageNumber} 页</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedItemId(null)}>
                  关闭
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-fit">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>点击左侧参数查看详情</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

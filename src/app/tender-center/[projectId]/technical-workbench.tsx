'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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

  const filteredItems = useMemo(() => {
    const result = selectedGroupId
      ? items.filter((item) =>
          items.find(
            (i) =>
              i.technicalItemId === item.technicalItemId &&
              groups.find((g) => g.groupId === selectedGroupId)?.groupName === item.group
          )
        )
      : items;
    if (!keyword.trim()) return result;
    const kw = keyword.trim().toLowerCase();
    return result.filter((item) => {
      const text = `${item.name || ''} ${item.requirement || ''} ${item.group || ''}`.toLowerCase();
      return text.includes(kw);
    });
  }, [items, selectedGroupId, keyword, groups]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, TechnicalItem[]>();
    for (const item of filteredItems) {
      const key = item.group || '未分类';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filteredItems]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>技术规格工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索技术要求名称/规格"
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
          {groups.map((group) => (
            <Button
              key={group.groupId}
              variant={selectedGroupId === group.groupId ? 'default' : 'outline'}
              onClick={() => setSelectedGroupId(group.groupId)}
            >
              {group.groupName} ({group.itemCount}项)
            </Button>
          ))}
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无技术规格组</p>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">共 {filteredItems.length} 条技术规格项</p>
        <div className="space-y-4">
          {Array.from(groupedByCategory.entries()).map(([category, categoryItems]) => (
            <div key={category} className="rounded border p-3 space-y-2">
              <p className="font-medium">{category}</p>
              {categoryItems.map((item) => (
                <div key={item.technicalItemId} className="pl-3 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {item.name || `技术项 #${item.technicalItemId}`}
                    </span>
                    {item.mandatory && <span className="text-red-500 ml-1">★</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    规格要求：{item.requirement || '-'} | 单位：{item.unit ?? '-'}
                  </p>
                </div>
              ))}
            </div>
          ))}
          {filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无技术规格数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

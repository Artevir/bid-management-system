'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type MoneyTerm = {
  id: number;
  moneyType: string;
  amountText: string | null;
  amountValue: string | null;
  currency: string | null;
  calcRule: string | null;
  reviewStatus: string;
};

export function MoneyTermsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [rows, setRows] = useState<MoneyTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  const loadRows = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/money-terms`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载金额条款失败');
      }
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载金额条款失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId]);

  const filteredRows = keyword.trim()
    ? rows.filter((row) =>
        `${row.moneyType || ''} ${row.amountText || ''}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      )
    : rows;

  const totalAmount = rows.reduce((sum, row) => {
    const val = row.amountValue ? parseFloat(row.amountValue) : 0;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const moneyTypes = [...new Set(rows.map((r) => r.moneyType))];

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>金额条款工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索类型/金额"
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

        <div className="flex flex-wrap gap-4 text-sm">
          <span>金额合计：{totalAmount.toLocaleString('zh-CN')}</span>
          <span>条目数：{rows.length}</span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {moneyTypes.map((type) => (
            <span key={type} className="px-2 py-1 bg-muted rounded">
              {type}: {rows.filter((r) => r.moneyType === type).length}
            </span>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">共 {filteredRows.length} 个金额条款</p>
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div key={row.id} className="rounded border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.moneyType}</p>
                  <p className="text-xs text-muted-foreground">审阅：{row.reviewStatus}</p>
                </div>
                {row.amountValue && (
                  <span className="text-sm font-medium text-green-600">
                    {row.currency || '¥'} {parseFloat(row.amountValue).toLocaleString('zh-CN')}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                金额文本：{row.amountText || '-'} | 计算规则：{row.calcRule ?? '-'}
              </p>
            </div>
          ))}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无金额条款数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

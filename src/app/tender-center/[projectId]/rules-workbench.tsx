'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type RuleDefinition = {
  ruleDefinitionId: number;
  ruleCode: string;
  ruleName: string | null;
  ruleType: string;
  ruleCategory: string | null;
  severityLevel: string;
  enabledFlag: boolean;
};

export function RulesWorkbench({ projectId, versionId }: { projectId: string; versionId: string }) {
  const [rows, setRows] = useState<RuleDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  const loadRows = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tender-center/rule-definitions');
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载规则定义失败');
      }
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载规则定义失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [projectId, versionId]);

  const filteredRows = keyword.trim()
    ? rows.filter((row) =>
        `${row.ruleCode || ''} ${row.ruleName || ''} ${row.ruleCategory || ''}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      )
    : rows;

  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
    warning: 'bg-blue-100 text-blue-800',
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>规则定义工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索规则代码/名称/类别"
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

        <p className="text-xs text-muted-foreground">共 {filteredRows.length} 条规则定义</p>

        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div key={row.ruleDefinitionId} className="rounded border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.ruleName || row.ruleCode}</p>
                  <p className="text-xs text-muted-foreground">
                    代码：{row.ruleCode} | 类型：{row.ruleType} | 类别：{row.ruleCategory ?? '-'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <span
                    className={`text-xs px-2 py-1 rounded ${severityColors[row.severityLevel] || 'bg-gray-100'}`}
                  >
                    {row.severityLevel}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${row.enabledFlag ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                  >
                    {row.enabledFlag ? '启用' : '禁用'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无规则定义数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

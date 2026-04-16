'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type SubmissionMaterial = {
  id: number;
  materialName: string | null;
  materialType: string | null;
  requiredFlag: boolean;
  sourceReason: string | null;
  relatedRequirementId: number | null;
  relatedScoringItemId: number | null;
  relatedTemplateId: number | null;
  needSignatureFlag: boolean;
  needSealFlag: boolean;
  note: string | null;
  reviewStatus: string;
};

export function MaterialsWorkbench({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const [materials, setMaterials] = useState<SubmissionMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');

  const loadMaterials = async () => {
    if (!versionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/tender-center/projects/${projectId}/versions/${versionId}/materials`
      );
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || payload.message || '加载材料失败');
      }
      setMaterials(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载材料数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMaterials();
  }, [projectId, versionId]);

  const filteredMaterials = keyword.trim()
    ? materials.filter((m) =>
        `${m.materialName || ''} ${m.materialType || ''}`
          .toLowerCase()
          .includes(keyword.trim().toLowerCase())
      )
    : materials;

  const requiredCount = filteredMaterials.filter((m) => m.requiredFlag).length;
  const optionalCount = filteredMaterials.filter((m) => !m.requiredFlag).length;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>递交材料工作台</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索材料名称/类型"
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => void loadMaterials()} disabled={loading}>
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>必填：{requiredCount}</span>
          <span>选填：{optionalCount}</span>
          <span>总计：{filteredMaterials.length}</span>
        </div>
        <div className="space-y-3">
          {filteredMaterials.map((mat) => (
            <div key={mat.id} className="rounded border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {mat.materialName || `材料 #${mat.id}`}
                    {mat.requiredFlag && <span className="text-red-500 ml-1">*必填</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    类型：{mat.materialType || 'other_material'} | 审阅：{mat.reviewStatus}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {mat.needSignatureFlag && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">需签名</span>
                )}
                {mat.needSealFlag && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">需盖章</span>
                )}
              </div>
              {mat.note && <p className="text-sm text-muted-foreground">备注：{mat.note}</p>}
            </div>
          ))}
          {filteredMaterials.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无递交材料数据</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

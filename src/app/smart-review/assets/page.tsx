'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableListStateRow } from '@/components/ui/list-states';
import { CheckCircle2, Database, FileStack, RefreshCw, XCircle } from 'lucide-react';

type DocumentOption = {
  id: number;
  fileName: string;
  projectName: string | null;
  projectCode: string | null;
  status: string;
};

type Segment = {
  segmentId: string;
  segmentType: string;
  title: string;
  content: string;
  source: string;
  orderNo: number;
};

type Requirement = {
  requirementId: number;
  category: string;
  item: string;
  detail: string;
  status: string;
  confidence: number;
  segmentId: string;
  isMandatory: boolean;
};

type AssetResponse = {
  project: {
    projectName: string;
    projectCode: string;
    tenderOrganization: string;
  };
  version: {
    versionId: string;
    versionNo: string;
    status: string;
    updatedAt: string;
  };
  segments: Segment[];
  requirements: Requirement[];
};

function resolveRequirementBadge(status: string) {
  if (status === 'confirmed') return 'bg-green-100 text-green-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
}

export default function SmartReviewAssetsPage() {
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [assets, setAssets] = useState<AssetResponse | null>(null);

  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [materializing, setMaterializing] = useState(false);
  const [actionRequirementId, setActionRequirementId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const stats = useMemo(() => {
    const requirements = assets?.requirements ?? [];
    const confirmed = requirements.filter((x) => x.status === 'confirmed').length;
    const rejected = requirements.filter((x) => x.status === 'rejected').length;
    const pending = requirements.filter((x) => x.status === 'pending').length;
    return {
      segmentCount: assets?.segments.length ?? 0,
      requirementCount: requirements.length,
      confirmed,
      rejected,
      pending,
    };
  }, [assets]);

  const documentSelectOptions = useMemo(() => {
    if (documents.length === 0) {
      return (
        <option value="" key="empty-doc">
          暂无已解析文档
        </option>
      );
    }
    return documents.map((doc) => (
      <option key={doc.id} value={doc.id}>
        {doc.fileName}（{doc.projectCode || '无项目编号'}）
      </option>
    ));
  }, [documents]);

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '50',
        status: 'parsed',
      });
      const response = await fetch(`/api/smart-review?${params.toString()}`);
      const payload = (await response.json()) as { documents?: DocumentOption[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || '加载文档失败');
      }
      const rows = payload.documents || [];
      setDocuments(rows);
      setSelectedDocId((current) => current ?? rows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文档失败');
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const fetchAssets = useCallback(async (documentId: number) => {
    setLoadingAssets(true);
    setError('');
    try {
      const response = await fetch(`/api/smart-review/${documentId}/assets`);
      const payload = (await response.json()) as {
        success?: boolean;
        data?: AssetResponse;
        error?: string;
      };
      if (!response.ok || payload.success === false || !payload.data) {
        throw new Error(payload.error || '加载资产主链路失败');
      }
      setAssets(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资产主链路失败');
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (!selectedDocId) {
      setAssets(null);
      return;
    }
    void fetchAssets(selectedDocId);
  }, [selectedDocId, fetchAssets]);

  const handleMaterialize = async () => {
    if (!selectedDocId) return;
    setMaterializing(true);
    setError('');
    try {
      const response = await fetch(`/api/smart-review/${selectedDocId}/assets/materialize`, {
        method: 'POST',
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || '要求资产入库失败');
      }
      await fetchAssets(selectedDocId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '要求资产入库失败');
    } finally {
      setMaterializing(false);
    }
  };

  const handleRequirementAction = async (
    requirementId: number,
    status: 'confirmed' | 'rejected'
  ) => {
    if (!selectedDocId || requirementId <= 0) return;
    setActionRequirementId(requirementId);
    setError('');
    try {
      const response = await fetch(
        `/api/smart-review/${selectedDocId}/assets/requirements/${requirementId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || '更新要求状态失败');
      }
      await fetchAssets(selectedDocId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新要求状态失败');
    } finally {
      setActionRequirementId(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">资产主链路台</h1>
          <p className="text-muted-foreground">
            项目版本 → 原文分片 → 要求资产，可直接确认或驳回要求条目
          </p>
        </div>
        <Button variant="outline" onClick={() => void fetchDocuments()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新文档
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>文档与版本</CardTitle>
          <CardDescription>选择已解析文档并将提取结果写入“要求资产主链路”</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <select
              className="w-full md:w-[460px] px-3 py-2 border rounded-md bg-background"
              disabled={loadingDocs || documents.length === 0}
              value={selectedDocId ?? ''}
              onChange={(event) => setSelectedDocId(Number(event.target.value))}
            >
              {documentSelectOptions}
            </select>
            <Button disabled={!selectedDocId || materializing} onClick={handleMaterialize}>
              <Database className="h-4 w-4 mr-2" />
              {materializing ? '入库中...' : '入库要求资产'}
            </Button>
          </div>

          {assets && (
            <div className="text-sm text-muted-foreground">
              版本：`{assets.version.versionId}` / 状态：{assets.version.status} / 更新时间：
              {new Date(assets.version.updatedAt).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">分片数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.segmentCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">要求总数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.requirementCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">待确认</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-yellow-600">{stats.pending}</CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">已确认</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-green-600">{stats.confirmed}</CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">已驳回</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">{stats.rejected}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>原文分片（source_segment 视角）</CardTitle>
          <CardDescription>每条要求都可追溯到原始分片</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>分片ID</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>内容摘要</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAssets || error || (assets?.segments.length ?? 0) === 0 ? (
                <TableListStateRow
                  state={loadingAssets ? 'loading' : error ? 'error' : 'empty'}
                  colSpan={4}
                  error={error}
                  onRetry={() => {
                    if (selectedDocId) {
                      void fetchAssets(selectedDocId);
                    }
                  }}
                  emptyText="暂无可展示分片"
                />
              ) : (
                assets?.segments.map((segment) => (
                  <TableRow key={segment.segmentId}>
                    <TableCell className="font-mono text-xs">{segment.segmentId}</TableCell>
                    <TableCell>{segment.segmentType}</TableCell>
                    <TableCell>{segment.title}</TableCell>
                    <TableCell className="max-w-[560px] truncate" title={segment.content}>
                      {segment.content}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>要求资产（tender_requirement 视角）</CardTitle>
          <CardDescription>按条确认要求状态，形成可执行资产清单</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>要求ID</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>要求项</TableHead>
                <TableHead>来源分片</TableHead>
                <TableHead>置信度</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAssets || error || (assets?.requirements.length ?? 0) === 0 ? (
                <TableListStateRow
                  state={loadingAssets ? 'loading' : error ? 'error' : 'empty'}
                  colSpan={7}
                  error={error}
                  onRetry={() => {
                    if (selectedDocId) {
                      void fetchAssets(selectedDocId);
                    }
                  }}
                  emptyText="暂无要求资产，请先执行“入库要求资产”"
                />
              ) : (
                assets?.requirements.map((requirement) => (
                  <TableRow key={requirement.requirementId}>
                    <TableCell className="font-mono text-xs">{requirement.requirementId}</TableCell>
                    <TableCell>{requirement.category}</TableCell>
                    <TableCell className="max-w-[360px] truncate" title={requirement.detail}>
                      {requirement.item}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {requirement.segmentId || '-'}
                    </TableCell>
                    <TableCell>{requirement.confidence}%</TableCell>
                    <TableCell>
                      <Badge className={resolveRequirementBadge(requirement.status)}>
                        {requirement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            requirement.requirementId <= 0 ||
                            actionRequirementId === requirement.requirementId
                          }
                          onClick={() =>
                            void handleRequirementAction(requirement.requirementId, 'confirmed')
                          }
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          确认
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            requirement.requirementId <= 0 ||
                            actionRequirementId === requirement.requirementId
                          }
                          onClick={() =>
                            void handleRequirementAction(requirement.requirementId, 'rejected')
                          }
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          驳回
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>业务定位</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="flex items-center gap-2 mb-1">
            <FileStack className="h-4 w-4" />
            该页面对应 000/010 主链路，不是过程门禁：文档版本、分片追溯、要求资产确认。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ProjectItem = {
  projectId: number;
  projectName: string;
  projectCode: string | null;
  status: string;
  currentVersionId: number | null;
  updatedAt: string;
};

export default function TenderCenterPage() {
  const [keyword, setKeyword] = useState('');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '20',
        keyword,
      });
      const res = await fetch(`/api/tender-center/projects?${params.toString()}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.message || payload.error || '加载项目失败');
      }
      setProjects(payload.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">招标文件智能审阅中枢</h1>
          <p className="text-muted-foreground">按 000 主架构运行：项目 → 版本 → 结构化资产</p>
        </div>
        <Link href="/smart-review/upload">
          <Button>上传文档</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>项目列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按项目名称/编码搜索"
            />
            <Button variant="outline" onClick={() => void loadProjects()} disabled={loading}>
              查询
            </Button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((item) => {
              const nextVersionId = item.currentVersionId ?? 0;
              return (
                <Card key={item.projectId}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="font-medium">{item.projectName}</div>
                    <div className="text-sm text-muted-foreground">
                      编码：{item.projectCode || '未设置'} | 状态：{item.status}
                    </div>
                    <div className="text-xs text-muted-foreground">更新时间：{item.updatedAt}</div>
                    {nextVersionId > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/tender-center/${item.projectId}/overview?versionId=${nextVersionId}`}
                        >
                          <Button size="sm" variant="outline">
                            概览
                          </Button>
                        </Link>
                        <Link
                          href={`/tender-center/${item.projectId}/requirements?versionId=${nextVersionId}`}
                        >
                          <Button size="sm" variant="outline">
                            要求
                          </Button>
                        </Link>
                        <Link
                          href={`/tender-center/${item.projectId}/risks?versionId=${nextVersionId}`}
                        >
                          <Button size="sm" variant="outline">
                            风险
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600">暂无版本，请先创建版本</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

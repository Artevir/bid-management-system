'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Search, RefreshCw, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AuditLog {
  id: number;
  userId: number | null;
  username: string | null;
  action: string;
  resource: string;
  resourceId: number | null;
  resourceCode: string | null;
  description: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  responseStatus: number | null;
  errorMessage: string | null;
  duration: number | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// 操作类型标签
const actionLabels: Record<string, { label: string; color: string }> = {
  login: { label: '登录', color: 'bg-blue-500' },
  logout: { label: '登出', color: 'bg-gray-500' },
  login_failed: { label: '登录失败', color: 'bg-red-500' },
  create: { label: '创建', color: 'bg-green-500' },
  update: { label: '更新', color: 'bg-yellow-500' },
  delete: { label: '删除', color: 'bg-red-500' },
  export: { label: '导出', color: 'bg-purple-500' },
  import: { label: '导入', color: 'bg-indigo-500' },
  download: { label: '下载', color: 'bg-cyan-500' },
  upload: { label: '上传', color: 'bg-teal-500' },
  view: { label: '查看', color: 'bg-slate-500' },
  approve: { label: '审批', color: 'bg-emerald-500' },
  reject: { label: '拒绝', color: 'bg-rose-500' },
  assign: { label: '分配', color: 'bg-amber-500' },
  revoke: { label: '撤销', color: 'bg-orange-500' },
};

// 资源类型标签
const resourceLabels: Record<string, string> = {
  user: '用户',
  role: '角色',
  permission: '权限',
  department: '部门',
  project: '项目',
  document: '文档',
  auth: '认证',
  system: '系统',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (searchTerm) {
        params.set('username', searchTerm);
      }

      const response = await fetch(`/api/audit/logs?${params}`);
      const data = await response.json();

      if (response.ok) {
        setLogs(data.logs);
        setPagination(data.pagination);
      } else {
        setError(data.error || '加载失败');
      }
    } catch (_err) {
      setError('加载审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const handleSearch = () => {
    fetchLogs(1);
  };

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage);
  };

  const getActionBadge = (action: string) => {
    const config = actionLabels[action] || { label: action, color: 'bg-gray-500' };
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const getResourceLabel = (resource: string) => {
    return resourceLabels[resource] || resource;
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                审计日志
              </CardTitle>
              <CardDescription>系统操作日志记录</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="flex gap-2">
                <Input
                  placeholder="搜索用户名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-48"
                />
                <Button variant="outline" size="icon" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="icon" onClick={() => fetchLogs(pagination.page)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>资源</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>IP地址</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>耗时</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell>{log.username || '-'}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getResourceLabel(log.resource)}</Badge>
                        {log.resourceCode && (
                          <span className="ml-1 text-muted-foreground text-sm">
                            ({log.resourceCode})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.description || '-'}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.ipAddress || '-'}
                      </TableCell>
                      <TableCell>
                        {log.errorMessage ? (
                          <Badge variant="destructive">失败</Badge>
                        ) : (
                          <Badge variant="default">成功</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDuration(log.duration)}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        暂无日志记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    共 {pagination.total} 条记录
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

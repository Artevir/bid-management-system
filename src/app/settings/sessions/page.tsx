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
import { Loader2, AlertCircle, RefreshCw, Monitor, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Session {
  id: number;
  ipAddress: string;
  deviceInfo: string;
  lastAccessedAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();

      if (response.ok) {
        setSessions(data.sessions);
      } else {
        setError(data.error || '加载失败');
      }
    } catch (err) {
      setError('加载会话列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSession = async () => {
    if (!selectedSessionId) return;

    setIsRevoking(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSessionId }),
      });

      const data = await response.json();

      if (response.ok) {
        setSessions(sessions.filter((s) => s.id !== selectedSessionId));
        setConfirmDialogOpen(false);
        setSelectedSessionId(null);
      } else {
        setError(data.error || '撤销失败');
      }
    } catch (err) {
      setError('撤销会话失败');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleRevokeAllOther = async () => {
    setIsRevoking(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeAll: true }),
      });

      const data = await response.json();

      if (response.ok) {
        // 只保留当前会话
        setSessions(sessions.filter((s) => s.isCurrent));
        alert(data.message);
      } else {
        setError(data.error || '撤销失败');
      }
    } catch (err) {
      setError('撤销会话失败');
    } finally {
      setIsRevoking(false);
    }
  };

  const openConfirmDialog = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    setConfirmDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                会话管理
              </CardTitle>
              <CardDescription>管理您的登录会话</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRevokeAllOther}>
                <Trash2 className="mr-2 h-4 w-4" />
                撤销其他会话
              </Button>
              <Button variant="outline" size="icon" onClick={fetchSessions}>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>设备信息</TableHead>
                  <TableHead>IP地址</TableHead>
                  <TableHead>最后访问</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>过期时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <span>{session.deviceInfo || '未知设备'}</span>
                        {session.isCurrent && (
                          <Badge variant="default" className="ml-2">
                            当前
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {session.ipAddress || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(session.lastAccessedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(session.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(session.expiresAt)}
                    </TableCell>
                    <TableCell>
                      {isExpired(session.expiresAt) ? (
                        <Badge variant="secondary">已过期</Badge>
                      ) : (
                        <Badge variant="default">活跃</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!session.isCurrent && !isExpired(session.expiresAt) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfirmDialog(session.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      暂无会话记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">安全提示</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 如果发现可疑的登录活动，请立即撤销对应会话并修改密码</li>
              <li>• 建议定期检查登录记录，确保账号安全</li>
              <li>• 每次登录会创建新的会话，会话有效期为7天</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 确认对话框 */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤销会话</DialogTitle>
            <DialogDescription>
              确定要撤销此会话吗？该设备将需要重新登录。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleRevokeSession} disabled={isRevoking}>
              {isRevoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  撤销中...
                </>
              ) : (
                '确认撤销'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

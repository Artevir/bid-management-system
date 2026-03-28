'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  PenTool,
  FileSignature,
  Stamp,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
  Eye,
  Settings,
  Shield,
  Upload,
} from 'lucide-react';

interface SealConfig {
  id: number;
  name: string;
  provider: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
}

interface Seal {
  id: number;
  name: string;
  type: string;
  imageUrl: string;
  configId: number;
  isActive: boolean;
}

interface SignTask {
  id: number;
  documentName: string;
  documentUrl: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  signers: Array<{
    name: string;
    phone: string;
    status: string;
    signedAt: string | null;
  }>;
}

export default function ESignPage() {
  const [configs, setConfigs] = useState<SealConfig[]>([]);
  const [seals, setSeals] = useState<Seal[]>([]);
  const [tasks, setTasks] = useState<SignTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<SignTask | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [configsRes, sealsRes, tasksRes] = await Promise.all([
        fetch('/api/e-sign/configs'),
        fetch('/api/e-sign/seals'),
        fetch('/api/e-sign/tasks'),
      ]);
      const configsData = await configsRes.json();
      const sealsData = await sealsRes.json();
      const tasksData = await tasksRes.json();
      setConfigs(configsData.data || []);
      setSeals(sealsData.data || []);
      setTasks(tasksData.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getTaskStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
      draft: { label: '草稿', variant: 'outline', icon: FileSignature },
      pending: { label: '待签署', variant: 'default', icon: Clock },
      signing: { label: '签署中', variant: 'secondary', icon: PenTool },
      completed: { label: '已完成', variant: 'default', icon: CheckCircle },
      rejected: { label: '已拒绝', variant: 'destructive', icon: XCircle },
      expired: { label: '已过期', variant: 'destructive', icon: Clock },
    };
    const config = statusMap[status] || { label: status, variant: 'outline', icon: FileSignature };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getProviderLabel = (provider: string) => {
    const providerMap: Record<string, string> = {
      fadada: '法大大',
      qianyuebao: 'e签宝',
      qiyasuo: '契约锁',
      shuzibao: '数字宝',
    };
    return providerMap[provider] || provider;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">电子签章</h1>
          <p className="text-muted-foreground">电子合同签署与印章管理</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            发起签署
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{configs.length}</p>
                <p className="text-sm text-muted-foreground">签署配置</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Stamp className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{seals.filter(s => s.isActive).length}</p>
                <p className="text-sm text-muted-foreground">电子印章</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'pending' || t.status === 'signing').length}</p>
                <p className="text-sm text-muted-foreground">待处理任务</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'completed').length}</p>
                <p className="text-sm text-muted-foreground">已完成签署</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主内容区 */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">
            <FileSignature className="mr-2 h-4 w-4" />
            签署任务
          </TabsTrigger>
          <TabsTrigger value="seals">
            <Stamp className="mr-2 h-4 w-4" />
            电子印章
          </TabsTrigger>
          <TabsTrigger value="configs">
            <Settings className="mr-2 h-4 w-4" />
            签署配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>签署任务</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无签署任务</p>
                  <p className="text-sm mt-2">点击"发起签署"开始新的签署流程</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文档名称</TableHead>
                      <TableHead>签署人</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <p className="font-medium">{task.documentName}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {task.signers.length} 人
                          </div>
                        </TableCell>
                        <TableCell>{getTaskStatusBadge(task.status)}</TableCell>
                        <TableCell>
                          {new Date(task.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTask(task)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>电子印章</CardTitle>
              <Button size="sm">
                <Upload className="mr-2 h-4 w-4" />
                上传印章
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : seals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Stamp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无电子印章</p>
                  <p className="text-sm mt-2">点击"上传印章"添加电子印章</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {seals.map((seal) => (
                    <Card key={seal.id} className="overflow-hidden">
                      <div className="aspect-square bg-gray-100 flex items-center justify-center">
                        {seal.imageUrl ? (
                          <img src={seal.imageUrl} alt={seal.name} className="max-w-full max-h-full" />
                        ) : (
                          <Stamp className="h-12 w-12 text-gray-400" />
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="font-medium text-sm truncate">{seal.name}</p>
                        <p className="text-xs text-muted-foreground">{seal.type}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>签署配置</CardTitle>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                添加配置
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : configs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无签署配置</p>
                  <p className="text-sm mt-2">请添加电子签章服务商配置</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>配置名称</TableHead>
                      <TableHead>服务商</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.name}</TableCell>
                        <TableCell>{getProviderLabel(config.provider)}</TableCell>
                        <TableCell>
                          <Badge variant={config.isActive ? 'default' : 'secondary'}>
                            {config.isActive ? '启用' : '禁用'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(config.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 任务详情弹窗 */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.documentName}</DialogTitle>
            <DialogDescription>签署任务详情</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">任务状态</span>
                {getTaskStatusBadge(selectedTask.status)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">签署人列表</p>
                <div className="space-y-2">
                  {selectedTask.signers.map((signer, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{signer.name}</p>
                          <p className="text-sm text-muted-foreground">{signer.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {signer.status === 'signed' ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">已签署</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-4 w-4 text-orange-500" />
                            <span className="text-sm text-orange-600">待签署</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedTask(null)}>
                  关闭
                </Button>
                {selectedTask.status === 'completed' && selectedTask.documentUrl && (
                  <Button asChild>
                    <a href={selectedTask.documentUrl} target="_blank" rel="noopener noreferrer">
                      <Shield className="mr-2 h-4 w-4" />
                      下载已签文档
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

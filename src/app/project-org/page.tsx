'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserPlus,
  Settings,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Copy,
  Eye,
  Building,
  Crown,
  Shield,
  User,
  MessageSquare,
  FileText,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface OrgTemplate {
  id: number;
  name: string;
  type: string;
  description: string | null;
  positions: string;
  isSystem: boolean;
}

interface ProjectPosition {
  id: number;
  name: string;
  permissionLevel: string;
  sortOrder: number;
}

interface ProjectOrgMember {
  id: number;
  positionId: number | null;
  userId: number | null;
  isExternal: boolean;
  externalName: string | null;
  externalPhone: string | null;
  externalEmail: string | null;
  permissionLevel: string;
  joinedAt: string;
  user?: { id: number; name: string; email: string; phone: string };
  position?: { id: number; name: string; permissionLevel: string };
}

interface ProjectOrg {
  id: number;
  projectId: number;
  name: string;
  status: string;
  positions: ProjectPosition[];
  members: ProjectOrgMember[];
}

function ProjectOrgContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [templates, setTemplates] = useState<OrgTemplate[]>([]);
  const [projectOrg, setProjectOrg] = useState<ProjectOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<OrgTemplate | null>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  async function fetchData() {
    setLoading(true);
    try {
      // 获取模板列表
      const templatesRes = await fetch('/api/project-org?type=templates');
      const templatesData = await templatesRes.json();
      setTemplates(templatesData.data || []);

      // 获取项目组织
      if (projectId) {
        const orgRes = await fetch(`/api/project-org?projectId=${projectId}`);
        const orgData = await orgRes.json();
        setProjectOrg(orgData.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createFromTemplate(templateId: number) {
    if (!projectId) {
      alert('请先选择项目');
      return;
    }

    try {
      const res = await fetch('/api/project-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createFromTemplate',
          data: { projectId: parseInt(projectId), templateId, userId: 1 },
        }),
      });
      const data = await res.json();
      if (data.data) {
        setProjectOrg(data.data);
        setShowTemplateDialog(false);
      }
    } catch (error) {
      console.error('Failed to create from template:', error);
    }
  }

  const getPermissionBadge = (level: string) => {
    const levelMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ElementType }> = {
      level_1: { label: '一级权限', variant: 'default', icon: Crown },
      level_2: { label: '二级权限', variant: 'secondary', icon: Shield },
      level_3: { label: '三级权限', variant: 'outline', icon: User },
    };
    const config = levelMap[level] || { label: level, variant: 'outline', icon: User };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      standard: '标准投标模板',
      complex: '复杂项目模板',
      custom: '自定义模板',
    };
    return typeMap[type] || type;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">项目组织架构</h1>
          <p className="text-muted-foreground">为投标项目组建专属团队，管理成员权限</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          {projectOrg && (
            <Button asChild>
              <Link href={`/project-discussions?projectId=${projectId}`}>
                <MessageSquare className="mr-2 h-4 w-4" />
                进入讨论区
              </Link>
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !projectOrg ? (
        // 模板选择界面
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              选择组织架构模板
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {templates.map((template) => {
                const positions = JSON.parse(template.positions || '[]');
                return (
                  <Card key={template.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        {template.isSystem && (
                          <Badge variant="outline" className="text-xs">系统模板</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 mb-4">
                        <p className="text-xs text-muted-foreground">包含岗位：</p>
                        <div className="flex flex-wrap gap-1">
                          {positions.slice(0, 4).map((pos: { name: string }, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {pos.name}
                            </Badge>
                          ))}
                          {positions.length > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{positions.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => createFromTemplate(template.id)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          选用
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setSelectedTemplate(template)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {/* 自定义模板 */}
              <Card className="border-dashed flex flex-col items-center justify-center min-h-[200px] hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Plus className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-medium">自定义模板</p>
                  <p className="text-sm text-muted-foreground">手动添加岗位和成员</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      ) : (
        // 项目组织详情
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 左侧：岗位列表 */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">岗位列表</CardTitle>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {projectOrg.positions.map((position) => (
                  <div
                    key={position.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{position.name}</p>
                        {getPermissionBadge(position.permissionLevel)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {projectOrg.members.filter(m => m.positionId === position.id).length}人
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 右侧：成员列表 */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">团队成员</CardTitle>
              <Button size="sm" onClick={() => setShowAddMemberDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                添加成员
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>成员</TableHead>
                    <TableHead>岗位</TableHead>
                    <TableHead>联系方式</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>加入时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectOrg.members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无成员，请添加团队成员
                      </TableCell>
                    </TableRow>
                  ) : (
                    projectOrg.members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {member.isExternal ? (
                                <User className="h-4 w-4" />
                              ) : (
                                <span className="text-xs font-medium">
                                  {(member.user?.name || member.externalName || '?')[0]}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">
                                {member.isExternal ? member.externalName : member.user?.name || '未知'}
                              </p>
                              {member.isExternal && (
                                <Badge variant="outline" className="text-xs">外部成员</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{member.position?.name || '-'}</TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {member.isExternal
                              ? member.externalPhone || member.externalEmail
                              : member.user?.phone || member.user?.email || '-'}
                          </p>
                        </TableCell>
                        <TableCell>{getPermissionBadge(member.permissionLevel)}</TableCell>
                        <TableCell>
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500">
                              <Trash2 className="h-4 w-4" />
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
        </div>
      )}

      {/* 模板预览弹窗 */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">包含岗位：</p>
                <div className="space-y-2">
                  {JSON.parse(selectedTemplate.positions || '[]').map((pos: { name: string; permissionLevel: string }, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm">{pos.name}</span>
                      {getPermissionBadge(pos.permissionLevel)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                  取消
                </Button>
                <Button onClick={() => {
                  createFromTemplate(selectedTemplate.id);
                  setSelectedTemplate(null);
                }}>
                  选用此模板
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 添加成员弹窗 */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加成员</DialogTitle>
            <DialogDescription>添加项目团队成员</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">成员类型</label>
              <Select defaultValue="internal">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">内部员工</SelectItem>
                  <SelectItem value="external">外部协作人员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">选择岗位</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择岗位" />
                </SelectTrigger>
                <SelectContent>
                  {projectOrg?.positions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id.toString()}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
                取消
              </Button>
              <Button onClick={() => setShowAddMemberDialog(false)}>
                确认添加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProjectOrgPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ProjectOrgContent />
    </Suspense>
  );
}

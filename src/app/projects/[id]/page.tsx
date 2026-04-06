'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ParseDashboard } from '@/components/parse/parse-dashboard';
import ProjectDashboard from '@/components/dashboard/project-dashboard';
import { ProcessRecords } from '@/components/project/process-records';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  Building2,
  MapPin as _MapPin,
  User,
  Clock,
  FileText,
  CheckCircle,
  AlertTriangle,
  Play,
  Sparkles,
  LayoutDashboard,
  ArrowRight,
  FileCheck,
  FileStack,
} from 'lucide-react';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  ProjectStatus,
} from '@/types/project';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ProjectDetail {
  id: number;
  name: string;
  code: string;
  tenderCode: string | null;
  type: string | null;
  industry: string | null;
  region: string | null;
  status: ProjectStatus;
  progress: number;
  tenderOrganization: string | null;
  tenderAgent: string | null;
  tenderMethod: string | null;
  budget: string | null;
  publishDate: string | null;
  registerDeadline: string | null;
  questionDeadline: string | null;
  submissionDeadline: string | null;
  openBidDate: string | null;
  description: string | null;
  tags: TagItem[];
  ownerId: number;
  ownerName: string;
  departmentId: number;
  departmentName: string;
  currentPhaseId: number | null;
  totalScore: number | null;
  completedScore: number | null;
  phases: PhaseItem[];
  milestones: MilestoneItem[];
  createdAt: string;
  updatedAt: string;
  // 文件解读信息
  interpretationId: number | null;
  interpretation?: {
    id: number;
    documentName: string;
    status: string;
    basicInfo: any;
    technicalSpecs: any[];
    scoringItems: any[];
    checklist: any[];
    documentFramework: any[];
  } | null;
}

interface TagItem {
  id: number;
  name: string;
  color: string;
}

interface PhaseItem {
  id: number;
  type: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
}

interface MilestoneItem {
  id: number;
  phaseId: number | null;
  name: string;
  description: string | null;
  dueDate: string;
  completedAt: string | null;
  status: string;
  reminderSent: boolean;
  reminderDays: number;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = parseInt(params.id as string);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        throw new Error('获取项目详情失败');
      }
      const data = await res.json();
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取项目详情失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'yyyy-MM-dd', { locale: zhCN });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'yyyy-MM-dd HH:mm', { locale: zhCN });
  };

  const getStatusBadge = (status: ProjectStatus) => {
    const colorMap: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      cyan: 'bg-cyan-100 text-cyan-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      emerald: 'bg-emerald-100 text-emerald-800',
      red: 'bg-red-100 text-red-800',
      slate: 'bg-slate-100 text-slate-800',
    };
    const color = PROJECT_STATUS_COLORS[status];
    return (
      <Badge className={colorMap[color] || colorMap.gray}>
        {PROJECT_STATUS_LABELS[status]}
      </Badge>
    );
  };

  const getPhaseStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Play className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getMilestoneStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || '项目不存在'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground">
              项目编码: {project.code}
              {project.tenderCode && ` | 招标编号: ${project.tenderCode}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(project.status)}
        </div>
      </div>

      {/* 项目概览 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">项目进度</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.progress}%</div>
            <Progress value={project.progress} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">负责人</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.ownerName}</div>
            <p className="text-xs text-muted-foreground">{project.departmentName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">投标截止</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDate(project.submissionDeadline)}</div>
            <p className="text-xs text-muted-foreground">
              开标: {formatDate(project.openBidDate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">预算金额</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.budget || '-'}</div>
            <p className="text-xs text-muted-foreground">{project.tenderMethod || '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* 详细信息标签页 */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="h-4 w-4 mr-1" />
            项目看板
          </TabsTrigger>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          {project.interpretation && (
            <TabsTrigger value="interpretation">
              <FileText className="h-4 w-4 mr-1" />
              解读信息
            </TabsTrigger>
          )}
          <TabsTrigger value="parse">
            <Sparkles className="h-4 w-4 mr-1" />
            文档解析
          </TabsTrigger>
          <TabsTrigger value="phases">项目阶段</TabsTrigger>
          <TabsTrigger value="milestones">关键节点</TabsTrigger>
          <TabsTrigger value="process">
            <FileStack className="h-4 w-4 mr-1" />
            过程记录
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileCheck className="h-4 w-4 mr-1" />
            投标文档
          </TabsTrigger>
          <TabsTrigger value="files">项目文件</TabsTrigger>
          <TabsTrigger value="members">项目成员</TabsTrigger>
        </TabsList>

        {/* 看板 */}
        <TabsContent value="dashboard">
          <ProjectDashboard projectId={project.id} />
        </TabsContent>

        {/* 解读信息 */}
        {project.interpretation && (
          <TabsContent value="interpretation" className="space-y-4">
            {/* 关联信息 */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">关联解读文档</p>
                    <p className="text-sm text-blue-700">
                      {project.interpretation.documentName} · 状态: {project.interpretation.status}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/interpretations/${project.interpretation.id}`}>
                    查看详情
                    <ArrowRight className="w-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* 基本信息 */}
            {project.interpretation.basicInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">项目基本信息</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(project.interpretation.basicInfo as Record<string, any>).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-sm text-muted-foreground">{key}</p>
                        <p className="font-medium">{String(value || '-')}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 技术规格 */}
            {project.interpretation.technicalSpecs && project.interpretation.technicalSpecs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">技术规格要求</CardTitle>
                  <CardDescription>共 {project.interpretation.technicalSpecs.length} 项</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>序号</TableHead>
                        <TableHead>名称</TableHead>
                        <TableHead>规格要求</TableHead>
                        <TableHead>单位</TableHead>
                        <TableHead>数量</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.interpretation.technicalSpecs.slice(0, 10).map((spec: any, index: number) => (
                        <TableRow key={spec.id || index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{spec.name || '-'}</TableCell>
                          <TableCell>{spec.specification || '-'}</TableCell>
                          <TableCell>{spec.unit || '-'}</TableCell>
                          <TableCell>{spec.quantity || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {project.interpretation.technicalSpecs.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      仅显示前 10 项，共 {project.interpretation.technicalSpecs.length} 项
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 评分细则 */}
            {project.interpretation.scoringItems && project.interpretation.scoringItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">评分细则</CardTitle>
                  <CardDescription>共 {project.interpretation.scoringItems.length} 项</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>序号</TableHead>
                        <TableHead>评分项</TableHead>
                        <TableHead>分值</TableHead>
                        <TableHead>评分标准</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.interpretation.scoringItems.slice(0, 10).map((item: any, index: number) => (
                        <TableRow key={item.id || index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{item.name || '-'}</TableCell>
                          <TableCell>{item.score || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate">{item.criteria || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {project.interpretation.scoringItems.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      仅显示前 10 项，共 {project.interpretation.scoringItems.length} 项
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 文档框架 */}
            {project.interpretation.documentFramework && project.interpretation.documentFramework.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">投标文件框架</CardTitle>
                  <CardDescription>共 {project.interpretation.documentFramework.length} 项</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {project.interpretation.documentFramework.slice(0, 15).map((item: any, index: number) => (
                      <div key={item.id || index} className="flex items-center gap-2 py-2 border-b last:border-0">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {item.sortOrder || index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{item.name || '-'}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        {item.isRequired && (
                          <Badge variant="outline" className="text-xs">必填</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  {project.interpretation.documentFramework.length > 15 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      仅显示前 15 项，共 {project.interpretation.documentFramework.length} 项
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 核对清单 */}
            {project.interpretation.checklist && project.interpretation.checklist.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">资质要求核对清单</CardTitle>
                  <CardDescription>共 {project.interpretation.checklist.length} 项</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {project.interpretation.checklist.slice(0, 15).map((item: any, index: number) => (
                      <div key={item.id || index} className="flex items-start gap-2 py-2 border-b last:border-0">
                        <CheckCircle className="w-4 h-4 mt-1 text-green-500" />
                        <div className="flex-1">
                          <p className="font-medium">{item.name || '-'}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        {item.isRequired && (
                          <Badge variant="outline" className="text-xs">必需</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  {project.interpretation.checklist.length > 15 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      仅显示前 15 项，共 {project.interpretation.checklist.length} 项
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* 基本信息 */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>招标信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">招标单位</p>
                  <p className="font-medium">{project.tenderOrganization || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">招标代理</p>
                  <p className="font-medium">{project.tenderAgent || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">项目类型</p>
                  <p className="font-medium">{project.type || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">所属行业</p>
                  <p className="font-medium">{project.industry || '-'}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">所属区域</p>
                  <p className="font-medium">{project.region || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">招标公告日期</p>
                  <p className="font-medium">{formatDate(project.publishDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">报名截止日期</p>
                  <p className="font-medium">{formatDate(project.registerDeadline)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">答疑截止日期</p>
                  <p className="font-medium">{formatDate(project.questionDeadline)}</p>
                </div>
              </div>

              {project.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">项目描述</p>
                    <p className="text-sm">{project.description}</p>
                  </div>
                </>
              )}

              {project.tags && project.tags.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">项目标签</p>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <Badge 
                          key={tag.id} 
                          variant="outline"
                          className="flex items-center gap-1"
                          style={{ borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 文档解析 */}
        <TabsContent value="parse">
          <ParseDashboard projectId={projectId} />
        </TabsContent>

        {/* 项目阶段 */}
        <TabsContent value="phases">
          <Card>
            <CardHeader>
              <CardTitle>项目阶段</CardTitle>
              <CardDescription>项目各阶段进度跟踪</CardDescription>
            </CardHeader>
            <CardContent>
              {project.phases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无阶段信息
                </div>
              ) : (
                <div className="space-y-4">
                  {project.phases.map((phase, _index) => (
                    <div
                      key={phase.id}
                      className="flex items-start gap-4 p-4 border rounded-lg"
                    >
                      <div className="mt-1">{getPhaseStatusIcon(phase.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{phase.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {phase.status === 'completed'
                              ? '已完成'
                              : phase.status === 'in_progress'
                              ? '进行中'
                              : '待开始'}
                          </Badge>
                        </div>
                        {phase.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {phase.description}
                          </p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {phase.startDate && (
                            <span>开始: {formatDate(phase.startDate)}</span>
                          )}
                          {phase.endDate && <span>结束: {formatDate(phase.endDate)}</span>}
                          {phase.completedAt && (
                            <span>完成: {formatDate(phase.completedAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 关键节点 */}
        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <CardTitle>关键节点</CardTitle>
              <CardDescription>项目关键时间节点跟踪</CardDescription>
            </CardHeader>
            <CardContent>
              {project.milestones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无关键节点
                </div>
              ) : (
                <div className="space-y-4">
                  {project.milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-start gap-4 p-4 border rounded-lg"
                    >
                      <div className="mt-1">{getMilestoneStatusIcon(milestone.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{milestone.name}</span>
                          <Badge
                            variant={
                              milestone.status === 'completed'
                                ? 'default'
                                : milestone.status === 'overdue'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {milestone.status === 'completed'
                              ? '已完成'
                              : milestone.status === 'overdue'
                              ? '已逾期'
                              : '待完成'}
                          </Badge>
                        </div>
                        {milestone.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {milestone.description}
                          </p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>截止日期: {formatDate(milestone.dueDate)}</span>
                          {milestone.completedAt && (
                            <span>完成时间: {formatDateTime(milestone.completedAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 过程记录 */}
        <TabsContent value="process">
          <ProcessRecords projectId={project.id} />
        </TabsContent>

        {/* 投标文档 */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>投标文档</CardTitle>
              <CardDescription>管理项目的投标文档和章节内容</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Link href={`/projects/${project.id}/documents`}>
                  <Button>进入文档管理</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 项目文件 */}
        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>项目文件</CardTitle>
              <CardDescription>项目相关文件管理</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                文件管理功能开发中...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 项目成员 */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>项目成员</CardTitle>
              <CardDescription>项目团队成员管理</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                成员管理功能开发中...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

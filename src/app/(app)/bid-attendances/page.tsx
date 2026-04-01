'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription as _CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  MapPin,
  Calendar,
  Users,
  Send,
  ExternalLink,
  Ban,
  CheckCircle,
  Clock,
  FileText,
  Car as _Car,
  UserCheck as _UserCheck,
  X,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/error-message';

// 投标状态
const ATTENDANCE_STATUS = [
  { value: 'pending', label: '待出发', color: 'yellow' },
  { value: 'in_progress', label: '进行中', color: 'blue' },
  { value: 'submitted', label: '已投标', color: 'purple' },
  { value: 'completed', label: '已完成', color: 'green' },
  { value: 'cancelled', label: '已取消', color: 'gray' },
];

// 出行方式
const TRAVEL_MODES = [
  { value: 'together', label: '一起去', description: '统一集合，到现场后分开行动' },
  { value: 'separate', label: '分开去', description: '各自前往投标地点' },
];

// 人员身份
const BIDDER_IDENTITIES = [
  { value: 'agent', label: '代理人', description: '需携带身份证和授权委托书' },
  { value: 'legal_representative', label: '法定代表人', description: '需携带身份证和法人身份证明' },
];

// 交通方式
const TRANSPORT_MODES = [
  { value: 'self_drive', label: '自驾' },
  { value: 'taxi', label: '打车' },
  { value: 'public_transport', label: '公共交通' },
];

interface BidAttendee {
  id: number;
  userId: number | null;
  name: string;
  phone: string | null;
  idCardNo: string | null;
  identity: string;
  authorizationLetter: boolean;
  authorizationLetterUrl: string | null;
  legalRepCertificate: boolean;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  idCardProvided: boolean;
  separateTravelMode: string | null;
  separateMeetingPoint: string | null;
  separateMeetingTime: string | null;
  remarks: string | null;
}

interface BidAttendance {
  id: number;
  projectId: number | null;
  projectName: string;
  projectCode: string | null;
  bidDate: string | null;
  bidDeadline: string | null;
  bidLocation: string | null;
  bidLocationDetail: string | null;
  travelMode: string;
  meetingPoint: string | null;
  meetingTime: string | null;
  transportMode: string | null;
  transportRemarks: string | null;
  documentsNeeded: string | null;
  specialInstructions: string | null;
  status: string;
  completedAt: string | null;
  taskId: number | null;
  createdAt: string;
  updatedAt: string;
  attendees?: BidAttendee[];
}

interface Statistics {
  total: number;
  pending: number;
  inProgress: number;
  submitted: number;
  completed: number;
  cancelled: number;
}

interface User {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
  code: string | null;
}

export default function BidAttendancesPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<BidAttendance[]>([]);
  const [stats, setStats] = useState<Statistics>({
    total: 0,
    pending: 0,
    inProgress: 0,
    submitted: 0,
    completed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 筛选条件
  const [statusFilter, setStatusFilter] = useState('');
  const [travelModeFilter, setTravelModeFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  
  // 新增/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  
  // 详情对话框
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<BidAttendance | null>(null);
  
  // 推送任务中
  const [pushingTaskId, setPushingTaskId] = useState<number | null>(null);
  
  // 下拉选项
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // 表单数据
  const [formData, setFormData] = useState({
    projectId: '',
    projectName: '',
    projectCode: '',
    bidDate: '',
    bidDeadline: '',
    bidLocation: '',
    bidLocationDetail: '',
    travelMode: 'together',
    meetingPoint: '',
    meetingTime: '',
    transportMode: '',
    transportRemarks: '',
    documentsNeeded: [] as string[],
    specialInstructions: '',
    status: 'pending',
  });
  
  // 投标人员列表
  const [attendees, setAttendees] = useState<{
    userId: string;
    name: string;
    phone: string;
    identity: string;
    idCardProvided: boolean;
    authorizationLetter: boolean;
    separateTravelMode: string;
    separateMeetingPoint: string;
    remarks: string;
  }[]>([]);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (travelModeFilter) params.append('travelMode', travelModeFilter);
      if (keyword) params.append('keyword', keyword);
      
      const response = await fetch(`/api/bid-attendances?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setApplications(result.data);
      } else {
        setError(extractErrorMessage(result, '加载数据失败'));
      }
      
      // 加载统计
      const statsResponse = await fetch('/api/bid-attendances?stats=true');
      const statsResult = await statsResponse.json();
      if (statsResult.success) {
        setStats(statsResult.stats);
      }
    } catch (_err) {
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载用户列表
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/bid-attendances?users=true');
      const result = await response.json();
      if (result.success) {
        setUsers(result.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  // 加载项目列表
  const loadProjects = async () => {
    try {
      const response = await fetch('/api/bid-attendances?projects=true');
      const result = await response.json();
      if (result.success) {
        setProjects(result.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadUsers();
    loadProjects();
  }, [statusFilter, travelModeFilter]);

  // 打开新增对话框
  const handleAdd = () => {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (application: BidAttendance) => {
    setEditingId(application.id);
    setFormData({
      projectId: application.projectId?.toString() || '',
      projectName: application.projectName,
      projectCode: application.projectCode || '',
      bidDate: application.bidDate ? application.bidDate.split('T')[0] : '',
      bidDeadline: application.bidDeadline ? application.bidDeadline.split('T')[0] : '',
      bidLocation: application.bidLocation || '',
      bidLocationDetail: application.bidLocationDetail || '',
      travelMode: application.travelMode,
      meetingPoint: application.meetingPoint || '',
      meetingTime: application.meetingTime ? application.meetingTime.split('T')[0] + 'T' + application.meetingTime.split('T')[1]?.slice(0, 5) : '',
      transportMode: application.transportMode || '',
      transportRemarks: application.transportRemarks || '',
      documentsNeeded: application.documentsNeeded ? JSON.parse(application.documentsNeeded) : [],
      specialInstructions: application.specialInstructions || '',
      status: application.status,
    });
    
    // 设置人员列表
    if (application.attendees && application.attendees.length > 0) {
      setAttendees(application.attendees.map(a => ({
        userId: a.userId?.toString() || '',
        name: a.name,
        phone: a.phone || '',
        identity: a.identity,
        idCardProvided: a.idCardProvided,
        authorizationLetter: a.authorizationLetter,
        separateTravelMode: a.separateTravelMode || '',
        separateMeetingPoint: a.separateMeetingPoint || '',
        remarks: a.remarks || '',
      })));
    } else {
      setAttendees([]);
    }
    
    setError('');
    setDialogOpen(true);
  };

  // 查看详情
  const handleView = (application: BidAttendance) => {
    setSelectedApplication(application);
    setDetailOpen(true);
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      projectId: '',
      projectName: '',
      projectCode: '',
      bidDate: '',
      bidDeadline: '',
      bidLocation: '',
      bidLocationDetail: '',
      travelMode: 'together',
      meetingPoint: '',
      meetingTime: '',
      transportMode: '',
      transportRemarks: '',
      documentsNeeded: [],
      specialInstructions: '',
      status: 'pending',
    });
    setAttendees([]);
    setError('');
  };

  // 添加人员
  const addAttendee = () => {
    setAttendees([...attendees, {
      userId: '',
      name: '',
      phone: '',
      identity: 'agent',
      idCardProvided: false,
      authorizationLetter: false,
      separateTravelMode: '',
      separateMeetingPoint: '',
      remarks: '',
    }]);
  };

  // 删除人员
  const removeAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index));
  };

  // 更新人员信息
  const updateAttendee = (index: number, field: string, value: any) => {
    const updated = [...attendees];
    (updated[index] as any)[field] = value;
    setAttendees(updated);
  };

  // 从用户选择填充姓名
  const handleUserSelect = (index: number, userId: string) => {
    const user = users.find(u => u.id === parseInt(userId));
    if (user) {
      const updated = [...attendees];
      updated[index].userId = userId;
      updated[index].name = user.name;
      setAttendees(updated);
    }
  };

  // 保存数据
  const handleSave = async () => {
    // 验证必填字段
    if (!formData.projectName) {
      setError('请填写项目名称');
      return;
    }
    
    // 验证人员信息
    if (attendees.length === 0) {
      setError('请添加至少一名投标人员');
      return;
    }
    
    for (const attendee of attendees) {
      if (!attendee.name) {
        setError('请填写所有人员的姓名');
        return;
      }
    }

    setSaving(true);
    try {
      const url = '/api/bid-attendances';
      const method = editingId ? 'PUT' : 'POST';
      const body = {
        id: editingId,
        ...formData,
        attendees: attendees.map(a => ({
          userId: a.userId ? parseInt(a.userId) : null,
          name: a.name,
          phone: a.phone || null,
          identity: a.identity,
          idCardProvided: a.idCardProvided,
          authorizationLetter: a.identity === 'agent' ? a.authorizationLetter : false,
          separateTravelMode: formData.travelMode === 'separate' ? a.separateTravelMode : null,
          separateMeetingPoint: formData.travelMode === 'separate' ? a.separateMeetingPoint : null,
          remarks: a.remarks || null,
        })),
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setDialogOpen(false);
        resetForm();
        loadData();
      } else {
        setError(extractErrorMessage(result, '保存失败'));
      }
    } catch (_err) {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除数据
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条去投标安排吗？')) return;

    try {
      const response = await fetch(`/api/bid-attendances?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        loadData();
      } else {
        alert(extractErrorMessage(result, '删除失败'));
      }
    } catch (_err) {
      alert('删除失败');
    }
  };

  // 推送到任务中心
  const handlePushTask = async (id: number) => {
    setPushingTaskId(id);
    try {
      const response = await fetch(`/api/bid-attendances/${id}/push-task`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert('已推送到任务中心');
        loadData();
      } else {
        alert(extractErrorMessage(result, '推送失败'));
      }
    } catch (_err) {
      alert('推送失败');
    } finally {
      setPushingTaskId(null);
    }
  };

  // 更新状态
  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const response = await fetch('/api/bid-attendances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      const result = await response.json();

      if (result.success) {
        loadData();
      } else {
        alert(extractErrorMessage(result, '更新状态失败'));
      }
    } catch (_err) {
      alert('更新状态失败');
    }
  };

  // 获取状态样式
  const getStatusBadge = (status: string) => {
    const statusConfig = ATTENDANCE_STATUS.find(s => s.value === status);
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      purple: 'bg-purple-100 text-purple-800',
      green: 'bg-green-100 text-green-800',
      gray: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colorMap[statusConfig?.color || 'gray']}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  // 获取出行方式显示
  const getTravelModeLabel = (mode: string) => {
    const modeConfig = TRAVEL_MODES.find(m => m.value === mode);
    return modeConfig?.label || mode;
  };

  // 获取身份显示
  const getIdentityLabel = (identity: string) => {
    const identityConfig = BIDDER_IDENTITIES.find(i => i.value === identity);
    return identityConfig?.label || identity;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            去投标
          </h1>
          <p className="text-muted-foreground">管理投标人员安排和出行计划</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          新增投标安排
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待出发</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">进行中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已投标</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已完成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已取消</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>关键词搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索项目名称或编号..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                />
              </div>
            </div>
            <div className="w-40">
              <Label>状态</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  {ATTENDANCE_STATUS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label>出行方式</Label>
              <Select value={travelModeFilter} onValueChange={setTravelModeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="全部方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部方式</SelectItem>
                  {TRAVEL_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadData}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : applications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无去投标安排数据</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>投标日期</TableHead>
                  <TableHead>投标地点</TableHead>
                  <TableHead>出行方式</TableHead>
                  <TableHead>投标人员</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{application.projectName}</div>
                        {application.projectCode && (
                          <div className="text-sm text-muted-foreground">{application.projectCode}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {application.bidDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(application.bidDate)}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-[200px] truncate" title={application.bidLocation || ''}>
                        {application.bidLocation || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTravelModeLabel(application.travelMode)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {application.attendees?.length || 0}人
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(application.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(application)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(application)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {application.status !== 'completed' && application.status !== 'cancelled' && (
                          <>
                            {!application.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePushTask(application.id)}
                                disabled={pushingTaskId === application.id}
                              >
                                {pushingTaskId === application.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {application.taskId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/tasks/${application.taskId}`)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        {application.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(application.id, 'in_progress')}
                          >
                            <Clock className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {application.status === 'in_progress' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(application.id, 'submitted')}
                          >
                            <CheckCircle className="h-4 w-4 text-purple-600" />
                          </Button>
                        )}
                        {application.status === 'submitted' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(application.id, 'completed')}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(application.id)}
                        >
                          <Ban className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑投标安排' : '新增投标安排'}</DialogTitle>
            <DialogDescription>
              填写投标安排信息，包括投标人员身份和出行方式
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{String(error)}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {/* 项目信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">项目信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>关联项目</Label>
                  <Select 
                    value={formData.projectId} 
                    onValueChange={(value) => {
                      const project = projects.find(p => p.id === parseInt(value));
                      setFormData({
                        ...formData,
                        projectId: value,
                        projectName: project?.name || '',
                        projectCode: project?.code || '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>项目名称 *</Label>
                  <Input
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    placeholder="输入项目名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label>项目编号</Label>
                  <Input
                    value={formData.projectCode}
                    onChange={(e) => setFormData({ ...formData, projectCode: e.target.value })}
                    placeholder="输入项目编号"
                  />
                </div>
                <div className="space-y-2">
                  <Label>截标时间</Label>
                  <Input
                    type="datetime-local"
                    value={formData.bidDeadline}
                    onChange={(e) => setFormData({ ...formData, bidDeadline: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 投标信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">投标信息</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>投标日期 *</Label>
                  <Input
                    type="date"
                    value={formData.bidDate}
                    onChange={(e) => setFormData({ ...formData, bidDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>投标地点</Label>
                  <Input
                    value={formData.bidLocation}
                    onChange={(e) => setFormData({ ...formData, bidLocation: e.target.value })}
                    placeholder="输入投标地点"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>详细地址</Label>
                  <Textarea
                    value={formData.bidLocationDetail}
                    onChange={(e) => setFormData({ ...formData, bidLocationDetail: e.target.value })}
                    placeholder="输入详细地址"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 出行方式 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">出行方式</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {TRAVEL_MODES.map((mode) => (
                    <div
                      key={mode.value}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        formData.travelMode === mode.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setFormData({ ...formData, travelMode: mode.value })}
                    >
                      <div className="font-medium">{mode.label}</div>
                      <div className="text-sm text-muted-foreground">{mode.description}</div>
                    </div>
                  ))}
                </div>

                {/* 一起去：集合信息 */}
                {formData.travelMode === 'together' && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>集合地点</Label>
                      <Input
                        value={formData.meetingPoint}
                        onChange={(e) => setFormData({ ...formData, meetingPoint: e.target.value })}
                        placeholder="输入集合地点"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>集合时间</Label>
                      <Input
                        type="datetime-local"
                        value={formData.meetingTime}
                        onChange={(e) => setFormData({ ...formData, meetingTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>交通方式</Label>
                      <Select
                        value={formData.transportMode}
                        onValueChange={(value) => setFormData({ ...formData, transportMode: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择交通方式" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSPORT_MODES.map((mode) => (
                            <SelectItem key={mode.value} value={mode.value}>
                              {mode.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>交通备注</Label>
                      <Input
                        value={formData.transportRemarks}
                        onChange={(e) => setFormData({ ...formData, transportRemarks: e.target.value })}
                        placeholder="输入交通备注"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 投标人员 */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">投标人员 *</CardTitle>
                <Button variant="outline" size="sm" onClick={addAttendee}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加人员
                </Button>
              </CardHeader>
              <CardContent>
                {attendees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>请添加投标人员</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attendees.map((attendee, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">人员 {index + 1}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttendee(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>选择用户</Label>
                            <Select
                              value={attendee.userId}
                              onValueChange={(value) => handleUserSelect(index, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="选择用户" />
                              </SelectTrigger>
                              <SelectContent>
                                {users.map((user) => (
                                  <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>姓名 *</Label>
                            <Input
                              value={attendee.name}
                              onChange={(e) => updateAttendee(index, 'name', e.target.value)}
                              placeholder="输入姓名"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>联系电话</Label>
                            <Input
                              value={attendee.phone}
                              onChange={(e) => updateAttendee(index, 'phone', e.target.value)}
                              placeholder="输入联系电话"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>身份类型 *</Label>
                            <Select
                              value={attendee.identity}
                              onValueChange={(value) => updateAttendee(index, 'identity', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="选择身份" />
                              </SelectTrigger>
                              <SelectContent>
                                {BIDDER_IDENTITIES.map((identity) => (
                                  <SelectItem key={identity.value} value={identity.value}>
                                    {identity.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {BIDDER_IDENTITIES.find(i => i.value === attendee.identity)?.description}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>材料准备情况</Label>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={attendee.idCardProvided}
                                  onCheckedChange={(checked) => 
                                    updateAttendee(index, 'idCardProvided', checked)
                                  }
                                />
                                <Label className="font-normal">身份证已提供</Label>
                              </div>
                              {attendee.identity === 'agent' && (
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={attendee.authorizationLetter}
                                    onCheckedChange={(checked) => 
                                      updateAttendee(index, 'authorizationLetter', checked)
                                    }
                                  />
                                  <Label className="font-normal">授权委托书已准备</Label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 分开去：单独出行信息 */}
                        {formData.travelMode === 'separate' && (
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div className="space-y-2">
                              <Label>出行方式</Label>
                              <Select
                                value={attendee.separateTravelMode}
                                onValueChange={(value) => 
                                  updateAttendee(index, 'separateTravelMode', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="选择出行方式" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TRANSPORT_MODES.map((mode) => (
                                    <SelectItem key={mode.value} value={mode.value}>
                                      {mode.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>备注</Label>
                              <Input
                                value={attendee.remarks}
                                onChange={(e) => updateAttendee(index, 'remarks', e.target.value)}
                                placeholder="输入备注"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 其他信息 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">其他信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>特殊说明</Label>
                  <Textarea
                    value={formData.specialInstructions}
                    onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
                    placeholder="输入特殊说明或注意事项"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>投标安排详情</DialogTitle>
          </DialogHeader>
          
          {selectedApplication && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">项目名称</Label>
                  <p className="font-medium">{selectedApplication.projectName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">项目编号</Label>
                  <p className="font-medium">{selectedApplication.projectCode || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">投标日期</Label>
                  <p className="font-medium">
                    {selectedApplication.bidDate ? formatDate(selectedApplication.bidDate) : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">截标时间</Label>
                  <p className="font-medium">
                    {selectedApplication.bidDeadline ? formatDate(selectedApplication.bidDeadline) : '-'}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">投标地点</Label>
                  <p className="font-medium">{selectedApplication.bidLocation || '-'}</p>
                  {selectedApplication.bidLocationDetail && (
                    <p className="text-sm text-muted-foreground">{selectedApplication.bidLocationDetail}</p>
                  )}
                </div>
              </div>

              {/* 出行方式 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">出行方式</Label>
                <div className="mt-2">
                  <Badge variant="outline" className="text-base">
                    {getTravelModeLabel(selectedApplication.travelMode)}
                  </Badge>
                </div>
                {selectedApplication.travelMode === 'together' && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label className="text-muted-foreground text-sm">集合地点</Label>
                      <p>{selectedApplication.meetingPoint || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">集合时间</Label>
                      <p>{selectedApplication.meetingTime ? formatDate(selectedApplication.meetingTime) : '-'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 投标人员 */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">投标人员 ({selectedApplication.attendees?.length || 0}人)</Label>
                {selectedApplication.attendees && selectedApplication.attendees.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {selectedApplication.attendees.map((attendee, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <span className="font-medium">{attendee.name}</span>
                          <span className="text-muted-foreground mx-2">|</span>
                          <Badge variant="outline">{getIdentityLabel(attendee.identity)}</Badge>
                          {attendee.phone && (
                            <span className="text-muted-foreground mx-2">|</span>
                          )}
                          <span className="text-muted-foreground text-sm">{attendee.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {attendee.idCardProvided && (
                            <Badge className="bg-green-100 text-green-800">身份证已提供</Badge>
                          )}
                          {attendee.identity === 'agent' && attendee.authorizationLetter && (
                            <Badge className="bg-blue-100 text-blue-800">授权委托书已准备</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 特殊说明 */}
              {selectedApplication.specialInstructions && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">特殊说明</Label>
                  <p className="mt-2 whitespace-pre-wrap">{selectedApplication.specialInstructions}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
            <Button onClick={() => {
              setDetailOpen(false);
              if (selectedApplication) {
                handleEdit(selectedApplication);
              }
            }}>
              编辑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

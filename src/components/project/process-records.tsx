'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  FileText,
  Phone,
  ListTodo,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Users,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator as _Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProcessRecordsProps {
  projectId: number;
}

// 会议纪要类型
interface MeetingMinute {
  id: number;
  projectId: number;
  title: string;
  content: string;
  meetingDate: string;
  participants: string[] | null;
  location: string | null;
  meetingType: string | null;
  attachments: any[] | null;
  createdBy: number;
  createdAt: string;
  creator?: {
    id: number;
    username: string;
  };
}

// 客户对接记录类型
interface ContactRecord {
  id: number;
  projectId: number;
  contactType: string;
  contactDate: string;
  contactPerson: string;
  contactOrg: string | null;
  ourPerson: string;
  content: string;
  result: string | null;
  followUp: string | null;
  nextContactDate: string | null;
  createdBy: number;
  createdAt: string;
}

// 项目任务类型
interface ProjectTask {
  id: number;
  projectId: number;
  phaseId: number | null;
  title: string;
  description: string | null;
  assigneeId: number | null;
  priority: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  parentId: number | null;
  createdAt: string;
  assignee?: {
    id: number;
    username: string;
  } | null;
}

const meetingTypeLabels: Record<string, string> = {
  kickoff: '启动会',
  review: '评审会',
  coordination: '协调会',
  other: '其他',
};

const contactTypeLabels: Record<string, string> = {
  phone: '电话',
  email: '邮件',
  meeting: '会议',
  site_visit: '现场考察',
};

const priorityLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const statusLabels: Record<string, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function ProcessRecords({ projectId }: ProcessRecordsProps) {
  const [activeTab, setActiveTab] = React.useState('meetings');
  const [meetings, setMeetings] = React.useState<MeetingMinute[]>([]);
  const [contacts, setContacts] = React.useState<ContactRecord[]>([]);
  const [tasks, setTasks] = React.useState<ProjectTask[]>([]);
  const [loading, setLoading] = React.useState(true);

  // 对话框状态
  const [showMeetingDialog, setShowMeetingDialog] = React.useState(false);
  const [showContactDialog, setShowContactDialog] = React.useState(false);
  const [showTaskDialog, setShowTaskDialog] = React.useState(false);
  const [editingMeeting, setEditingMeeting] = React.useState<MeetingMinute | null>(null);
  const [editingContact, setEditingContact] = React.useState<ContactRecord | null>(null);
  const [editingTask, setEditingTask] = React.useState<ProjectTask | null>(null);

  // 表单状态
  const [meetingForm, setMeetingForm] = React.useState({
    title: '',
    content: '',
    meetingDate: '',
    participants: '',
    location: '',
    meetingType: 'other',
  });

  const [contactForm, setContactForm] = React.useState({
    contactType: 'phone',
    contactDate: '',
    contactPerson: '',
    contactOrg: '',
    ourPerson: '',
    content: '',
    result: '',
    followUp: '',
    nextContactDate: '',
  });

  const [taskForm, setTaskForm] = React.useState({
    title: '',
    description: '',
    assigneeId: '',
    priority: 'medium',
    dueDate: '',
  });

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [meetingsRes, contactsRes, tasksRes] = await Promise.all([
        fetch(`/api/process/meetings?projectId=${projectId}`),
        fetch(`/api/process/contacts?projectId=${projectId}`),
        fetch(`/api/process/tasks?projectId=${projectId}`),
      ]);

      if (meetingsRes.ok) {
        const data = await meetingsRes.json();
        setMeetings(data.minutes || []);
      }

      if (contactsRes.ok) {
        const data = await contactsRes.json();
        setContacts(data.records || []);
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, [projectId]);

  // 会议纪要操作
  const handleSaveMeeting = async () => {
    const payload = {
      projectId,
      title: meetingForm.title,
      content: meetingForm.content,
      meetingDate: meetingForm.meetingDate,
      participants: meetingForm.participants
        ? meetingForm.participants.split(',').map((p) => p.trim())
        : undefined,
      location: meetingForm.location || undefined,
      meetingType: meetingForm.meetingType,
    };

    try {
      const url = '/api/process/meetings';
      const method = editingMeeting ? 'PUT' : 'POST';
      const body = editingMeeting ? { id: editingMeeting.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowMeetingDialog(false);
        setEditingMeeting(null);
        setMeetingForm({
          title: '',
          content: '',
          meetingDate: '',
          participants: '',
          location: '',
          meetingType: 'other',
        });
        loadData();
      }
    } catch (error) {
      console.error('Save meeting error:', error);
    }
  };

  const handleDeleteMeeting = async (id: number) => {
    if (!confirm('确定要删除这条会议纪要吗？')) return;

    try {
      const res = await fetch(`/api/process/meetings?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Delete meeting error:', error);
    }
  };

  // 客户对接记录操作
  const handleSaveContact = async () => {
    const payload = {
      projectId,
      contactType: contactForm.contactType,
      contactDate: contactForm.contactDate,
      contactPerson: contactForm.contactPerson,
      contactOrg: contactForm.contactOrg || undefined,
      ourPerson: contactForm.ourPerson,
      content: contactForm.content,
      result: contactForm.result || undefined,
      followUp: contactForm.followUp || undefined,
      nextContactDate: contactForm.nextContactDate || undefined,
    };

    try {
      const method = editingContact ? 'PUT' : 'POST';
      const body = editingContact ? { id: editingContact.id, ...payload } : payload;

      const res = await fetch('/api/process/contacts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowContactDialog(false);
        setEditingContact(null);
        setContactForm({
          contactType: 'phone',
          contactDate: '',
          contactPerson: '',
          contactOrg: '',
          ourPerson: '',
          content: '',
          result: '',
          followUp: '',
          nextContactDate: '',
        });
        loadData();
      }
    } catch (error) {
      console.error('Save contact error:', error);
    }
  };

  const handleDeleteContact = async (id: number) => {
    if (!confirm('确定要删除这条对接记录吗？')) return;

    try {
      const res = await fetch(`/api/process/contacts?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Delete contact error:', error);
    }
  };

  // 项目任务操作
  const handleSaveTask = async () => {
    const payload = {
      projectId,
      title: taskForm.title,
      description: taskForm.description || undefined,
      assigneeId: taskForm.assigneeId ? parseInt(taskForm.assigneeId) : undefined,
      priority: taskForm.priority,
      dueDate: taskForm.dueDate || undefined,
    };

    try {
      const method = editingTask ? 'PUT' : 'POST';
      const body = editingTask ? { id: editingTask.id, ...payload } : payload;

      const res = await fetch('/api/process/tasks', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowTaskDialog(false);
        setEditingTask(null);
        setTaskForm({
          title: '',
          description: '',
          assigneeId: '',
          priority: 'medium',
          dueDate: '',
        });
        loadData();
      }
    } catch (error) {
      console.error('Save task error:', error);
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (!confirm('确定要删除这个任务吗？')) return;

    try {
      const res = await fetch(`/api/process/tasks?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Delete task error:', error);
    }
  };

  const handleTaskStatusChange = async (id: number, status: string) => {
    try {
      const res = await fetch('/api/process/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Update task status error:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          过程记录管理
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="meetings" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              会议纪要
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              对接记录
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              任务跟踪
            </TabsTrigger>
          </TabsList>

          {/* 会议纪要 */}
          <TabsContent value="meetings" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingMeeting(null);
                  setMeetingForm({
                    title: '',
                    content: '',
                    meetingDate: '',
                    participants: '',
                    location: '',
                    meetingType: 'other',
                  });
                  setShowMeetingDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                新建会议纪要
              </Button>
            </div>

            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : meetings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暂无会议纪要</div>
              ) : (
                <div className="space-y-4">
                  {meetings.map((meeting) => (
                    <Card key={meeting.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{meeting.title}</h3>
                              {meeting.meetingType && (
                                <Badge variant="secondary">
                                  {meetingTypeLabels[meeting.meetingType] || meeting.meetingType}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(meeting.meetingDate), 'yyyy-MM-dd', { locale: zhCN })}
                              </span>
                              {meeting.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {meeting.location}
                                </span>
                              )}
                              {meeting.participants && meeting.participants.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  {meeting.participants.length} 人参会
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {meeting.content}
                            </p>
                            {meeting.creator && (
                              <p className="text-xs text-muted-foreground">
                                记录人: {meeting.creator.username}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingMeeting(meeting);
                                setMeetingForm({
                                  title: meeting.title,
                                  content: meeting.content,
                                  meetingDate: format(new Date(meeting.meetingDate), 'yyyy-MM-dd'),
                                  participants: meeting.participants?.join(', ') || '',
                                  location: meeting.location || '',
                                  meetingType: meeting.meetingType || 'other',
                                });
                                setShowMeetingDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* 客户对接记录 */}
          <TabsContent value="contacts" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingContact(null);
                  setContactForm({
                    contactType: 'phone',
                    contactDate: '',
                    contactPerson: '',
                    contactOrg: '',
                    ourPerson: '',
                    content: '',
                    result: '',
                    followUp: '',
                    nextContactDate: '',
                  });
                  setShowContactDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                新建对接记录
              </Button>
            </div>

            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暂无对接记录</div>
              ) : (
                <div className="space-y-4">
                  {contacts.map((contact) => (
                    <Card key={contact.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {contactTypeLabels[contact.contactType] || contact.contactType}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(contact.contactDate), 'yyyy-MM-dd', { locale: zhCN })}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">客户方:</span>{' '}
                                {contact.contactPerson}
                                {contact.contactOrg && ` (${contact.contactOrg})`}
                              </div>
                              <div>
                                <span className="text-muted-foreground">我方:</span>{' '}
                                {contact.ourPerson}
                              </div>
                            </div>
                            <p className="text-sm">{contact.content}</p>
                            {contact.result && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">结果:</span> {contact.result}
                              </p>
                            )}
                            {contact.followUp && (
                              <p className="text-sm text-blue-600">
                                <span className="font-medium">后续跟进:</span> {contact.followUp}
                              </p>
                            )}
                            {contact.nextContactDate && (
                              <p className="text-xs text-muted-foreground">
                                下次对接: {format(new Date(contact.nextContactDate), 'yyyy-MM-dd', { locale: zhCN })}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingContact(contact);
                                setContactForm({
                                  contactType: contact.contactType,
                                  contactDate: format(new Date(contact.contactDate), 'yyyy-MM-dd'),
                                  contactPerson: contact.contactPerson,
                                  contactOrg: contact.contactOrg || '',
                                  ourPerson: contact.ourPerson,
                                  content: contact.content,
                                  result: contact.result || '',
                                  followUp: contact.followUp || '',
                                  nextContactDate: contact.nextContactDate
                                    ? format(new Date(contact.nextContactDate), 'yyyy-MM-dd')
                                    : '',
                                });
                                setShowContactDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteContact(contact.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* 任务跟踪 */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingTask(null);
                  setTaskForm({
                    title: '',
                    description: '',
                    assigneeId: '',
                    priority: 'medium',
                    dueDate: '',
                  });
                  setShowTaskDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                新建任务
              </Button>
            </div>

            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暂无任务</div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={task.status === 'completed'}
                              onChange={() =>
                                handleTaskStatusChange(
                                  task.id,
                                  task.status === 'completed' ? 'pending' : 'completed'
                                )
                              }
                              className="h-5 w-5 rounded border-gray-300"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-medium ${
                                    task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                                  }`}
                                >
                                  {task.title}
                                </span>
                                <Badge className={priorityColors[task.priority]}>
                                  {priorityLabels[task.priority]}
                                </Badge>
                                <Badge className={statusColors[task.status]}>
                                  {statusLabels[task.status]}
                                </Badge>
                              </div>
                              {task.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                {task.assignee && (
                                  <span>负责人: {task.assignee.username}</span>
                                )}
                                {task.dueDate && (
                                  <span>
                                    截止: {format(new Date(task.dueDate), 'yyyy-MM-dd', { locale: zhCN })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingTask(task);
                                setTaskForm({
                                  title: task.title,
                                  description: task.description || '',
                                  assigneeId: task.assigneeId?.toString() || '',
                                  priority: task.priority,
                                  dueDate: task.dueDate
                                    ? format(new Date(task.dueDate), 'yyyy-MM-dd')
                                    : '',
                                });
                                setShowTaskDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTask(task.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* 会议纪要对话框 */}
        <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingMeeting ? '编辑会议纪要' : '新建会议纪要'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>会议标题</Label>
                  <Input
                    value={meetingForm.title}
                    onChange={(e) =>
                      setMeetingForm({ ...meetingForm, title: e.target.value })
                    }
                    placeholder="输入会议标题"
                  />
                </div>
                <div className="space-y-2">
                  <Label>会议日期</Label>
                  <Input
                    type="date"
                    value={meetingForm.meetingDate}
                    onChange={(e) =>
                      setMeetingForm({ ...meetingForm, meetingDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>会议类型</Label>
                  <Select
                    value={meetingForm.meetingType}
                    onValueChange={(value) =>
                      setMeetingForm({ ...meetingForm, meetingType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kickoff">启动会</SelectItem>
                      <SelectItem value="review">评审会</SelectItem>
                      <SelectItem value="coordination">协调会</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>会议地点</Label>
                  <Input
                    value={meetingForm.location}
                    onChange={(e) =>
                      setMeetingForm({ ...meetingForm, location: e.target.value })
                    }
                    placeholder="输入会议地点"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>参会人员</Label>
                <Input
                  value={meetingForm.participants}
                  onChange={(e) =>
                    setMeetingForm({ ...meetingForm, participants: e.target.value })
                  }
                  placeholder="多人用逗号分隔"
                />
              </div>
              <div className="space-y-2">
                <Label>会议内容</Label>
                <Textarea
                  value={meetingForm.content}
                  onChange={(e) =>
                    setMeetingForm({ ...meetingForm, content: e.target.value })
                  }
                  rows={6}
                  placeholder="输入会议纪要内容"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowMeetingDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveMeeting}>保存</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 客户对接记录对话框 */}
        <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingContact ? '编辑对接记录' : '新建对接记录'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>对接方式</Label>
                  <Select
                    value={contactForm.contactType}
                    onValueChange={(value) =>
                      setContactForm({ ...contactForm, contactType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">电话</SelectItem>
                      <SelectItem value="email">邮件</SelectItem>
                      <SelectItem value="meeting">会议</SelectItem>
                      <SelectItem value="site_visit">现场考察</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>对接日期</Label>
                  <Input
                    type="date"
                    value={contactForm.contactDate}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, contactDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>客户方联系人</Label>
                  <Input
                    value={contactForm.contactPerson}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, contactPerson: e.target.value })
                    }
                    placeholder="输入客户方联系人"
                  />
                </div>
                <div className="space-y-2">
                  <Label>客户方单位</Label>
                  <Input
                    value={contactForm.contactOrg}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, contactOrg: e.target.value })
                    }
                    placeholder="输入客户方单位"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>我方联系人</Label>
                <Input
                  value={contactForm.ourPerson}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, ourPerson: e.target.value })
                  }
                  placeholder="输入我方联系人"
                />
              </div>
              <div className="space-y-2">
                <Label>对接内容</Label>
                <Textarea
                  value={contactForm.content}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, content: e.target.value })
                  }
                  rows={3}
                  placeholder="输入对接内容"
                />
              </div>
              <div className="space-y-2">
                <Label>对接结果</Label>
                <Textarea
                  value={contactForm.result}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, result: e.target.value })
                  }
                  rows={2}
                  placeholder="输入对接结果"
                />
              </div>
              <div className="space-y-2">
                <Label>后续跟进</Label>
                <Textarea
                  value={contactForm.followUp}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, followUp: e.target.value })
                  }
                  rows={2}
                  placeholder="输入后续跟进事项"
                />
              </div>
              <div className="space-y-2">
                <Label>下次对接日期</Label>
                <Input
                  type="date"
                  value={contactForm.nextContactDate}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, nextContactDate: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowContactDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveContact}>保存</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 任务对话框 */}
        <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTask ? '编辑任务' : '新建任务'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>任务标题</Label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="输入任务标题"
                />
              </div>
              <div className="space-y-2">
                <Label>任务描述</Label>
                <Textarea
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                  rows={3}
                  placeholder="输入任务描述"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Select
                    value={taskForm.priority}
                    onValueChange={(value) =>
                      setTaskForm({ ...taskForm, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>截止日期</Label>
                  <Input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, dueDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveTask}>保存</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

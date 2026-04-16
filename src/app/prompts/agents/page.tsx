'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription as _CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label as _Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter as _DialogFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Search as _Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  MessageSquare,
  Send,
  RefreshCw,
  Sparkles as _Sparkles,
  User,
  Briefcase,
  DollarSign,
  UserCheck as _UserCheck,
  FileCheck,
  Cog,
  Scale,
  FolderKanban,
  FileText,
  Bot,
} from 'lucide-react';

// AI角色类型映射
const AGENT_ROLE_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    description: string;
  }
> = {
  sales_director: {
    label: '销售总监',
    icon: DollarSign,
    color: 'bg-blue-500',
    description: '负责销售策略制定、客户关系维护、商务谈判支持',
  },
  presales_director: {
    label: '售前总监',
    icon: Briefcase,
    color: 'bg-green-500',
    description: '负责售前方案设计、技术交流、需求分析',
  },
  finance_director: {
    label: '财务总监',
    icon: DollarSign,
    color: 'bg-yellow-500',
    description: '负责财务分析、成本估算、报价策略',
  },
  customer: {
    label: '客户',
    icon: User,
    color: 'bg-purple-500',
    description: '模拟客户视角，提供需求反馈和评审意见',
  },
  auditor: {
    label: '审核员',
    icon: FileCheck,
    color: 'bg-red-500',
    description: '负责文档审核、合规检查、质量把控',
  },
  technical_expert: {
    label: '技术专家',
    icon: Cog,
    color: 'bg-cyan-500',
    description: '负责技术方案设计、技术难点攻关',
  },
  legal_advisor: {
    label: '法务顾问',
    icon: Scale,
    color: 'bg-indigo-500',
    description: '负责合同审核、法律风险评估',
  },
  project_manager: {
    label: '项目经理',
    icon: FolderKanban,
    color: 'bg-orange-500',
    description: '负责项目规划、进度管理、资源协调',
  },
  bid_specialist: {
    label: '投标专员',
    icon: FileText,
    color: 'bg-teal-500',
    description: '负责标书编制、投标流程、资质管理',
  },
  custom: {
    label: '自定义',
    icon: Bot,
    color: 'bg-gray-500',
    description: '自定义AI助手',
  },
};

interface Agent {
  id: number;
  name: string;
  code: string;
  description?: string;
  isAgent: boolean;
  agentRole?: string;
  agentAvatar?: string;
  agentGreeting?: string;
  agentDescription?: string;
  agentSkills?: string;
  systemPrompt?: string;
  content: string;
  modelProvider?: string;
  modelName?: string;
  status: string;
  useCount: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // 对话相关
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [keyword, roleFilter]);

  useEffect(() => {
    // 滚动到底部
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const fetchAgents = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('isAgent', 'true');
      if (keyword) params.set('keyword', keyword);
      if (roleFilter && roleFilter !== 'all') params.set('agentRole', roleFilter);
      params.set('status', 'active');

      const res = await fetch(`/api/prompts/templates?${params.toString()}`);
      const data = await res.json();

      if (data.items) {
        setAgents(data.items.filter((t: Agent) => t.isAgent));
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChat = (agent: Agent) => {
    setSelectedAgent(agent);
    setMessages([]);
    setInputMessage('');

    // 添加欢迎语
    if (agent.agentGreeting) {
      setMessages([
        {
          role: 'assistant',
          content: agent.agentGreeting,
          timestamp: new Date(),
        },
      ]);
    }

    setChatDialogOpen(true);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedAgent || generating) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setGenerating(true);
    setStreamingContent('');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedAgent.id,
          parameters: {
            user_message: userMessage.content,
            conversation_history: messages
              .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
              .join('\n'),
          },
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let fullContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content') {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                } else if (data.type === 'done') {
                  // 添加AI回复到消息列表
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: 'assistant',
                      content: fullContent,
                      timestamp: new Date(),
                    },
                  ]);
                  setStreamingContent('');
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to send message:', error);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setGenerating(false);
      setStreamingContent('');
    }
  };

  const handleCreateAgent = () => {
    router.push('/prompts/templates?createAgent=true');
  };

  const handleEditAgent = (agent: Agent) => {
    router.push(`/prompts/templates?edit=${agent.id}`);
  };

  const handleDeleteAgent = async (agent: Agent) => {
    if (!confirm(`确定要删除AI员工"${agent.name}"吗？`)) return;

    try {
      const res = await fetch(`/api/prompts/templates/${agent.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchAgents();
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const getRoleConfig = (role?: string) => {
    return AGENT_ROLE_CONFIG[role || 'custom'] || AGENT_ROLE_CONFIG.custom;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            AI员工
          </h1>
          <p className="text-muted-foreground">管理AI虚拟员工，根据角色调用不同的提示词模板</p>
        </div>
        <Button onClick={handleCreateAgent}>
          <Plus className="mr-2 h-4 w-4" />
          新建AI员工
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="搜索AI员工名称..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="角色类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                {Object.entries(AGENT_ROLE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <config.icon className="h-4 w-4" />
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Agents Grid */}
      {error ? (
        <ListStateBlock state="error" error={error} onRetry={fetchAgents} />
      ) : loading ? (
        <ListStateBlock state="loading" />
      ) : agents.length === 0 ? (
        <ListStateBlock state="empty" emptyText="暂无AI员工" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {agents.map((agent) => {
            const roleConfig = getRoleConfig(agent.agentRole);
            const RoleIcon = roleConfig.icon;

            return (
              <Card key={agent.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={agent.agentAvatar} />
                        <AvatarFallback className={`${roleConfig.color} text-white`}>
                          <RoleIcon className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {roleConfig.label}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleChat(agent)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          开始对话
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEditAgent(agent)}>
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteAgent(agent)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.agentDescription || agent.description || roleConfig.description}
                  </p>
                  {agent.agentSkills && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {JSON.parse(agent.agentSkills)
                        .slice(0, 3)
                        .map((skill: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-0">
                  <Button className="w-full" onClick={() => handleChat(agent)}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    开始对话
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Chat Dialog */}
      <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {selectedAgent &&
                (() => {
                  const roleConfig = getRoleConfig(selectedAgent.agentRole);
                  const RoleIcon = roleConfig.icon;
                  return (
                    <>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={selectedAgent.agentAvatar} />
                        <AvatarFallback className={`${roleConfig.color} text-white`}>
                          <RoleIcon className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <DialogTitle>{selectedAgent.name}</DialogTitle>
                        <DialogDescription>
                          {roleConfig.label} · {selectedAgent.agentDescription || 'AI助手'}
                        </DialogDescription>
                      </div>
                    </>
                  );
                })()}
            </div>
          </DialogHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    <span className="text-xs opacity-70 mt-1 block">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}

              {/* Streaming content */}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                    <p className="whitespace-pre-wrap text-sm">
                      {streamingContent}
                      <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-0.5" />
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t pt-4">
            <div className="flex gap-2">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="输入消息..."
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              {generating ? (
                <Button variant="destructive" onClick={handleAbort}>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  停止
                </Button>
              ) : (
                <Button onClick={handleSendMessage} disabled={!inputMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

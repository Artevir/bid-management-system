'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input as _Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as _CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent as _TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Bot,
  Send,
  RefreshCw,
  User,
  Sparkles,
  Settings,
  MessageSquare,
  Plus as _Plus,
  X as _X,
  Zap,
  Users,
  ChevronDown as _ChevronDown,
  Loader2,
} from 'lucide-react';

// AI角色接口
interface Agent {
  id: number;
  name: string;
  code: string;
  description?: string;
  agentRole?: string;
  agentAvatar?: string;
  agentGreeting?: string;
  agentDescription?: string;
  agentSkills?: string;
  modelProvider?: string;
  modelName?: string;
  useCount: number;
}

// LLM配置接口
interface LLMConfig {
  id: number;
  name: string;
  provider: string;
  modelId: string;
  isDefault?: boolean;
}

// 消息接口
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentId?: number;
  agentName?: string;
}

// AI角色类型配置
const AGENT_ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  sales_director: { label: '销售总监', icon: Zap, color: 'bg-blue-500' },
  presales_director: { label: '售前总监', icon: Sparkles, color: 'bg-green-500' },
  finance_director: { label: '财务总监', icon: Zap, color: 'bg-yellow-500' },
  customer: { label: '客户', icon: User, color: 'bg-purple-500' },
  auditor: { label: '审核员', icon: Bot, color: 'bg-red-500' },
  technical_expert: { label: '技术专家', icon: Settings, color: 'bg-cyan-500' },
  legal_advisor: { label: '法务顾问', icon: Bot, color: 'bg-indigo-500' },
  project_manager: { label: '项目经理', icon: Users, color: 'bg-orange-500' },
  bid_specialist: { label: '投标专员', icon: MessageSquare, color: 'bg-teal-500' },
  custom: { label: '自定义', icon: Bot, color: 'bg-gray-500' },
};

export default function AIAssistantPage() {
  // 模式切换
  const [mode, setMode] = useState<'agent' | 'direct'>('agent');

  // AI角色相关
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // LLM配置相关
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');

  // 对话相关
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // 直接模式
  const [directPrompt, setDirectPrompt] = useState('');
  const [directSystemPrompt, setDirectSystemPrompt] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadAgents();
    loadConfigs();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const loadAgents = async () => {
    try {
      const res = await fetch('/api/ai/call?type=agents');
      const data = await res.json();
      if (data.agents) {
        setAgents(data.agents);
        // 默认选择第一个
        if (data.agents.length > 0 && !selectedAgent) {
          setSelectedAgent(data.agents[0]);
        }
      }
    } catch (error) {
      console.error('加载AI角色失败:', error);
    }
  };

  const loadConfigs = async () => {
    try {
      const res = await fetch('/api/ai/call?type=configs');
      const data = await res.json();
      if (data.configs) {
        setConfigs(data.configs);
        // 选择默认配置
        const defaultConfig = data.configs.find((c: LLMConfig) => c.isDefault);
        if (defaultConfig) {
          setSelectedConfigId(defaultConfig.id.toString());
        } else if (data.configs.length > 0) {
          setSelectedConfigId(data.configs[0].id.toString());
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const handleSelectAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id.toString() === agentId);
    if (agent) {
      setSelectedAgent(agent);
      // 清空历史消息，添加欢迎语
      setMessages([]);
      if (agent.agentGreeting) {
        setMessages([
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: agent.agentGreeting,
            timestamp: new Date(),
            agentId: agent.id,
            agentName: agent.name,
          },
        ]);
      }
    }
  };

  const handleSendMessage = async () => {
    const userContent = mode === 'agent' ? inputMessage : directPrompt;
    if (!userContent.trim() || generating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setDirectPrompt('');
    setGenerating(true);
    setStreamingContent('');

    abortControllerRef.current = new AbortController();

    try {
      const requestBody: any = {
        mode,
        stream: true,
        configId: selectedConfigId ? parseInt(selectedConfigId) : undefined,
        conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
      };

      if (mode === 'agent') {
        requestBody.agentId = selectedAgent?.id;
        requestBody.parameters = {
          user_message: userContent,
          conversation_history: messages
            .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
            .join('\n'),
        };
      } else {
        requestBody.prompt = userContent;
        requestBody.systemPrompt = directSystemPrompt || undefined;
      }

      const response = await fetch('/api/ai/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: (Date.now() + 1).toString(),
                      role: 'assistant',
                      content: fullContent,
                      timestamp: new Date(),
                      agentId: selectedAgent?.id,
                      agentName: selectedAgent?.name,
                    },
                  ]);
                  setStreamingContent('');
                } else if (data.type === 'error') {
                  console.error('AI错误:', data.error);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: (Date.now() + 1).toString(),
                      role: 'assistant',
                      content: `错误: ${data.error}`,
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
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('发送消息失败:', error);
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

  const handleClearMessages = () => {
    setMessages([]);
    if (selectedAgent?.agentGreeting) {
      setMessages([
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: selectedAgent.agentGreeting,
          timestamp: new Date(),
          agentId: selectedAgent.id,
          agentName: selectedAgent.name,
        },
      ]);
    }
  };

  const getRoleConfig = (role?: string) => {
    return AGENT_ROLE_CONFIG[role || 'custom'] || AGENT_ROLE_CONFIG.custom;
  };

  return (
    <div className="h-[calc(100vh-180px)] flex gap-4">
      {/* 左侧配置面板 */}
      <div className="w-72 flex flex-col gap-4">
        {/* 模式切换 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">对话模式</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'agent' | 'direct')}>
              <TabsList className="w-full">
                <TabsTrigger value="agent" className="flex-1">
                  <Users className="h-4 w-4 mr-1" />
                  AI角色
                </TabsTrigger>
                <TabsTrigger value="direct" className="flex-1">
                  <Zap className="h-4 w-4 mr-1" />
                  直接对话
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* AI角色选择 */}
        {mode === 'agent' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">选择AI角色</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={selectedAgent?.id.toString()}
                onValueChange={handleSelectAgent}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择AI角色" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => {
                    const roleConfig = getRoleConfig(agent.agentRole);
                    return (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        <div className="flex items-center gap-2">
                          <roleConfig.icon className="h-4 w-4" />
                          {agent.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {selectedAgent && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedAgent.agentAvatar} />
                      <AvatarFallback
                        className={`${getRoleConfig(selectedAgent.agentRole).color} text-white`}
                      >
                        {React.createElement(getRoleConfig(selectedAgent.agentRole).icon, {
                          className: 'h-4 w-4',
                        })}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">{selectedAgent.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {getRoleConfig(selectedAgent.agentRole).label}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedAgent.agentDescription || selectedAgent.description}
                  </p>
                  {selectedAgent.agentSkills && (
                    <div className="flex flex-wrap gap-1">
                      {JSON.parse(selectedAgent.agentSkills)
                        .slice(0, 3)
                        .map((skill: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 直接对话配置 */}
        {mode === 'direct' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">提示词配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">系统提示词（可选）</Label>
                <Textarea
                  value={directSystemPrompt}
                  onChange={(e) => setDirectSystemPrompt(e.target.value)}
                  placeholder="定义AI的角色和行为..."
                  className="mt-1 min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 模型配置 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">模型配置</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
              <SelectTrigger>
                <SelectValue placeholder="选择模型配置" />
              </SelectTrigger>
              <SelectContent>
                {configs.map((config) => (
                  <SelectItem key={config.id} value={config.id.toString()}>
                    {config.name} ({config.modelId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleClearMessages}>
            <RefreshCw className="h-4 w-4 mr-2" />
            清空对话
          </Button>
          <Link href="/llm/usage" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              用量统计
            </Button>
          </Link>
        </div>

        <Link href="/prompts/agents">
          <Button variant="outline" size="sm" className="w-full">
            <Users className="h-4 w-4 mr-2" />
            管理AI角色
          </Button>
        </Link>
      </div>

      {/* 右侧对话区 */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {mode === 'agent' ? selectedAgent?.name || 'AI助手' : '直接对话'}
            </CardTitle>
            {mode === 'agent' && selectedAgent && (
              <Badge variant="outline">
                {getRoleConfig(selectedAgent.agentRole).label}
              </Badge>
            )}
          </div>
        </CardHeader>

        {/* 消息列表 */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && !streamingContent ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bot className="h-12 w-12 mb-4" />
              <p>开始对话</p>
              <p className="text-sm mt-2">
                {mode === 'agent' ? '选择AI角色后开始对话' : '输入提示词开始对话'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    <span
                      className={`text-xs mt-1 block ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}

              {/* 流式内容 */}
              {streamingContent && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100">
                    <p className="whitespace-pre-wrap text-sm">
                      {streamingContent}
                      <span className="inline-block w-1 h-4 bg-blue-500 animate-pulse ml-0.5" />
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* 输入区 */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={mode === 'agent' ? inputMessage : directPrompt}
              onChange={(e) =>
                mode === 'agent'
                  ? setInputMessage(e.target.value)
                  : setDirectPrompt(e.target.value)
              }
              placeholder={mode === 'agent' ? '输入消息...' : '输入提示词...'}
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
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                停止
              </Button>
            ) : (
              <Button
                onClick={handleSendMessage}
                disabled={
                  mode === 'agent' ? !inputMessage.trim() : !directPrompt.trim()
                }
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Send,
  Plus as _Plus,
  Trash2 as _Trash2,
  Settings,
  Loader2,
  Copy,
  RotateCcw,
  MessageSquare,
  BookOpen,
  Cpu,
  User,
  Bot,
  BarChart3,
} from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';

// 消息接口
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  latency?: number;
}

// 配置接口
interface LLMConfig {
  id: number;
  name: string;
  provider: string;
  modelId: string;
  defaultTemperature: string;
  defaultThinking: boolean;
  defaultCaching: boolean;
  isDefault?: boolean;
}

// 对话接口
interface _Conversation {
  id: number;
  title: string;
  messages: Message[];
}

export default function LLMChatPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 高级设置
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState('0.7');
  const [thinking, setThinking] = useState(false);
  const [caching, setCaching] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConfigs = async () => {
    try {
      setError('');
      const res = await fetch('/api/llm/configs');
      const data = await res.json();
      if (data.configs && data.configs.length > 0) {
        setConfigs(data.configs);
        // 选择默认配置
        const defaultConfig = data.configs.find((c: LLMConfig) => c.isDefault);
        if (defaultConfig) {
          setSelectedConfigId(defaultConfig.id.toString());
          setTemperature(defaultConfig.defaultTemperature);
          setThinking(defaultConfig.defaultThinking);
          setCaching(defaultConfig.defaultCaching);
        } else {
          setSelectedConfigId(data.configs[0].id.toString());
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStreamingContent('');

    const startTime = Date.now();

    try {
      // 构建消息数组
      const chatMessages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }> = [];

      // 添加系统提示
      if (systemPrompt) {
        chatMessages.push({ role: 'system', content: systemPrompt });
      }

      // 添加历史消息
      messages.forEach((m) => {
        chatMessages.push({ role: m.role, content: m.content });
      });

      // 添加当前消息
      chatMessages.push({ role: 'user', content: userMessage.content });

      // 流式请求
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: selectedConfigId ? parseInt(selectedConfigId) : undefined,
          messages: chatMessages,
          temperature: parseFloat(temperature),
          thinking: thinking ? 'enabled' : 'disabled',
          caching: caching ? 'enabled' : 'disabled',
          stream: true,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      let fullContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const latency = Date.now() - startTime;

      // 添加助手消息
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
        latency,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
    } catch (error: any) {
      console.error('发送消息失败:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `错误: ${error.message || '请求失败'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent('');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (confirm('确定要清空对话吗？')) {
      setMessages([]);
    }
  };

  const handleCopy = async (content: string) => {
    await copyTextToClipboard(content);
  };

  const handleConfigChange = (configId: string) => {
    setSelectedConfigId(configId);
    const config = configs.find((c) => c.id.toString() === configId);
    if (config) {
      setTemperature(config.defaultTemperature);
      setThinking(config.defaultThinking);
      setCaching(config.defaultCaching);
    }
  };

  const selectedConfig = configs.find((c) => c.id.toString() === selectedConfigId);

  return (
    <div className="h-[calc(100vh-180px)] flex gap-4">
      {/* 左侧配置面板 */}
      <div className="w-64 flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">模型配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">选择配置</label>
              <Select value={selectedConfigId} onValueChange={handleConfigChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择模型配置" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((config) => (
                    <SelectItem key={config.id} value={config.id.toString()}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error && (
                <p className="text-xs text-red-600 mt-2">
                  配置加载失败: {error}
                  <button className="ml-2 underline" onClick={loadConfigs}>
                    重试
                  </button>
                </p>
              )}
            </div>

            {selectedConfig && (
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>模型</span>
                  <span className="font-mono text-xs">{selectedConfig.modelId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>提供商</span>
                  <Badge variant="outline">{selectedConfig.provider}</Badge>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {showAdvanced ? '隐藏' : '显示'}高级设置
            </Button>
          </CardContent>
        </Card>

        {showAdvanced && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">高级设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Temperature</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">思考模式</span>
                <input
                  type="checkbox"
                  checked={thinking}
                  onChange={(e) => setThinking(e.target.checked)}
                  className="rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">启用缓存</span>
                <input
                  type="checkbox"
                  checked={caching}
                  onChange={(e) => setCaching(e.target.checked)}
                  className="rounded"
                />
              </div>

              <div>
                <label className="text-sm text-gray-500">系统提示</label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="定义AI的角色和行为..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Link href="/llm" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Cpu className="h-4 w-4 mr-2" />
              配置管理
            </Button>
          </Link>
          <Link href="/llm/usage" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <BarChart3 className="h-4 w-4 mr-2" />
              用量统计
            </Button>
          </Link>
        </div>
        <Link href="/prompts/templates">
          <Button variant="outline" size="sm" className="w-full">
            <BookOpen className="h-4 w-4 mr-2" />
            提示词模板
          </Button>
        </Link>
      </div>

      {/* 右侧对话区 */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              对话测试
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <RotateCcw className="h-4 w-4 mr-2" />
              清空对话
            </Button>
          </div>
        </CardHeader>

        {/* 消息列表 */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && !streamingContent ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bot className="h-12 w-12 mb-4" />
              <p>开始对话测试</p>
              <p className="text-sm mt-2">输入消息，测试大模型响应</p>
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
                    className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg text-left ${
                        message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{message.timestamp.toLocaleTimeString()}</span>
                      {message.latency && <span>· {message.latency}ms</span>}
                      {message.role === 'assistant' && (
                        <button
                          onClick={() => handleCopy(message.content)}
                          className="hover:text-gray-600"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* 流式输出 */}
              {streamingContent && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1 p-3 rounded-lg bg-gray-100">
                    <p className="whitespace-pre-wrap">{streamingContent}</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* 输入区 */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入消息..."
              className="flex-1 resize-none"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend} disabled={!input.trim() || loading} className="self-end">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

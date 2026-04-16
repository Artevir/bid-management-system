'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import _Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare,
  Send,
  Paperclip,
  MoreVertical,
  Pin,
  Trash2,
  Edit,
  Search,
  Download,
  Settings,
  RefreshCw,
  Users as _Users,
  FileText as _FileText,
  Image as _Image,
  File,
  ChevronDown as _ChevronDown,
  AtSign,
  Smile as _Smile,
  Clock as _Clock,
  Check as _Check,
  X as _X,
  Loader2,
} from 'lucide-react';

interface Message {
  id: number;
  content: string;
  type: string;
  authorId: number;
  authorName: string;
  isPinned: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  mentions?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

interface Discussion {
  id: number;
  projectId: number;
  name: string;
  project?: { id: number; name: string; code: string };
}

interface UserDiscussion {
  id: number;
  projectId: number;
  name: string;
  project?: { id: number; name: string; code: string };
}

function ProjectDiscussionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [discussions, setDiscussions] = useState<UserDiscussion[]>([]);
  const [currentDiscussion, setCurrentDiscussion] = useState<Discussion | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDiscussions();
  }, []);

  useEffect(() => {
    if (projectId) {
      fetchDiscussion(parseInt(projectId));
    }
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function fetchDiscussions() {
    try {
      const res = await fetch('/api/project-discussions?action=list');
      const data = await res.json();
      setDiscussions(data.data || []);
    } catch (error) {
      console.error('Failed to fetch discussions:', error);
    }
  }

  async function fetchDiscussion(pid: number) {
    setLoading(true);
    try {
      // 创建或获取讨论区
      const createRes = await fetch('/api/project-discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getOrCreate',
          data: { projectId: pid },
        }),
      });
      const createData = await createRes.json();

      if (createData.data) {
        setCurrentDiscussion(createData.data);

        // 获取消息
        const messagesRes = await fetch(`/api/project-discussions?projectId=${pid}`);
        const messagesData = await messagesRes.json();
        setMessages(messagesData.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch discussion:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!messageInput.trim() || !currentDiscussion || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/project-discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendMessage',
          data: {
            discussionId: currentDiscussion.id,
            content: messageInput,
          },
        }),
      });
      const data = await res.json();
      if (data.data) {
        setMessages((prev) => [data.data, ...prev]);
        setMessageInput('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  }

  async function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  }

  async function deleteMessage(messageId: number) {
    try {
      await fetch(`/api/project-discussions/messages/${messageId}`, {
        method: 'DELETE',
      });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }

  async function togglePin(messageId: number, isPinned: boolean) {
    try {
      await fetch(`/api/project-discussions/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isPinned ? 'unpin' : 'pin',
        }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned: !isPinned } : m))
      );
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  }

  async function searchMessages() {
    if (!searchKeyword.trim() || !projectId) return;

    try {
      const res = await fetch(
        `/api/project-discussions?action=search&projectId=${projectId}&keyword=${encodeURIComponent(searchKeyword)}`
      );
      const data = await res.json();
      setMessages(data.data || []);
      setShowSearch(false);
    } catch (error) {
      console.error('Failed to search messages:', error);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  const pinnedMessages = messages.filter((m) => m.isPinned && !m.isDeleted);
  const regularMessages = messages.filter((m) => !m.isPinned && !m.isDeleted);

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4">
      {/* 左侧：讨论区列表 */}
      <Card className="w-72 flex-shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>我的讨论区</span>
            <Badge variant="secondary">{discussions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="space-y-1 p-3 pt-0">
              {discussions.length === 0 ? (
                <ListStateBlock state="empty" emptyText="暂无讨论区" />
              ) : (
                discussions.map((disc) => (
                  <button
                    key={disc.id}
                    onClick={() => router.push(`/project-discussions?projectId=${disc.projectId}`)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      currentDiscussion?.id === disc.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {disc.project?.name || disc.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {disc.project?.code || ''}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 右侧：聊天区域 */}
      <Card className="flex-1 flex flex-col">
        {/* 头部 */}
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentDiscussion ? (
                <>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {currentDiscussion.project?.name || currentDiscussion.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {currentDiscussion.project?.code || ''}
                    </p>
                  </div>
                </>
              ) : (
                <CardTitle className="text-base text-muted-foreground">
                  选择一个讨论区开始聊天
                </CardTitle>
              )}
            </div>
            {currentDiscussion && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fetchDiscussion(parseInt(projectId || '0'))}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        {/* 消息区域 */}
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="space-y-3 w-full max-w-md px-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-16 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ) : !currentDiscussion ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>选择左侧讨论区开始沟通</p>
                <p className="text-sm mt-2">或从项目管理进入项目组织</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {/* 置顶消息 */}
                {pinnedMessages.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {pinnedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="bg-yellow-50 dark:bg-yellow-900/20 border rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 mb-1">
                          <Pin className="h-3 w-3" />
                          <span>置顶消息</span>
                        </div>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 普通消息 */}
                {[...regularMessages].reverse().map((msg) => (
                  <div key={msg.id} className="flex gap-3 group">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{msg.authorName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{msg.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(msg.createdAt)}
                        </span>
                        {msg.isEdited && (
                          <span className="text-xs text-muted-foreground">(已编辑)</span>
                        )}
                      </div>
                      {msg.type === 'file' ? (
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg max-w-xs">
                          <File className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium truncate">{msg.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {msg.fileSize && formatFileSize(msg.fileSize)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => togglePin(msg.id, msg.isPinned)}>
                          <Pin className="mr-2 h-4 w-4" />
                          {msg.isPinned ? '取消置顶' : '置顶'}
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={() => deleteMessage(msg.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}

          {/* 输入区域 */}
          {currentDiscussion && (
            <div className="border-t p-4">
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="sm">
                  <AtSign className="h-4 w-4 mr-1" />
                  提及
                </Button>
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4 mr-1" />
                  文件
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入消息，按 Enter 发送..."
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={sending || !messageInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 搜索弹窗 */}
      <Dialog open={showSearch} onOpenChange={setShowSearch}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>搜索消息</DialogTitle>
            <DialogDescription>按关键词搜索历史消息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="输入搜索关键词..."
              onKeyPress={(e) => e.key === 'Enter' && searchMessages()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSearch(false)}>
                取消
              </Button>
              <Button onClick={searchMessages}>搜索</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 设置弹窗 */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>讨论区设置</DialogTitle>
            <DialogDescription>管理讨论区信息和权限</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">讨论区名称</label>
              <Input defaultValue={currentDiscussion?.name} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">消息提醒</label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">开启新消息提醒</span>
                <Button variant="outline" size="sm">
                  已开启
                </Button>
              </div>
            </div>
            <div className="pt-4 border-t">
              <Button variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                导出讨论记录
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                取消
              </Button>
              <Button onClick={() => setShowSettings(false)}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProjectDiscussionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProjectDiscussionsContent />
    </Suspense>
  );
}

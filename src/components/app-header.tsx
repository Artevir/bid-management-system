'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Bell,
  Menu,
  Search,
  Settings,
  User,
  FileText,
  FolderOpen,
  CheckCircle,
  BookOpen,
  BarChart3,
  Calendar as _Calendar,
  BrainCircuit,
  Calculator as _Calculator,
  LayoutDashboard as _LayoutDashboard,
  LogOut,
  Moon as _Moon,
  Sun as _Sun,
  Keyboard,
  HelpCircle as _HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  className?: string;
}

// 主导航项
const mainNavItems = [
  { href: '/projects', label: '项目', icon: FolderOpen, shortcut: 'g p' },
  { href: '/bid', label: '标书', icon: FileText, shortcut: 'g b' },
  { href: '/knowledge', label: '知识库', icon: BookOpen, shortcut: 'g k' },
  { href: '/approval', label: '审核', icon: CheckCircle, shortcut: 'g a' },
  { href: '/dashboard', label: '项目看板', icon: BarChart3, shortcut: 'g d' },
  { href: '/ai-governance', label: 'AI治理', icon: BrainCircuit, shortcut: 'g i' },
];

export function AppHeader({ className }: AppHeaderProps) {
  const pathname = usePathname();
  const _router = useRouter();
  const [_searchOpen, setSearchOpen] = React.useState(false);

  // 快捷键处理
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 全局搜索 Ctrl+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      
      // 快速导航 g + key
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        const _navItem = mainNavItems.find(item => 
          item.shortcut?.endsWith(key)
        );
        // 简单实现：按g后按对应字母跳转
        // 完整实现需要状态追踪
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className={cn(
      'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
      className
    )}>
      <div className="flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 mr-6">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg hidden sm:inline-block">
            标书管理平台
          </span>
        </Link>

        {/* 主导航 - 桌面端 */}
        <nav className="hidden lg:flex items-center space-x-1 flex-1">
          {mainNavItems.slice(0, 6).map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          
          {/* 更多导航 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                更多
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {mainNavItems.slice(6).map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="flex items-center gap-2 cursor-pointer">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                      )}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* 右侧工具栏 */}
        <div className="flex items-center space-x-2 ml-auto">
          {/* 搜索按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">搜索</span>
          </Button>

          {/* 快捷键提示 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
                <Keyboard className="h-4 w-4" />
                <span className="sr-only">快捷键</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>键盘快捷键</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-2 space-y-1 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">全局搜索</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs">Ctrl + K</kbd>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">新建项目</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs">Ctrl + N</kbd>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">项目管理</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs">G → P</kbd>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">标书文档</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs">G → B</kbd>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">项目看板</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs">G → D</kbd>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">切换主题</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs">Ctrl + T</kbd>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 通知 */}
          <Link href="/notifications">
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
              >
                3
              </Badge>
              <span className="sr-only">通知</span>
            </Button>
          </Link>

          {/* 主题切换 */}
          <ThemeToggle />

          {/* 用户菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <User className="h-4 w-4" />
                <span className="sr-only">用户菜单</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">管理员</p>
                  <p className="text-xs text-muted-foreground">admin@example.com</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>个人设置</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/sessions" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>会话管理</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>退出登录</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 移动端菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden">
                <Menu className="h-4 w-4" />
                <span className="sr-only">菜单</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 lg:hidden">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="flex items-center gap-2 cursor-pointer">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

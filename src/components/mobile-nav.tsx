'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FolderOpen,
  FileText,
  CheckCircle,
  BookOpen,
  User as _User,
  Menu,
  Plus,
  Search,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ThemeToggleSimple } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';

interface MobileNavProps {
  className?: string;
}

// 底部导航项
const bottomNavItems = [
  { href: '/projects', label: '项目', icon: FolderOpen },
  { href: '/bid', label: '标书', icon: FileText },
  { href: '/approval', label: '审核', icon: CheckCircle },
  { href: '/knowledge', label: '知识库', icon: BookOpen },
  { href: '/notifications', label: '消息', icon: Bell, badge: 3 },
];

// 侧边菜单项
const menuItems = [
  { href: '/projects', label: '项目管理', icon: FolderOpen },
  { href: '/projects/kanban', label: '项目看板', icon: Menu },
  { href: '/bid', label: '标书文档', icon: FileText },
  { href: '/knowledge', label: '知识库', icon: BookOpen },
  { href: '/approval', label: '审核中心', icon: CheckCircle },
  { href: '/dashboard', label: '项目看板', icon: FolderOpen },
  { href: '/calendar', label: '投标日历', icon: Menu },
  { href: '/quotes', label: '智能报价', icon: FileText },
  { href: '/ai-governance', label: 'AI治理', icon: BookOpen },
  { href: '/monitoring', label: '系统监控', icon: CheckCircle },
];

export function MobileNav({ className }: MobileNavProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <>
      {/* 移动端顶部栏 */}
      <header className={cn(
        'lg:hidden fixed top-0 left-0 right-0 z-50 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}>
        <div className="flex h-full items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold">标书管理</span>
          </Link>

          {/* 右侧操作 */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
            >
              <Search className="h-4 w-4" />
            </Button>
            <ThemeToggleSimple />
            
            {/* 侧边菜单触发器 */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="text-left">菜单</SheetTitle>
                </SheetHeader>
                <div className="p-4 space-y-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSheetOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      当前用户: <span className="text-foreground">管理员</span>
                    </div>
                    <Button variant="ghost" size="sm">
                      退出
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* 移动端底部导航栏 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
        <div className="flex h-full items-center justify-around px-2">
          {bottomNavItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge && item.badge > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
          
          {/* 快捷操作按钮 */}
          <Link
            href="/projects/new"
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
          >
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <Plus className="h-5 w-5 text-primary-foreground" />
            </div>
          </Link>
        </div>
      </nav>

      {/* 占位元素，避免内容被固定栏遮挡 */}
      <div className="lg:hidden h-14" /> {/* 顶部占位 */}
      <div className="lg:hidden h-16" /> {/* 底部占位 */}
    </>
  );
}

/**
 * 移动端适配样式
 * 在 globals.css 中添加:
 * 
 * .safe-area-bottom {
 *   padding-bottom: env(safe-area-inset-bottom);
 * }
 * 
 * @media (max-width: 1023px) {
 *   body {
 *     padding-top: 3.5rem;
 *     padding-bottom: 4rem;
 *   }
 * }
 */

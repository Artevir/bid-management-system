'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  CheckCircle,
  BookOpen,
  FileStack,
  Settings,
  Users,
  Shield,
  Menu,
  X,
  ChevronDown,
  Bell,
  Search,
  LogOut,
  User,
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  FileCheck,
  LucideIcon,
  Tags,
  FolderTree,
  LayoutTemplate,
  FileSearch,
  Building,
  Sparkles,
  DollarSign,
  Calendar as CalendarIcon,
  Package,
  Handshake,
  Wand2,
  ListTodo,
  ShieldCheck,
  Gavel,
  Globe,
  PenTool,
  Calculator,
  MessageSquare,
  Archive,
  Cpu,
  Image as ImageIcon,
  Building2,
  MapPin,
  FileSignature,
  Stamp,
  Book,
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { name: '工作台', href: '/', icon: LayoutDashboard },
  { 
    name: '招标信息抓取', 
    href: '/tender-crawl', 
    icon: Globe,
    children: [
      { name: '招标信息列表', href: '/tender-crawl', icon: Globe },
      { name: '抓取源管理', href: '/tender-crawl/sources', icon: Settings },
    ],
  },
  { 
    name: '项目管理', 
    href: '/projects', 
    icon: FolderOpen,
    children: [
      { name: '项目列表', href: '/projects', icon: FolderOpen },
      { name: '文件解读', href: '/interpretations', icon: FileSearch },
      { name: '智能任务规划', href: '/tasks/planning', icon: Wand2 },
      { name: '甘特图', href: '/gantt', icon: CalendarIcon },
      { name: '项目看板', href: '/dashboard', icon: BarChart3 },
      { name: '成本管理', href: '/costs', icon: DollarSign },
      { name: '项目组织', href: '/project-org', icon: Users },
      { name: '项目讨论区', href: '/project-discussions', icon: MessageSquare },
    ],
  },
  {
    name: '标书文档',
    href: '/bid',
    icon: FileText,
    children: [
      { name: '文档列表', href: '/bid', icon: FileText },
      { name: '文档解读', href: '/bid/interpretations', icon: FileSearch },
      { name: '文档模板', href: '/bid/templates', icon: LayoutTemplate },
      { name: '审批流程', href: '/bid/approval', icon: CheckCircle },
      { name: '签章管理', href: '/bid/seal', icon: PenTool },
      { name: '文档统计', href: '/bid/statistics', icon: BarChart3 },
    ],
  },
  {
    name: '投标事务',
    href: '/guarantees',
    icon: ShieldCheck,
    children: [
      { name: '购买招标文件', href: '/bid-document-purchases', icon: FileSignature },
      { name: '保证金管理', href: '/guarantees', icon: ShieldCheck },
      { name: '开标记录管理', href: '/openings', icon: Gavel },
      { name: '去投标', href: '/bid-attendances', icon: MapPin },
      { name: '盖章安排', href: '/bid-seal-applications', icon: Stamp },
      { name: '领取中标通知书', href: '/bid-notification-collections', icon: FileCheck },
      { name: '履约保证金', href: '/performance-bonds', icon: Shield },
      { name: '签订书面合同', href: '/contract-signings', icon: FileSignature },
    ],
  },
  { 
    name: '政采对接', 
    href: '/bidding-platforms', 
    icon: Building2,
    children: [
      { name: '对接单位管理', href: '/bidding-platforms', icon: Building2 },
      { name: '地图定位', href: '/bidding-platforms/map', icon: MapPin },
    ],
  },
  { 
    name: '智能报价', 
    href: '/quote-analysis', 
    icon: Calculator,
  },
  { 
    name: '电子签章', 
    href: '/e-sign', 
    icon: PenTool,
    children: [
      { name: '签署任务', href: '/e-sign', icon: FileCheck },
      { name: '电子印章', href: '/e-sign?tab=seals', icon: PenTool },
      { name: '签署配置', href: '/e-sign?tab=configs', icon: Settings },
    ],
  },
  { 
    name: '审核中心', 
    href: '/approval', 
    icon: CheckCircle,
    children: [
      { name: '审核列表', href: '/approval', icon: ClipboardCheck },
      { name: '解读审核', href: '/approval/interpretations', icon: FileSearch },
      { name: '解读审核配置', href: '/settings/approval/interpretation', icon: Settings },
      { name: '授权申请审核', href: '/approval/authorizations', icon: FileCheck },
      { name: '友司支持审核', href: '/approval/partner-applications', icon: Building },
      { name: '审校配置', href: '/review/config', icon: Settings },
      { name: '导出中心', href: '/exports', icon: Download },
    ],
  },
  { 
    name: '任务中心', 
    href: '/tasks', 
    icon: ClipboardCheck,
    children: [
      { name: '任务列表', href: '/tasks', icon: ListTodo },
    ],
  },
  {
    name: '工作流管理',
    href: '/workflows',
    icon: Settings,
  },
  {
    name: '投标支持',
    href: '/support',
    icon: Handshake,
    children: [
      { name: '支持概览', href: '/support', icon: Handshake },
      { name: '授权申请', href: '/support/authorizations', icon: FileCheck },
      { name: '样机申请', href: '/support/sample-applications', icon: Package },
      { name: '价格申请', href: '/support/price-applications', icon: DollarSign },
      { name: '友司支持', href: '/support/partner-applications', icon: Building },
      { name: '全部申请', href: '/support/applications', icon: FileStack },
    ],
  },
  {
    name: '全文检索',
    href: '/search',
    icon: Search,
  },
  { 
    name: '知识库', 
    href: '/knowledge', 
    icon: BookOpen,
    children: [
      { name: '知识列表', href: '/knowledge', icon: BookOpen },
      { name: '知识审批', href: '/knowledge/approval', icon: FileCheck },
    ],
  },
  { name: 'API文档', href: '/api-docs', icon: Book },
  { name: '模板管理', href: '/templates', icon: FileStack },
  {
    name: '方案库',
    href: '/schemes',
    icon: FolderTree,
    children: [
      { name: '全部方案', href: '/schemes', icon: FolderOpen },
      { name: '方案模板', href: '/schemes?isTemplate=true', icon: LayoutTemplate },
    ],
  },
  { 
    name: 'AI助手', 
    href: '/prompts', 
    icon: BrainCircuit,
    children: [
      { name: 'AI员工', href: '/prompts/agents', icon: Users },
      { name: '提示词模板', href: '/prompts/templates', icon: FileText },
      { name: '分类管理', href: '/prompts/categories', icon: Settings },
      { name: '对话测试', href: '/prompts/generate', icon: Sparkles },
    ],
  },
  {
    name: 'LLM配置',
    href: '/llm',
    icon: Cpu,
    children: [
      { name: '模型配置', href: '/llm', icon: Settings },
      { name: '模型管理', href: '/llm/models', icon: Cpu },
      { name: '对话测试', href: '/llm/chat', icon: MessageSquare },
      { name: '用量统计', href: '/llm/usage', icon: BarChart3 },
    ],
  },
  { 
    name: 'AI图片生成', 
    href: '/image/generate', 
    icon: ImageIcon,
    children: [
      { name: '图片生成', href: '/image/generate', icon: Sparkles },
      { name: '图片库', href: '/image/library', icon: ImageIcon },
    ],
  },
  { 
    name: '文档框架', 
    href: '/frameworks', 
    icon: LayoutTemplate,
    children: [
      { name: '全部框架', href: '/frameworks', icon: LayoutTemplate },
      { name: '系统框架', href: '/frameworks?scope=system', icon: Globe },
      { name: '公司框架', href: '/frameworks?scope=company', icon: Building },
    ],
  },
  { 
    name: '标签管理', 
    href: '/tags', 
    icon: Tags,
    children: [
      { name: '标签列表', href: '/tags', icon: Tags },
      { name: '分类管理', href: '/tags?tab=categories', icon: FolderTree },
    ],
  },
  { 
    name: '公司管理', 
    href: '/companies', 
    icon: Building,
    children: [
      { name: '公司信息', href: '/companies', icon: Building },
      { name: '标书归档', href: '/archives', icon: Archive },
    ],
  },
];

const adminNavigation: NavItem[] = [
  { name: '用户管理', href: '/admin/users', icon: Users },
  { name: '角色权限', href: '/admin/roles', icon: Shield },
  { name: '审计日志', href: '/admin/audit', icon: Settings },
];

// 子菜单项组件（支持三级导航）
function NavChildItem({ child, pathname, level: _level = 1 }: { child: NavItem; pathname: string; level?: number }) {
  const hasChildren = child.children && child.children.length > 0;
  const isDirectActive = pathname === child.href;
  const isChildActive = hasChildren && child.children!.some(c => pathname === c.href);
  const isActive = isDirectActive || isChildActive;
  
  const [expanded, setExpanded] = useState(isChildActive);

  // 有三级菜单的情况
  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <span className="flex items-center gap-3">
            <child.icon className="h-4 w-4" />
            {child.name}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </button>
        {expanded && (
          <div className="ml-4 space-y-1 border-l pl-2">
            {child.children!.map((grandChild) => (
              <Link
                key={grandChild.name}
                href={grandChild.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname === grandChild.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <grandChild.icon className="h-4 w-4" />
                {grandChild.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 普通二级菜单项
  return (
    <Link
      key={child.name}
      href={child.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <child.icon className="h-4 w-4" />
      {child.name}
    </Link>
  );
}

// 导航菜单项组件（支持子菜单）
function NavMenuItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const hasChildren = item.children && item.children.length > 0;
  const isDirectActive = pathname === item.href;
  const isChildActive = hasChildren && item.children!.some(c => pathname === c.href || (c.children && c.children.some(gc => pathname === gc.href)));
  const isActive = isDirectActive || isChildActive;
  
  const [expanded, setExpanded] = useState(isChildActive);

  // 有子菜单的情况
  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <span className="flex items-center gap-3">
            <item.icon className="h-4 w-4" />
            {item.name}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </button>
        {expanded && (
          <div className="ml-4 space-y-1 border-l pl-2">
            {item.children!.map((child) => (
              <NavChildItem key={child.name} child={child} pathname={pathname} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // 无子菜单的普通导航项
  return (
    <Link
      key={item.name}
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.name}
    </Link>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 登录页面不显示布局
  const isLoginPage = pathname === '/login';
  const isAdminPage = pathname?.startsWith('/admin');

  useEffect(() => {
    setMounted(true);
  }, []);

  // 登录页面不显示布局
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 管理后台使用简化布局
  if (isAdminPage) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex">
          <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
            <div className="flex h-16 items-center border-b px-6">
              <Link href="/" className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                <span className="font-semibold">标书管理平台</span>
              </Link>
            </div>
            <nav className="flex-1 space-y-1 p-4">
              {adminNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t p-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                返回工作台
              </Link>
            </div>
          </aside>
          <main className="flex-1 ml-64">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-64 border-r bg-card transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <Link href="/" className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-semibold">标书管理平台</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {navigation.map((item) => (
            <NavMenuItem key={item.name} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="border-t p-4">
          <Link
            href="/files"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <FileStack className="h-4 w-4" />
            文件管理
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <span className="flex items-center gap-3">
                  <Shield className="h-4 w-4" />
                  后台管理
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48">
              {adminNavigation.map((item) => (
                <DropdownMenuItem key={item.name} asChild>
                  <Link href={item.href} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
            </Button>

            {mounted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline-block text-sm">用户</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>
                    <span>用户</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      个人设置
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings/sessions" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      会话管理
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      fetch('/api/auth/logout', { method: 'POST' });
                      window.location.href = '/login';
                    }}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

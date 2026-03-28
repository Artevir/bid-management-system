'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  FolderOpen, 
  FileText, 
  Search, 
  FileX, 
  Inbox, 
  AlertCircle,
  CheckCircle,
  Clock,
  type LucideIcon,
} from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// 通用空状态组件
export function EmptyState({ 
  icon: Icon = Inbox, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in',
      className
    )}>
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="outline" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// 无数据空状态
export function NoDataState({ 
  message = '暂无数据',
  description 
}: { 
  message?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon={Inbox}
      title={message}
      description={description}
    />
  );
}

// 无搜索结果
export function NoSearchResultState({ 
  keyword,
  onClear 
}: { 
  keyword?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      icon={Search}
      title="未找到相关结果"
      description={keyword ? `未找到与"${keyword}"相关的内容` : '尝试其他关键词'}
      action={onClear ? { label: '清除搜索', onClick: onClear } : undefined}
    />
  );
}

// 无项目
export function NoProjectState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="暂无项目"
      description="创建您的第一个投标项目，开始管理工作流程"
      action={onCreate ? { label: '新建项目', onClick: onCreate } : undefined}
    />
  );
}

// 无文档
export function NoDocumentState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="暂无文档"
      description="创建标书文档，开始编写内容"
      action={onCreate ? { label: '新建文档', onClick: onCreate } : undefined}
    />
  );
}

// 无任务
export function NoTaskState() {
  return (
    <EmptyState
      icon={CheckCircle}
      title="暂无待办任务"
      description="您已完成所有任务，做得好！"
    />
  );
}

// 无审核
export function NoApprovalState() {
  return (
    <EmptyState
      icon={Clock}
      title="暂无待审核项"
      description="所有文档都已审核完成"
    />
  );
}

// 无知识条目
export function NoKnowledgeState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="暂无知识条目"
      description="添加知识条目，建立企业知识库"
      action={onAdd ? { label: '添加知识', onClick: onAdd } : undefined}
    />
  );
}

// 加载错误状态
export function ErrorState({ 
  message = '加载失败',
  description = '请检查网络连接后重试',
  onRetry 
}: { 
  message?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={AlertCircle}
      title={message}
      description={description}
      action={onRetry ? { label: '重新加载', onClick: onRetry } : undefined}
    />
  );
}

// 无权限状态
export function NoPermissionState() {
  return (
    <EmptyState
      icon={AlertCircle}
      title="无访问权限"
      description="您没有权限访问此内容，请联系管理员"
    />
  );
}

// 开发中状态
export function ComingSoonState({ feature }: { feature?: string }) {
  return (
    <EmptyState
      icon={Clock}
      title="功能开发中"
      description={feature ? `${feature}功能即将上线，敬请期待` : '该功能即将上线，敬请期待'}
    />
  );
}

// 表格空状态
export function TableEmptyState({ 
  message = '暂无数据',
  description,
  action
}: { 
  message?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted/50 p-3 mb-3">
        <FileX className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      {action && (
        <Button 
          variant="link" 
          size="sm" 
          onClick={action.onClick}
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

type TableState = 'loading' | 'error' | 'empty';

interface TableListStateRowProps {
  state: TableState;
  colSpan: number;
  error?: string;
  onRetry?: () => void;
  loadingText?: string;
  emptyText?: string;
}

export function TableListStateRow({
  state,
  colSpan,
  error,
  onRetry,
  loadingText = '加载中...',
  emptyText = '暂无数据',
}: TableListStateRowProps) {
  if (state === 'loading') {
    return (
      <tr>
        <td colSpan={colSpan} className="text-center py-8 text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{loadingText}</span>
          </div>
        </td>
      </tr>
    );
  }

  if (state === 'error') {
    return (
      <tr>
        <td colSpan={colSpan} className="text-center py-8">
          <div className="space-y-3">
            <p className="text-sm text-red-600">加载失败：{error || '未知错误'}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-8 text-muted-foreground">
        {emptyText}
      </td>
    </tr>
  );
}

interface ListStateBlockProps {
  state: TableState;
  error?: string;
  onRetry?: () => void;
  loadingText?: string;
  emptyText?: string;
}

export function ListStateBlock({
  state,
  error,
  onRetry,
  loadingText = '加载中...',
  emptyText = '暂无数据',
}: ListStateBlockProps) {
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>{loadingText}</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-600 mb-3">加载失败：{error || '未知错误'}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  return <div className="text-center py-12 text-muted-foreground">{emptyText}</div>;
}

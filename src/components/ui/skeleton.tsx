'use client';

import { cn } from '@/lib/utils';
import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

// 基础骨架屏
export function Skeleton({ className, style, ...props }: SkeletonProps) {
  return (
    <div className={cn('animate-shimmer rounded-md bg-muted', className)} style={style} {...props} />
  );
}

// 表格行骨架屏
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// 表格骨架屏
export function TableSkeleton({ 
  rows = 5, 
  columns = 5 
}: { 
  rows?: number; 
  columns?: number;
}) {
  return (
    <div className="w-full">
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 卡片骨架屏
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border p-6 space-y-4', className)}>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// 统计卡片骨架屏
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    </div>
  );
}

// 列表项骨架屏
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-20 rounded-md" />
    </div>
  );
}

// 列表骨架屏
export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

// 表单骨架屏
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="h-10 w-full rounded-md mt-6" />
    </div>
  );
}

// 页面头部骨架屏
export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-60" />
      </div>
      <Skeleton className="h-10 w-28 rounded-md" />
    </div>
  );
}

// 图表骨架屏
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full flex items-end justify-around gap-2 px-4" style={{ height }}>
      {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
        <div
          key={i}
          className={cn('w-full rounded-t-md animate-shimmer')}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

// 仪表盘骨架屏
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      
      {/* 图表区域 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <ChartSkeleton height={250} />
        </div>
        <div className="rounded-xl border p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <ChartSkeleton height={250} />
        </div>
      </div>
      
      {/* 列表区域 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-6">
          <Skeleton className="h-6 w-24 mb-4" />
          <ListSkeleton count={4} />
        </div>
        <div className="rounded-xl border p-6">
          <Skeleton className="h-6 w-24 mb-4" />
          <ListSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}

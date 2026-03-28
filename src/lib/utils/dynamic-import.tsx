/**
 * 动态导入工具
 * 用于组件懒加载和代码分割
 */

import dynamic from 'next/dynamic';

/**
 * 加载指示器组件
 */
function LoadingIndicator() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
    </div>
  );
}

/**
 * 创建动态组件的默认配置
 */
const defaultOptions = {
  loading: LoadingIndicator,
  ssr: false,
};

/**
 * 动态导入项目相关组件
 */
export const DynamicProjectDashboard = dynamic(
  () => import('@/components/dashboard/project-dashboard').then((mod) => mod.default),
  { ...defaultOptions }
);

export const DynamicParseDashboard = dynamic(
  () => import('@/components/parse/parse-dashboard').then((mod) => mod.ParseDashboard),
  { ...defaultOptions }
);

export const DynamicProcessRecords = dynamic(
  () => import('@/components/project/process-records').then((mod) => mod.ProcessRecords),
  { ...defaultOptions }
);

export const DynamicFilePreview = dynamic(
  () => import('@/components/document/file-preview').then((mod) => mod.FilePreview),
  { ...defaultOptions }
);

export const DynamicDocumentReader = dynamic(
  () => import('@/components/parse/document-reader').then((mod) => mod.DocumentReader),
  { ...defaultOptions }
);

/**
 * 预加载组件（用于预加载下一个页面可能需要的组件）
 */
export function preloadComponent(importFn: () => Promise<unknown>) {
  if (typeof window !== 'undefined') {
    // 在空闲时间预加载
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
        importFn().catch(() => {
          // 预加载失败不处理
        });
      });
    }
  }
}

/**
 * 预加载常用组件
 */
export function preloadCommonComponents() {
  // 预加载项目详情页组件
  preloadComponent(() => import('@/components/dashboard/project-dashboard'));
  preloadComponent(() => import('@/components/parse/parse-dashboard'));
}

/**
 * 预加载用户可能访问的页面组件
 */
export function preloadRouteComponents(route: string) {
  const routeComponentMap: Record<string, () => Promise<unknown>> = {
    '/projects': () => import('@/app/projects/page'),
    '/knowledge': () => import('@/app/knowledge/page'),
    '/templates': () => import('@/app/templates/page'),
  };

  const preloadFn = routeComponentMap[route];
  if (preloadFn) {
    preloadComponent(preloadFn);
  }
}

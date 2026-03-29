'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 懒加载组件配置
 * 用于优化首屏加载性能，按需加载大型组件
 * 
 * 注意：使用这些组件前，请确保对应的组件文件已存在
 */

/**
 * 创建懒加载组件的工具函数
 */
function _createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  loadingComponent: React.ReactNode = <Skeleton className="w-full h-[400px]" />
) {
  return dynamic(importFn, {
    loading: () => <>{loadingComponent}</>,
    ssr: false,
  });
}

/**
 * 预定义的加载状态组件
 */
const LoadingStates = {
  small: <Skeleton className="w-full h-[200px]" />,
  medium: <Skeleton className="w-full h-[400px]" />,
  large: <Skeleton className="w-full h-[600px]" />,
  xlarge: <Skeleton className="w-full h-[800px]" />,
};

/**
 * 懒加载组件映射表
 * 当对应的组件文件创建后，可以取消注释相应的导出
 */
export const LazyComponents = {
  // 项目列表页懒加载（需要创建 src/components/projects/project-list.tsx）
  // ProjectList: createLazyComponent(
  //   () => import('@/components/projects/project-list').then(mod => ({ default: mod.ProjectList })),
  //   LoadingStates.large
  // ),
  
  // 标书编辑器懒加载（需要创建 src/components/bid/bid-editor.tsx）
  // BidEditor: createLazyComponent(
  //   () => import('@/components/bid/bid-editor').then(mod => ({ default: mod.BidEditor })),
  //   LoadingStates.xlarge
  // ),
  
  // 知识库编辑器懒加载（需要创建 src/components/knowledge/knowledge-editor.tsx）
  // KnowledgeEditor: createLazyComponent(
  //   () => import('@/components/knowledge/knowledge-editor').then(mod => ({ default: mod.KnowledgeEditor })),
  //   LoadingStates.medium
  // ),
  
  // 审核流程组件懒加载（需要创建 src/components/approval/approval-flow.tsx）
  // ApprovalFlow: createLazyComponent(
  //   () => import('@/components/approval/approval-flow').then(mod => ({ default: mod.ApprovalFlow })),
  //   LoadingStates.medium
  // ),
  
  // 数据看板懒加载（需要创建 src/components/dashboard/dashboard-view.tsx）
  // DashboardView: createLazyComponent(
  //   () => import('@/components/dashboard/dashboard-view').then(mod => ({ default: mod.DashboardView })),
  //   LoadingStates.xlarge
  // ),
};

/**
 * 图表组件懒加载工厂函数
 * 在需要使用图表时按需加载
 */
export function createLazyCharts() {
  // 检查是否已安装 recharts
  try {
    require.resolve('recharts');
    
    return {
      LineChart: dynamic(() => import('recharts').then(mod => mod.LineChart), {
        ssr: false,
        loading: () => LoadingStates.medium,
      }),
      BarChart: dynamic(() => import('recharts').then(mod => mod.BarChart), {
        ssr: false,
        loading: () => LoadingStates.medium,
      }),
      PieChart: dynamic(() => import('recharts').then(mod => mod.PieChart), {
        ssr: false,
        loading: () => LoadingStates.medium,
      }),
    };
  } catch {
    console.warn('recharts not installed, charts will not be available');
    return null;
  }
}

/**
 * 工具函数：预加载组件
 * 在用户可能访问某页面前预加载该页面的组件
 */
export function preloadComponent(importFn: () => Promise<any>) {
  if (typeof window !== 'undefined') {
    // 在浏览器空闲时预加载
    requestIdleCallback(() => {
      importFn().catch(() => {
        // 预加载失败不影响正常使用
      });
    });
  }
}

/**
 * 性能优化建议：
 * 
 * 1. 使用动态导入（dynamic import）拆分代码
 * 2. 对大型组件（如编辑器、图表）使用懒加载
 * 3. 预加载关键路由组件（如首页跳转到详情页）
 * 4. 使用 Skeleton 提升加载体验
 * 5. 避免在服务端渲染大型客户端组件
 * 
 * 使用示例：
 * 
 * ```tsx
 * import { LazyComponents, preloadComponent } from '@/lib/performance/lazy-components';
 * 
 * export default function Page() {
 *   // 鼠标悬停时预加载详情页组件
 *   const handleHover = () => {
 *     preloadComponent(() => import('@/components/detail-page'));
 *   };
 *   
 *   return (
 *     <div onMouseEnter={handleHover}>
 *       <LazyComponents.ProjectList />
 *     </div>
 *   );
 * }
 * ```
 */

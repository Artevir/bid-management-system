/**
 * 性能优化模块
 * 统一导出所有性能相关的工具和组件
 */

// 缓存服务
export * from '../cache';

// 懒加载组件
export * from './lazy-components';

// 性能监控
export * from './monitor';

/**
 * 性能优化最佳实践指南
 */

/**
 * 1. 使用缓存服务优化数据查询
 * 
 * 示例：
 * ```typescript
 * import { cacheService } from '@/lib/cache';
 * 
 * // 获取数据（带缓存）
 * const user = await cacheService.get(
 *   'user:123',
 *   () => db.select().from(users).where(eq(users.id, 123)),
 *   { ttl: 300 } // 5分钟缓存
 * );
 * 
 * // 使缓存失效
 * await cacheService.delete('user:123');
 * ```
 */

/**
 * 2. 使用懒加载组件优化首屏加载
 * 
 * 示例：
 * ```typescript
 * import { LazyBidEditor } from '@/lib/performance/lazy-components';
 * 
 * export default function EditPage() {
 *   return (
 *     <div>
 *       <h1>编辑标书</h1>
 *       <LazyBidEditor documentId={docId} />
 *     </div>
 *   );
 * }
 * ```
 */

/**
 * 3. 使用性能监控追踪指标
 * 
 * 示例：
 * ```typescript
 * import { performanceMonitor } from '@/lib/performance/monitor';
 * 
 * // 获取性能报告
 * const report = await performanceMonitor.getFullReport();
 * console.log('LCP:', report.largestContentfulPaint);
 * 
 * // 发送性能报告
 * await performanceMonitor.sendReport();
 * ```
 */

/**
 * 4. 数据库查询优化
 * 
 * - 确保所有高频查询字段都有索引
 * - 使用数据库连接池
 * - 避免N+1查询问题
 * - 使用分页限制返回数据量
 */

/**
 * 5. 前端渲染优化
 * 
 * - 使用React.memo避免不必要的重渲染
 * - 使用useMemo和useCallback优化计算
 * - 虚拟化长列表（react-window或react-virtualized）
 * - 图片懒加载和响应式图片
 */

/**
 * 6. API优化
 * 
 * - 使用并行请求（Promise.all）
 * - 实现请求去重
 * - 使用流式响应处理大数据
 * - 启用响应压缩
 */

/**
 * 7. 缓存策略
 * 
 * - 静态资源：长期缓存（一年）
 * - API响应：短期缓存（分钟级）
 * - 用户数据：会话级缓存
 * - 热点数据：预加载和预缓存
 */

/**
 * 性能指标目标
 * 
 * - LCP (Largest Contentful Paint): < 2.5秒
 * - FID (First Input Delay): < 100ms
 * - CLS (Cumulative Layout Shift): < 0.1
 * - TTI (Time to Interactive): < 3.8秒
 * - 首屏加载时间: < 1.5秒
 * - API响应时间: < 200ms (P95)
 */

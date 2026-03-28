/**
 * API缓存策略
 * 支持内存缓存和Redis缓存
 * 
 * 导出说明：
 * - withCache: 缓存装饰器
 * - CacheService: 缓存服务类
 * - 预定义缓存实例: userPermissionCache, projectCache等
 * - 缓存失效函数: invalidateUserCache等
 */

// ============================================
// 缓存配置
// ============================================

interface CacheConfig {
  ttl: number; // 缓存时间（秒）
  maxSize?: number; // 最大缓存数量（仅内存缓存）
}

// 默认缓存配置
const DEFAULT_TTL = 60; // 60秒
const DEFAULT_MAX_SIZE = 1000; // 最多1000条

// ============================================
// 内存缓存实现
// ============================================

interface CacheEntry<T> {
  value: T;
  expireAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    
    // 定期清理过期缓存（每分钟）
    setInterval(() => this.cleanup(), 60000);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) return null;
    
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  set<T>(key: string, value: T, ttl: number): void {
    // 如果超过最大数量，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      value,
      expireAt: Date.now() + ttl * 1000,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expireAt) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

// 全局内存缓存实例
const memoryCache = new MemoryCache();

// ============================================
// 缓存装饰器
// ============================================

/**
 * 创建带缓存的API函数
 */
export function withCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: CacheConfig & {
    keyGenerator?: (...args: TArgs) => string;
  }
): (...args: TArgs) => Promise<TResult> {
  const { ttl = DEFAULT_TTL, keyGenerator } = options;

  return async (...args: TArgs): Promise<TResult> => {
    // 生成缓存key
    const cacheKey = keyGenerator
      ? keyGenerator(...args)
      : `cache:${fn.name}:${JSON.stringify(args)}`;

    // 尝试从缓存获取
    const cached = memoryCache.get<TResult>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 执行原函数
    const result = await fn(...args);

    // 存入缓存
    memoryCache.set(cacheKey, result, ttl);

    return result;
  };
}

/**
 * 创建带失效机制的缓存函数
 */
export function createCachedFunction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    ttl: number;
    keyPrefix?: string;
    shouldCache?: (result: TResult) => boolean;
  }
): (...args: TArgs) => Promise<TResult> {
  const { ttl, keyPrefix = 'fn', shouldCache } = options;

  return async (...args: TArgs): Promise<TResult> => {
    const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;

    // 尝试获取缓存
    const cached = memoryCache.get<TResult>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 执行函数
    const result = await fn(...args);

    // 判断是否缓存
    if (!shouldCache || shouldCache(result)) {
      memoryCache.set(cacheKey, result, ttl);
    }

    return result;
  };
}

// ============================================
// 预定义缓存策略
// ============================================

/**
 * 用户权限缓存（5分钟）
 */
export const cacheUserPermissions = <TArgs extends [number], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) => withCache(fn, {
  ttl: 300, // 5分钟
  keyGenerator: (userId: number) => `user:permissions:${userId}`,
});

/**
 * 项目信息缓存（2分钟）
 */
export const cacheProjectInfo = <TArgs extends [number], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) => withCache(fn, {
  ttl: 120, // 2分钟
  keyGenerator: (projectId: number) => `project:info:${projectId}`,
});

/**
 * 知识库搜索结果缓存（1分钟）
 */
export const cacheKnowledgeSearch = <TArgs extends [string, number?], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) => withCache(fn, {
  ttl: 60, // 1分钟
  keyGenerator: (query: string, limit?: number) => `knowledge:search:${query}:${limit || 10}`,
});

/**
 * 模板列表缓存（5分钟）
 */
export const cacheTemplateList = <TArgs extends [string?], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) => withCache(fn, {
  ttl: 300, // 5分钟
  keyGenerator: (type?: string) => `templates:list:${type || 'all'}`,
});

/**
 * 统计数据缓存（10分钟）
 */
export const cacheStatistics = <TArgs extends [], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) => withCache(fn, {
  ttl: 600, // 10分钟
  keyGenerator: () => 'statistics:dashboard',
});

// ============================================
// 缓存失效
// ============================================

/**
 * 清除用户相关缓存
 */
export function invalidateUserCache(userId: number): void {
  memoryCache.delete(`user:permissions:${userId}`);
}

/**
 * 清除项目相关缓存
 */
export function invalidateProjectCache(projectId: number): void {
  memoryCache.delete(`project:info:${projectId}`);
}

/**
 * 清除知识库相关缓存
 */
export function invalidateKnowledgeCache(): void {
  // 清除所有知识库搜索缓存
  for (const key of memoryCache['cache'].keys()) {
    if (key.startsWith('knowledge:')) {
      memoryCache.delete(key);
    }
  }
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  memoryCache.clear();
}

// ============================================
// 缓存统计
// ============================================

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
} {
  return {
    size: memoryCache.size,
    maxSize: DEFAULT_MAX_SIZE,
  };
}

// ============================================
// 导出内存缓存实例（用于高级场景）
// ============================================

export { memoryCache };

// ============================================
// 增强版缓存服务导出
// ============================================

export {
  CacheService,
  userPermissionCache,
  userMenuCache,
  userRoleCache,
  projectCache,
  knowledgeCache,
  templateCache,
  statsCache,
  departmentCache,
  invalidateTemplateCache,
  invalidateDepartmentCache,
  globalCache as enhancedCache,
  type CacheStats as EnhancedCacheStats,
  type CacheOptions,
} from './service';

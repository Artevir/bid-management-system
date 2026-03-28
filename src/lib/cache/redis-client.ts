/**
 * Redis缓存客户端（内存缓存实现）
 * 用于缓存常用数据，提升系统性能
 * 
 * 注意：当前使用内存缓存实现，如需使用 Redis，请安装 ioredis 并修改实现
 */

// ============================================
// 缓存配置
// ============================================

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTTL?: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: 'bid-platform:',
  defaultTTL: 3600,
};

// ============================================
// 缓存TTL常量
// ============================================

export const CacheTTL = {
  SHORT: 300,
  MEDIUM: 1800,
  LONG: 3600,
  VERY_LONG: 86400,
  WEEK: 604800,
} as const;

// ============================================
// 内存缓存实现
// ============================================

interface CacheItem {
  value: any;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheItem>();

function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
}

setInterval(cleanupExpiredCache, 60 * 1000);

export async function closeRedisConnection(): Promise<void> {
  memoryCache.clear();
}

export interface CacheOptions {
  ttl?: number;
}

export async function cacheSet(
  key: string,
  value: any,
  options: CacheOptions = {}
): Promise<void> {
  const ttl = options.ttl ?? DEFAULT_CACHE_CONFIG.defaultTTL!;

  try {
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  } catch (error) {
    console.error('Cache Set Error:', error);
    throw error;
  }
}

export async function cacheGet<T = any>(
  key: string
): Promise<T | null> {
  try {
    const item = memoryCache.get(key);
    if (!item) {
      return null;
    }

    if (item.expiresAt < Date.now()) {
      memoryCache.delete(key);
      return null;
    }

    return item.value as T;
  } catch (error) {
    console.error('Cache Get Error:', error);
    return null;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    memoryCache.delete(key);
  } catch (error) {
    console.error('Cache Delete Error:', error);
    throw error;
  }
}

export async function cacheDeletePattern(pattern: string): Promise<number> {
  try {
    let count = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
        count++;
      }
    }
    
    return count;
  } catch (error) {
    console.error('Cache Delete Pattern Error:', error);
    throw error;
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  try {
    const item = memoryCache.get(key);
    if (!item) {
      return false;
    }
    
    if (item.expiresAt < Date.now()) {
      memoryCache.delete(key);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Cache Exists Error:', error);
    return false;
  }
}

export async function cacheTTL(key: string): Promise<number> {
  try {
    const item = memoryCache.get(key);
    if (!item) {
      return -1;
    }
    
    const remaining = Math.floor((item.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -1;
  } catch (error) {
    console.error('Cache TTL Error:', error);
    return -1;
  }
}

export async function invalidateProjectCache(projectId: string): Promise<void> {
  await cacheDeletePattern(`project:${projectId}:*`);
  await cacheDeletePattern(`project:${projectId}:*:*`);
}

export async function invalidateCompanyCache(companyId: string): Promise<void> {
  await cacheDeletePattern(`company:${companyId}:*`);
}

export async function invalidateUserCache(userId: string): Promise<void> {
  await cacheDeletePattern(`user:${userId}:*`);
}

export async function invalidateAllCache(): Promise<number> {
  return await cacheDeletePattern('*');
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keyCount: number;
  memoryUsage: number;
}

export async function getCacheStats(): Promise<CacheStats> {
  try {
    cleanupExpiredCache();
    
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      keyCount: memoryCache.size,
      memoryUsage: 0,
    };
  } catch (error) {
    console.error('Get Cache Stats Error:', error);
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      keyCount: 0,
      memoryUsage: 0,
    };
  }
}

// ============================================
// 兼容性导出（为 generation-progress-service-v2.ts 提供）
// ============================================

export const redis = {
  get: async (key: string) => {
    const result = await cacheGet(key);
    return result !== null ? JSON.stringify(result) : null;
  },
  set: async (key: string, value: string, ttl?: number) => {
    await cacheSet(key, JSON.parse(value), ttl ? { ttl } : undefined);
  },
  del: async (key: string) => {
    await cacheDelete(key);
  },
  exists: async (key: string) => {
    return (await cacheExists(key)) ? 1 : 0;
  },
  expire: async (key: string, seconds: number) => {
    const item = memoryCache.get(key);
    if (item) {
      item.expiresAt = Date.now() + seconds * 1000;
      memoryCache.set(key, item);
      return 1;
    }
    return 0;
  },
  keys: async (pattern: string) => {
    const keys: string[] = [];
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        keys.push(key);
      }
    }
    return keys;
  },
  setex: async (key: string, seconds: number, value: string) => {
    await cacheSet(key, JSON.parse(value), { ttl: seconds });
  },
  // Redis Hash 操作（简化实现）
  hset: async (key: string, field: string, value: any) => {
    const hashKey = `${key}:${field}`;
    await cacheSet(hashKey, value);
  },
  hget: async (key: string, field: string) => {
    const result = await cacheGet(key);
    if (result && typeof result === 'object' && field in result) {
      return JSON.stringify(result[field]);
    }
    return null;
  },
  hgetall: async (key: string) => {
    const result: any = {};
    const pattern = `${key}:*`;
    for (const fullKey of memoryCache.keys()) {
      if (fullKey.startsWith(key + ':')) {
        const field = fullKey.slice(key.length + 1);
        const value = await cacheGet(fullKey);
        if (value !== null) {
          result[field] = value;
        }
      }
    }
    return result;
  },
  hdel: async (key: string, field: string) => {
    const hashKey = `${key}:${field}`;
    await cacheDelete(hashKey);
  },
  // Redis Pub/Sub（简化实现）
  publish: async (channel: string, message: string) => {
    console.log(`[Redis PubSub] Channel: ${channel}, Message: ${message}`);
    return 1;
  },
  subscribe: async (channel: string, callback: (message: string) => void) => {
    console.log(`[Redis PubSub] Subscribed to: ${channel}`);
    // 简化实现，实际需要 Redis 支持
    return {
      unsubscribe: async () => {
        console.log(`[Redis PubSub] Unsubscribed from: ${channel}`);
      }
    };
  },
};

export const RedisKeys = {
  generationProgress: (documentId: string) => `generation:progress:${documentId}`,
  generationStatus: (documentId: string) => `generation:status:${documentId}`,
  generationChapters: (documentId: string) => `generation:chapters:${documentId}`,
  generationCheckpoint: (documentId: string) => `generation:checkpoint:${documentId}`,
  generationChapter: (documentId: string, chapterId: number) => `generation:chapter:${documentId}:chapters`, // 简化实现，使用统一的key
} as const;

export const getRedisClient = () => redis;

export const isUsingMemoryFallback = () => true;

export default redis;
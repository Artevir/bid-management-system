/**
 * 增强版缓存服务
 * 支持多层缓存、统计、预热等功能
 */

// ============================================
// 类型定义
// ============================================

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
}

export interface CacheEntry<T> {
  value: T;
  expireAt: number;
  createdAt: number;
  accessCount: number;
}

export interface CacheOptions {
  ttl: number; // 缓存时间（秒）
  maxSize?: number; // 最大缓存数量
  prefix?: string; // 缓存键前缀
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_TTL = 60; // 60秒
const DEFAULT_MAX_SIZE = 2000; // 最多2000条

// ============================================
// 内存缓存实现
// ============================================

class EnhancedMemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    
    // 定期清理过期缓存（每5分钟）
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // 更新访问计数
    entry.accessCount++;
    this.hits++;
    return entry.value;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, value: T, ttl: number): void {
    // LRU淘汰策略：如果超过最大数量，删除最久未访问的条目
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      value,
      expireAt: Date.now() + ttl * 1000,
      createdAt: Date.now(),
      accessCount: 0,
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 批量删除（支持前缀匹配）
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 检查是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expireAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * LRU淘汰策略
   */
  private evictLRU(): void {
    // 找出访问次数最少的10%条目并删除
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].accessCount - b[1].accessCount);
    
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// ============================================
// 全局缓存实例
// ============================================

const globalCache = new EnhancedMemoryCache();

// ============================================
// 缓存服务类
// ============================================

export class CacheService {
  private prefix: string;
  private defaultTtl: number;

  constructor(prefix: string = '', defaultTtl: number = DEFAULT_TTL) {
    this.prefix = prefix;
    this.defaultTtl = defaultTtl;
  }

  /**
   * 构建完整缓存键
   */
  private buildKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    return globalCache.get<T>(this.buildKey(key));
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, value: T, ttl?: number): void {
    globalCache.set(this.buildKey(key), value, ttl ?? this.defaultTtl);
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return globalCache.delete(this.buildKey(key));
  }

  /**
   * 清除当前命名空间下的所有缓存
   */
  clearNamespace(): number {
    if (!this.prefix) {
      globalCache.clear();
      return 0;
    }
    return globalCache.deleteByPrefix(`${this.prefix}:`);
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    return globalCache.has(this.buildKey(key));
  }

  /**
   * 获取或设置缓存（常用模式）
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * 获取统计信息
   */
  static getStats(): CacheStats {
    return globalCache.getStats();
  }

  /**
   * 清空所有缓存
   */
  static clearAll(): void {
    globalCache.clear();
  }
}

// ============================================
// 预定义缓存服务实例
// ============================================

/**
 * 用户权限缓存服务（TTL: 5分钟）
 */
export const userPermissionCache = new CacheService('user:perm', 300);

/**
 * 用户菜单缓存服务（TTL: 5分钟）
 */
export const userMenuCache = new CacheService('user:menu', 300);

/**
 * 用户角色缓存服务（TTL: 5分钟）
 */
export const userRoleCache = new CacheService('user:role', 300);

/**
 * 项目信息缓存服务（TTL: 2分钟）
 */
export const projectCache = new CacheService('project', 120);

/**
 * 知识库搜索缓存服务（TTL: 1分钟）
 */
export const knowledgeCache = new CacheService('knowledge', 60);

/**
 * 模板缓存服务（TTL: 5分钟）
 */
export const templateCache = new CacheService('template', 300);

/**
 * 统计数据缓存服务（TTL: 10分钟）
 */
export const statsCache = new CacheService('stats', 600);

/**
 * 部门信息缓存服务（TTL: 10分钟）
 */
export const departmentCache = new CacheService('department', 600);

// ============================================
// 缓存失效辅助函数
// ============================================

/**
 * 清除用户相关所有缓存
 */
export function invalidateUserCache(userId: number): void {
  userPermissionCache.delete(String(userId));
  userMenuCache.delete(String(userId));
  userRoleCache.delete(String(userId));
}

/**
 * 清除项目相关缓存
 */
export function invalidateProjectCache(projectId: number): void {
  projectCache.delete(String(projectId));
  // 清除项目列表缓存
  statsCache.clearNamespace();
}

/**
 * 清除知识库相关缓存
 */
export function invalidateKnowledgeCache(): void {
  knowledgeCache.clearNamespace();
}

/**
 * 清除模板相关缓存
 */
export function invalidateTemplateCache(): void {
  templateCache.clearNamespace();
}

/**
 * 清除部门相关缓存
 */
export function invalidateDepartmentCache(): void {
  departmentCache.clearNamespace();
}

// ============================================
// 导出
// ============================================

export { globalCache };

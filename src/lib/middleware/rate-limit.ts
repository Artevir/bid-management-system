/**
 * 接口限流中间件
 * 使用滑动窗口算法实现API限流
 */

import { NextRequest, NextResponse } from 'next/server';

// 限流配置
interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  keyGenerator?: (request: NextRequest) => string; // 自定义key生成器
  skip?: (request: NextRequest) => boolean; // 跳过限流的条件
}

// 请求记录
interface RequestLog {
  count: number;
  resetTime: number;
}

// 内存存储（生产环境应使用Redis）
const requestStore = new Map<string, RequestLog>();

// 清理过期记录（每分钟执行一次）
setInterval(() => {
  const now = Date.now();
  for (const [key, log] of requestStore.entries()) {
    if (now > log.resetTime) {
      requestStore.delete(key);
    }
  }
}, 60000);

/**
 * 创建限流中间件
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs = 60000, // 默认1分钟
    maxRequests = 100, // 默认100次/分钟
    keyGenerator,
    skip,
  } = config;

  return async function rateLimit(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    // 检查是否跳过限流
    if (skip?.(request)) {
      return handler(request);
    }

    // 生成限流key
    const key = keyGenerator
      ? keyGenerator(request)
      : getDefaultKey(request);

    // 检查限流
    const result = checkRateLimit(key, windowMs, maxRequests);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 执行处理函数
    const response = await handler(request);

    // 添加限流头信息
    response.headers.set('X-RateLimit-Limit', maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

    return response;
  };
}

/**
 * 检查限流
 */
function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const resetTime = now + windowMs;

  let log = requestStore.get(key);

  if (!log || now > log.resetTime) {
    // 创建新窗口
    log = { count: 0, resetTime };
    requestStore.set(key, log);
  }

  log.count++;
  const remaining = Math.max(0, maxRequests - log.count);
  const allowed = log.count <= maxRequests;

  return { allowed, remaining, resetTime };
}

/**
 * 默认key生成器（基于IP和路径）
 */
function getDefaultKey(request: NextRequest): string {
  const ip = getClientIp(request);
  const path = request.nextUrl.pathname;
  return `${ip}:${path}`;
}

/**
 * 获取客户端IP
 */
export function getClientIp(request: NextRequest): string {
  // 尝试从各种header中获取真实IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Cloudflare
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  return 'unknown';
}

// ============================================
// 预定义限流器
// ============================================

/**
 * 默认限流器：100次/分钟
 */
export const defaultRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 100,
});

/**
 * 严格限流器：20次/分钟（用于敏感操作）
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
});

/**
 * 登录限流器：10次/分钟（防暴力破解）
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  keyGenerator: (request) => {
    const ip = getClientIp(request);
    return `login:${ip}`;
  },
});

/**
 * AI接口限流器：30次/分钟（控制AI调用成本）
 */
export const aiRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 30,
  keyGenerator: (request) => {
    const ip = getClientIp(request);
    const path = request.nextUrl.pathname;
    return `ai:${ip}:${path}`;
  },
});

/**
 * 文件上传限流器：10次/分钟
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  keyGenerator: (request) => {
    const ip = getClientIp(request);
    return `upload:${ip}`;
  },
});

// ============================================
// 类型导出
// ============================================

export type RateLimiter = ReturnType<typeof createRateLimiter>;

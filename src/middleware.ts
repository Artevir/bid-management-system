/**
 * Next.js 中间件
 * 用于基础安全头、CORS、速率限制
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const env = typeof process !== 'undefined' ? process.env : undefined;
const cozeProjectDomainDefaultRaw = env?.COZE_PROJECT_DOMAIN_DEFAULT;
const nodeEnv = env?.NODE_ENV;
const PUBLIC_PAGE_PATHS = new Set(['/login']);

function normalizeEnvUrlLike(value?: string) {
  const v = value?.trim().replace(/^[`'"]+|[`'"]+$/g, '');
  return v ? v.replace(/\/+$/, '') : undefined;
}

function toAllowedOrigins(value?: string) {
  const v = normalizeEnvUrlLike(value);
  if (!v) return [];
  if (v.startsWith('http://') || v.startsWith('https://')) return [v];
  return [`http://${v}`, `https://${v}`];
}

// ============================================
// 速率限制
// ============================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 100;
const RATE_LIMIT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_KEYS = 10000;

let lastRateLimitSweepAt = 0;

function cleanupRateLimitMap(now: number) {
  if (now - lastRateLimitSweepAt < RATE_LIMIT_SWEEP_INTERVAL_MS) return;

  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }

  if (rateLimitMap.size > RATE_LIMIT_MAX_KEYS) {
    const entries = [...rateLimitMap.entries()].sort((a, b) => a[1].resetTime - b[1].resetTime);
    const toDeleteCount = rateLimitMap.size - RATE_LIMIT_MAX_KEYS;
    for (let i = 0; i < toDeleteCount; i++) {
      rateLimitMap.delete(entries[i][0]);
    }
  }

  lastRateLimitSweepAt = now;
}

function checkRateLimit(request: NextRequest): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const now = Date.now();
  cleanupRateLimitMap(now);

  let userRequests = rateLimitMap.get(ip);

  if (!userRequests || userRequests.resetTime < now) {
    userRequests = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, userRequests);
    return true;
  }

  if (userRequests.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userRequests.count++;
  return true;
}

// ============================================
// 主中间件函数
// ============================================

export function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith('/api/');

    // 页面路由登录守卫：未登录访问业务页面时跳转到登录页
    if (!isApiRoute) {
      const accessToken = request.cookies.get('accessToken')?.value;
      const isPublicPage = PUBLIC_PAGE_PATHS.has(pathname);

      if (!accessToken && !isPublicPage) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        const nextPath = `${pathname}${request.nextUrl.search || ''}`;
        loginUrl.searchParams.set('next', nextPath);
        return NextResponse.redirect(loginUrl);
      }

      if (accessToken && pathname === '/login') {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = '/';
        homeUrl.search = '';
        return NextResponse.redirect(homeUrl);
      }
    }

    // OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      const origin = request.headers.get('origin');

      if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }

      return response;
    }

    // API 路由做限流
    if (isApiRoute) {
      if (!checkRateLimit(request)) {
        return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Date.now() + 60000).toString(),
          },
        });
      }
    }

    const response = NextResponse.next();

    // CORS
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      ...toAllowedOrigins(cozeProjectDomainDefaultRaw),
      'http://localhost:3000',
      'http://localhost:5000',
    ].filter(Boolean) as string[];

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // 安全头
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    if (nodeEnv === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    );

    return response;
  } catch (error) {
    console.error('middleware error', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

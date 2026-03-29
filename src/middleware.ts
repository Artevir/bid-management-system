/**
 * Next.js 中间件
 * 用于基础安全头、CORS、速率限制
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const env = typeof process !== 'undefined' ? process.env : undefined;
const cozeProjectDomainDefault = env?.COZE_PROJECT_DOMAIN_DEFAULT;
const nodeEnv = env?.NODE_ENV;

// ============================================
// 速率限制
// ============================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(request: NextRequest): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const now = Date.now();
  const windowMs = 60 * 1000; // 1分钟
  const maxRequests = 100;

  let userRequests = rateLimitMap.get(ip);

  if (!userRequests || userRequests.resetTime < now) {
    userRequests = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(ip, userRequests);
    return true;
  }

  if (userRequests.count >= maxRequests) {
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
    if (pathname.startsWith('/api/')) {
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
      cozeProjectDomainDefault,
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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

/**
 * Next.js 中间件
 * 用于性能监控、路由保护、CORS 等功能
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';

// ============================================
// 路由配置
// ============================================

const protectedRoutes = ['/dashboard', '/projects', '/documents'];
const publicRoutes = ['/login', '/register', '/api/auth'];
const apiRoutes = ['/api/'];

// ============================================
// 性能监控中间件
// ============================================

function withPerformanceMonitoring(request: NextRequest) {
  const startTime = Date.now();
  const url = new URL(request.url);
  
  // 记录请求开始
  console.log(`[${request.method}] ${url.pathname} - Started at ${startTime}`);

  return {
    recordEnd: () => {
      const duration = Date.now() - startTime;
      const statusCode = 200; // 这里需要从响应中获取实际状态码
      
      // 记录性能指标
      performanceMonitor.recordMetric({
        name: 'http_request_duration',
        type: 'histogram',
        value: duration,
        labels: {
          method: request.method,
          path: url.pathname,
          status: statusCode.toString(),
        },
      });

      // 记录慢请求
      if (duration > 3000) {
        console.warn(`[Slow Request] ${request.method} ${url.pathname} - ${duration}ms`);
      }
    },
  };
}

// ============================================
// CORS 配置
// ============================================

function handleCORS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    process.env.COZE_PROJECT_DOMAIN_DEFAULT,
    'http://localhost:3000',
    'http://localhost:5000',
  ];

  if (origin && allowedOrigins.includes(origin)) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
  }

  return NextResponse.next();
}

// ============================================
// 安全头配置
// ============================================

function addSecurityHeaders(response: NextResponse) {
  // 防止点击劫持
  response.headers.set('X-Frame-Options', 'DENY');
  
  // 防止 MIME 类型嗅探
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS 保护
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // 严格传输安全（仅 HTTPS）
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // 内容安全策略
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  );

  return response;
}

// ============================================
// 速率限制
// ============================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(request: NextRequest): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
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
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. 性能监控
  const perfMonitor = withPerformanceMonitoring(request);

  // 2. CORS 处理
  const corsResponse = handleCORS(request);
  if (corsResponse !== NextResponse.next()) {
    return corsResponse;
  }

  // 3. OPTIONS 请求（预检）
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    return handleCORS(request);
  }

  // 4. 速率限制（仅 API 路由）
  if (pathname.startsWith('/api/')) {
    if (!checkRateLimit(request)) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Date.now() + 60000).toString(),
          },
        }
      );
    }
  }

  // 5. 继续处理请求
  const response = NextResponse.next();

  // 6. 添加安全头
  addSecurityHeaders(response);

  // 7. 记录性能
  perfMonitor.recordEnd();

  return response;
}

// ============================================
// 中间件配置
// ============================================

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (favicon 文件)
     * - public 文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

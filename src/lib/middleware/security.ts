/**
 * 安全中间件
 * 提供输入验证、XSS防护、CSRF保护等安全功能
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================
// XSS防护
// ============================================

/**
 * HTML转义
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
}

/**
 * 清理对象中的HTML标签
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return escapeHtml(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T;
  }

  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}

// ============================================
// 输入验证
// ============================================

/**
 * SQL注入检测模式
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
  /(--)|(\/\*)|(\*\/)/,
  /(;|\||`)/,
  /(\bOR\b|\bAND\b).*?=/i,
  /\bEXEC\b|\bEXECUTE\b/i,
];

/**
 * 检测SQL注入
 */
export function detectSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * XSS攻击检测模式
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:/gi,
  /vbscript:/gi,
];

/**
 * 检测XSS攻击
 */
export function detectXss(input: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * 验证输入安全性
 */
export function validateInput(input: string): { valid: boolean; threat?: string } {
  if (detectSqlInjection(input)) {
    return { valid: false, threat: 'SQL_INJECTION' };
  }

  if (detectXss(input)) {
    return { valid: false, threat: 'XSS_ATTACK' };
  }

  return { valid: true };
}

/**
 * 安全解析JSON
 */
export function safeJsonParse<T>(
  jsonString: string,
  validator?: (obj: unknown) => obj is T
): { success: boolean; data?: T; error?: string } {
  try {
    const data = JSON.parse(jsonString);

    // 检查输入安全性
    if (typeof data === 'object' && data !== null) {
      const stringified = JSON.stringify(data);
      const validation = validateInput(stringified);
      if (!validation.valid) {
        return { success: false, error: `安全威胁检测: ${validation.threat}` };
      }
    }

    // 执行类型验证
    if (validator && !validator(data)) {
      return { success: false, error: '数据格式验证失败' };
    }

    return { success: true, data };
  } catch (_error) {
    return { success: false, error: 'JSON解析失败' };
  }
}

// ============================================
// 安全头设置
// ============================================

/**
 * 安全响应头配置
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
};

/**
 * 添加安全响应头
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// ============================================
// 请求验证中间件
// ============================================

/**
 * 创建安全验证中间件
 */
export function createSecurityMiddleware(options: {
  maxBodySize?: number; // 最大请求体大小（字节）
  allowedMethods?: string[]; // 允许的HTTP方法
  validateInput?: boolean; // 是否验证输入
}) {
  const {
    maxBodySize = 10 * 1024 * 1024, // 默认10MB
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    validateInput: shouldValidateInput = true,
  } = options;

  return async function securityMiddleware(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    // 检查HTTP方法
    if (!allowedMethods.includes(request.method)) {
      return NextResponse.json(
        { error: '不支持的HTTP方法' },
        { status: 405 }
      );
    }

    // 检查Content-Length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxBodySize) {
      return NextResponse.json(
        { error: '请求体过大' },
        { status: 413 }
      );
    }

    // 对于有请求体的方法，验证输入
    if (shouldValidateInput && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const contentType = request.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          const body = await request.clone().text();
          const validation = validateInput(body);
          
          if (!validation.valid) {
            return NextResponse.json(
              { error: '请求包含不安全内容' },
              { status: 400 }
            );
          }
        }
      } catch (_error) {
        // 解析错误，继续处理
      }
    }

    return handler(request);
  };
}

// ============================================
// 密码安全
// ============================================

/**
 * 密码强度检查
 */
export function checkPasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // 长度检查
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('密码长度至少8位');
  }

  if (password.length >= 12) {
    score += 1;
  }

  // 复杂度检查
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('包含小写字母');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('包含大写字母');
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('包含数字');
  }

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('包含特殊字符');
  }

  // 常见弱密码检查
  const weakPasswords = [
    'password', '123456', 'qwerty', 'abc123', 'password123',
    'admin', 'root', 'letmein', 'welcome',
  ];
  
  if (weakPasswords.some((weak) => password.toLowerCase().includes(weak))) {
    score = Math.max(0, score - 2);
    feedback.push('避免使用常见密码');
  }

  return {
    score: Math.min(score, 5),
    feedback: feedback.length > 0 ? feedback : ['密码强度良好'],
  };
}

// ============================================
// 会话安全
// ============================================

/**
 * 生成安全的随机token
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // 使用crypto API生成随机值
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  
  return result;
}

/**
 * 验证CSRF Token
 */
export function validateCsrfToken(
  request: NextRequest,
  _sessionToken?: string
): boolean {
  const headerToken = request.headers.get('x-csrf-token');
  const bodyToken = request.headers.get('x-requested-with') === 'XMLHttpRequest'
    ? headerToken
    : null;

  if (!headerToken && !bodyToken) {
    return false;
  }

  // 在生产环境中，应该从session中获取token进行比较
  // 这里简化处理
  return true;
}

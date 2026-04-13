/**
 * JWT服务
 * 使用jose库进行JWT令牌的生成和验证
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { sessions, users } from '@/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import crypto from 'crypto';
import { AppError } from '@/lib/api/error-handler';

// JWT配置
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 访问令牌有效期
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d'; // 刷新令牌有效期

// 将时间字符串转换为秒数
function parseTime(timeString: string): number {
  const unit = timeString.slice(-1);
  const value = parseInt(timeString.slice(0, -1));

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return value;
  }
}

let cachedSecretKey: Uint8Array | null = null;
let hasWarnedDevFallback = false;

function getSecretKey(): Uint8Array {
  if (cachedSecretKey) {
    return cachedSecretKey;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production environment');
    }

    if (!hasWarnedDevFallback) {
      console.warn('[auth] JWT_SECRET is not set, using local development fallback secret.');
      hasWarnedDevFallback = true;
    }
  }

  cachedSecretKey = new TextEncoder().encode(jwtSecret || 'dev-only-insecure-jwt-secret');
  return cachedSecretKey;
}

// JWT Payload接口
export interface JwtCustomPayload extends JWTPayload {
  userId: number;
  username: string;
  email: string;
  roleId?: number;
  departmentId: number;
}

// Token响应接口
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 生成访问令牌（Access Token）
 * @param payload JWT载荷
 * @returns 访问令牌
 */
export async function generateAccessToken(payload: JwtCustomPayload): Promise<string> {
  const secretKey = getSecretKey();
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('bid-management-system')
    .setAudience('bid-management-users')
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(secretKey);

  return token;
}

/**
 * 生成刷新令牌（Refresh Token）
 * @param payload JWT载荷
 * @returns 刷新令牌
 */
export async function generateRefreshToken(payload: JwtCustomPayload): Promise<string> {
  const secretKey = getSecretKey();
  const token = await new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('bid-management-system')
    .setAudience('bid-management-users')
    .setExpirationTime(JWT_REFRESH_EXPIRES_IN)
    .sign(secretKey);

  return token;
}

/**
 * 验证访问令牌
 * @param token 访问令牌
 * @returns 解码后的载荷
 */
export async function verifyAccessToken(token: string): Promise<JwtCustomPayload> {
  const secretKey = getSecretKey();
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: 'bid-management-system',
      audience: 'bid-management-users',
    });

    return payload as JwtCustomPayload;
  } catch {
    throw AppError.unauthorized('认证失败，无效或过期的访问令牌');
  }
}

/**
 * 验证刷新令牌
 * @param token 刷新令牌
 * @returns 解码后的载荷
 */
export async function verifyRefreshToken(token: string): Promise<JwtCustomPayload> {
  const secretKey = getSecretKey();
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: 'bid-management-system',
      audience: 'bid-management-users',
    });

    if (payload.type !== 'refresh') {
      throw AppError.unauthorized('无效的令牌类型');
    }

    return payload as JwtCustomPayload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unauthorized('认证失败，无效或过期的刷新令牌');
  }
}

/**
 * 生成令牌对（访问令牌 + 刷新令牌）
 * @param user 用户信息
 * @returns 令牌对
 */
export async function generateTokenPair(user: {
  id: number;
  username: string;
  email: string;
  departmentId: number;
  roleId?: number;
}): Promise<TokenResponse> {
  const payload: JwtCustomPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    departmentId: user.departmentId,
    roleId: user.roleId,
  };

  const accessToken = await generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(payload);

  // 计算过期时间（秒）
  const expiresIn = parseTime(JWT_EXPIRES_IN);

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * 创建会话记录
 * @param userId 用户ID
 * @param refreshToken 刷新令牌
 * @param ipAddress IP地址
 * @param userAgent 用户代理
 * @returns 会话ID
 */
export async function createSession(
  userId: number,
  refreshToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<number> {
  // 对刷新令牌进行哈希处理
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // 计算过期时间
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + parseTime(JWT_REFRESH_EXPIRES_IN));

  // 插入会话记录
  const now = new Date();
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
      lastAccessedAt: now,
    })
    .onConflictDoUpdate({
      target: sessions.userId,
      set: {
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
        lastAccessedAt: now,
      },
    })
    .returning();

  return session.id;
}

/**
 * 验证会话
 * @param refreshToken 刷新令牌
 * @returns 用户ID或null
 */
export async function validateSession(refreshToken: string): Promise<number | null> {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())),
  });

  if (!session) {
    return null;
  }

  // 更新最后访问时间
  await db.update(sessions).set({ lastAccessedAt: new Date() }).where(eq(sessions.id, session.id));

  return session.userId;
}

/**
 * 撤销会话（登出）
 * @param refreshToken 刷新令牌
 */
export async function revokeSession(refreshToken: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/**
 * 撤销用户所有会话
 * @param userId 用户ID
 */
export async function revokeAllUserSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * 清理过期会话
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/**
 * 从Cookie中获取访问令牌
 * @returns 访问令牌或null
 */
export async function getAccessTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('accessToken')?.value || null;
}

/**
 * 从Cookie中获取刷新令牌
 * @returns 刷新令牌或null
 */
export async function getRefreshTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('refreshToken')?.value || null;
}

/**
 * 设置令牌Cookie
 * @param accessToken 访问令牌
 * @param refreshToken 刷新令牌
 */
export async function setTokenCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();
  const secure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';

  // 访问令牌Cookie（短期）
  cookieStore.set('accessToken', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: parseTime(JWT_EXPIRES_IN),
    path: '/',
  });

  // 刷新令牌Cookie（长期）
  cookieStore.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: parseTime(JWT_REFRESH_EXPIRES_IN),
    path: '/',
  });
}

/**
 * 清除令牌Cookie
 */
export async function clearTokenCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete('accessToken');
  cookieStore.delete('refreshToken');
}

/**
 * 获取当前用户（从Cookie中解析）
 * @returns 用户信息或null
 */
export async function getCurrentUser(): Promise<JwtCustomPayload | null> {
  const accessToken = await getAccessTokenFromCookie();

  if (!accessToken) {
    return null;
  }

  try {
    const payload = await verifyAccessToken(accessToken);
    return payload;
  } catch {
    return null;
  }
}

/**
 * 刷新访问令牌
 * @param refreshToken 刷新令牌
 * @returns 新的令牌对
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse | null> {
  // 验证刷新令牌
  const payload = await verifyRefreshToken(refreshToken);

  // 验证会话
  const userId = await validateSession(refreshToken);

  if (!userId || userId !== payload.userId) {
    return null;
  }

  // 获取用户最新信息
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  // 生成新的令牌对
  const tokens = await generateTokenPair({
    id: user.id,
    username: user.username,
    email: user.email,
    departmentId: user.departmentId,
  });

  // 撤销旧的刷新令牌
  await revokeSession(refreshToken);

  // 创建新的会话
  await createSession(userId, tokens.refreshToken);

  return tokens;
}

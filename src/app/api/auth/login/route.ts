/**
 * 登录API
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@/lib/auth/password';
import {
  generateTokenPair,
  createSession,
  setTokenCookies,
} from '@/lib/auth/jwt';
import { handleError, AppError } from '@/lib/api/error-handler';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                    request.headers.get('x-real-ip') || 
                    request.ip || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  try {
    const body = await request.json();
    const { username, password } = body;
    
    // 验证输入
    if (!username || !password) {
      throw AppError.badRequest('用户名和密码不能为空');
    }
    
    // 查询用户
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    
    if (!user) {
      // 记录失败日志
      await db.insert(auditLogs).values({
        action: 'login',
        resource: 'user',
        resourceCode: username,
        description: '登录失败：用户不存在',
        ipAddress,
        userAgent,
        requestMethod: 'POST',
        requestPath: '/api/auth/login',
        responseStatus: 401,
        duration: Date.now() - startTime,
      });
      
      throw AppError.unauthorized('用户名或密码错误');
    }
    
    // 检查用户状态
    if (user.status === 'locked') {
      // 检查是否已解锁
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        throw AppError.forbidden('账户已被锁定，请稍后再试');
      } else {
        // 自动解锁
        await db
          .update(users)
          .set({
            status: 'active',
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }
    }
    
    if (user.status === 'inactive') {
      throw AppError.forbidden('账户未激活');
    }
    
    // 验证密码
    const isValid = await verifyPassword(password, user.passwordHash);
    
    if (!isValid) {
      // 记录失败登录次数
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updateData: any = {
        failedLoginAttempts: failedAttempts,
        updatedAt: new Date(),
      };
      
      // 如果失败次数达到5次，锁定账户
      if (failedAttempts >= 5) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30); // 锁定30分钟
        
        updateData.status = 'locked';
        updateData.lockedUntil = lockUntil;
      }
      
      await db.update(users).set(updateData).where(eq(users.id, user.id));
      
      // 记录失败日志
      await db.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        action: 'login',
        resource: 'user',
        resourceId: user.id,
        resourceCode: username,
        description: '登录失败：密码错误',
        ipAddress,
        userAgent,
        requestMethod: 'POST',
        requestPath: '/api/auth/login',
        responseStatus: 401,
        duration: Date.now() - startTime,
      });
      
      throw AppError.unauthorized('用户名或密码错误');
    }
    
    // 获取用户角色（如果有）
    // TODO: 实现用户角色查询
    
    // 生成令牌对
    const tokens = await generateTokenPair({
      id: user.id,
      username: user.username,
      email: user.email,
      departmentId: user.departmentId,
    });
    
    // 创建会话
    await createSession(user.id, tokens.refreshToken, ipAddress, userAgent);
    
    // 更新用户登录信息
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    
    // 设置Cookie
    await setTokenCookies(tokens.accessToken, tokens.refreshToken);
    
    // 记录成功日志
    await db.insert(auditLogs).values({
      userId: user.id,
      username: user.username,
      action: 'login',
      resource: 'user',
      resourceId: user.id,
      resourceCode: username,
      description: '登录成功',
      ipAddress,
      userAgent,
      requestMethod: 'POST',
      requestPath: '/api/auth/login',
      responseStatus: 200,
      duration: Date.now() - startTime,
    });
    
    // 返回用户信息（不包含敏感信息）
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        realName: user.realName,
        avatar: user.avatar,
        departmentId: user.departmentId,
        position: user.position,
      },
      expiresIn: tokens.expiresIn,
    });
    
  } catch (error) {
    return handleError(error, request.url);
  }
}

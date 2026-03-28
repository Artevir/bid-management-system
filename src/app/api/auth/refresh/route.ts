/**
 * 刷新令牌API
 * POST /api/auth/refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getRefreshTokenFromCookie,
  refreshAccessToken,
  setTokenCookies,
} from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    // 从Cookie获取刷新令牌
    const refreshToken = await getRefreshTokenFromCookie();
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: '未找到刷新令牌' },
        { status: 401 }
      );
    }
    
    // 刷新令牌
    const tokens = await refreshAccessToken(refreshToken);
    
    if (!tokens) {
      return NextResponse.json(
        { error: '刷新令牌无效或已过期' },
        { status: 401 }
      );
    }
    
    // 设置新的Cookie
    await setTokenCookies(tokens.accessToken, tokens.refreshToken);
    
    return NextResponse.json({
      success: true,
      expiresIn: tokens.expiresIn,
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    
    return NextResponse.json(
      { error: '刷新令牌失败' },
      { status: 500 }
    );
  }
}

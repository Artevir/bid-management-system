/**
 * 获取用户菜单API
 * GET /api/auth/menus
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getUserMenus } from '@/lib/auth/permission';

export async function GET(request: NextRequest) {
  try {
    // 获取当前用户
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }
    
    // 获取用户菜单
    const menus = await getUserMenus(currentUser.userId);
    
    return NextResponse.json({
      menus,
    });
    
  } catch (error) {
    console.error('Get menus error:', error);
    
    return NextResponse.json(
      { error: '获取菜单失败' },
      { status: 500 }
    );
  }
}

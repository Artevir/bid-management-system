/**
 * 获取当前用户权限API
 * GET /api/auth/permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { 
  getUserRoles, 
  getUserPermissions, 
  getUserMenus,
  getUserPermissionCodes 
} from '@/lib/auth/permission';

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
    
    // 并行获取权限信息
    const [roles, permissions, menus, permissionCodes] = await Promise.all([
      getUserRoles(currentUser.userId),
      getUserPermissions(currentUser.userId),
      getUserMenus(currentUser.userId),
      getUserPermissionCodes(currentUser.userId),
    ]);
    
    return NextResponse.json({
      roles,
      permissions,
      menus,
      permissionCodes: Array.from(permissionCodes),
    });
    
  } catch (error) {
    console.error('Get permissions error:', error);
    
    return NextResponse.json(
      { error: '获取权限信息失败' },
      { status: 500 }
    );
  }
}

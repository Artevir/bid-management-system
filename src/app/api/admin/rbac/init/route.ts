/**
 * RBAC 初始化 API
 * 用于初始化默认角色和权限
 */

import { NextRequest, NextResponse } from 'next/server';
import RBACService from '@/lib/auth/rbac-service';

// ============================================
// GET - 获取系统权限信息
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'info';

    // 获取权限信息
    if (action === 'info') {
      const roles = await RBACService.getAllRoles();
      const permissions = await RBACService.getAllPermissions();

      return NextResponse.json({
        success: true,
        data: {
          roles,
          permissions,
          totalRoles: roles.length,
          totalPermissions: permissions.length,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: '未知的操作',
    }, { status: 400 });
  } catch (error) {
    console.error('[RBAC Init API] 请求失败:', error);
    return NextResponse.json({
      success: false,
      error: '请求失败',
    }, { status: 500 });
  }
}

// ============================================
// POST - 初始化 RBAC 系统
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'initialize') {
      const result = await RBACService.initializeDefaults();
      return NextResponse.json(result);
    }

    return NextResponse.json({
      success: false,
      error: '未知的操作',
    }, { status: 400 });
  } catch (error) {
    console.error('[RBAC Init API] 请求失败:', error);
    return NextResponse.json({
      success: false,
      error: '请求失败',
    }, { status: 500 });
  }
}

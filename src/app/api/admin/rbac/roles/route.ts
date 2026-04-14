/**
 * 角色管理 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { roles, userRoles, rolePermissions } from '@/db/schema/rbac';
import { eq, sql } from 'drizzle-orm';
import RBACService from '@/lib/auth/rbac-service';
import { withPermission, PERMISSIONS } from '@/lib/auth/rbac-middleware';
import { withAdmin } from '@/lib/auth/middleware';

// ============================================
// GET - 获取所有角色
// ============================================

async function getRoles(_request: NextRequest, _userId: number) {
  try {
    const allRoles = await RBACService.getAllRoles();

    // 获取每个角色的用户数量和权限数量
    const rolesWithStats = await Promise.all(
      allRoles.map(async (role) => {
        const userCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(userRoles)
          .where(eq(userRoles.roleId, role.id));

        const permCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, role.id));

        return {
          ...role,
          userCount: Number(userCount[0]?.count || 0),
          permissionCount: Number(permCount[0]?.count || 0),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: rolesWithStats,
    });
  } catch (error) {
    console.error('[Role API] 获取角色列表失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取角色列表失败',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAdmin(request, getRoles);
}

// ============================================
// POST - 创建新角色
// ============================================

export const POST = withPermission(
  PERMISSIONS.ROLE_CREATE,
  async (request: NextRequest, _context?: any, userId?: string) => {
    try {
      const body = await request.json();
      const { name, code, description, level, permissions: permissionIds } = body;

      // 验证必填字段
      if (!name || !code || !level) {
        return NextResponse.json({
          success: false,
          error: '缺少必填字段：name, code, level',
        }, { status: 400 });
      }

      // 检查角色代码是否已存在
      const existing = await db.query.roles.findFirst({
        where: eq(roles.code, code),
      });

      if (existing) {
        return NextResponse.json({
          success: false,
          error: '角色代码已存在',
        }, { status: 400 });
      }

      // 创建角色
      const [newRole] = await db.insert(roles).values({
        name,
        code,
        description,
        level: typeof level === 'number' ? level : 2,
        isSystem: false,
        isActive: true,
      }).returning();

      // 分配权限
      if (permissionIds && permissionIds.length > 0) {
        const grantedBy = userId ? parseInt(userId, 10) : null;
        for (const permId of permissionIds) {
          await db.insert(rolePermissions).values({
            roleId: newRole.id,
            permissionId: permId,
            grantedBy,
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: newRole,
        message: '角色创建成功',
      });
    } catch (error) {
      console.error('[Role API] 创建角色失败:', error);
      return NextResponse.json({
        success: false,
        error: '创建角色失败',
      }, { status: 500 });
    }
  }
);

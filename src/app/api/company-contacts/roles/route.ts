/**
 * 对接人角色API
 * 管理公司对接人角色（预设 + 自定义）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { companyContactRoles, users, type ContactRoleType } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

// 预设角色
const SYSTEM_ROLES: Array<{
  name: string;
  code: string;
  type: ContactRoleType;
  sortOrder: number;
  description: string;
}> = [
  { name: '投标对接人', code: 'bid_contact', type: 'bid_contact', sortOrder: 1, description: '负责投标项目整体对接' },
  { name: '资料准备负责人', code: 'document_prep', type: 'document_prep', sortOrder: 2, description: '负责准备投标所需资料' },
  { name: '买标书负责人', code: 'bid_purchase', type: 'bid_purchase', sortOrder: 3, description: '负责购买招标文件' },
  { name: '盖章负责人', code: 'stamp_person', type: 'stamp_person', sortOrder: 4, description: '负责文件盖章' },
  { name: '投标代理人', code: 'bid_agent', type: 'bid_agent', sortOrder: 5, description: '投标授权代理人' },
  { name: '法定代表人', code: 'legal_person', type: 'legal_person', sortOrder: 6, description: '公司法定代表人' },
  { name: '销售', code: 'sales', type: 'sales', sortOrder: 7, description: '销售相关人员' },
  { name: '财务', code: 'finance', type: 'finance', sortOrder: 8, description: '财务相关人员' },
  { name: '其他', code: 'other', type: 'other', sortOrder: 99, description: '其他角色' },
];

// 初始化系统预设角色
async function initSystemRoles(userId: number) {
  for (const role of SYSTEM_ROLES) {
    const existing = await db
      .select()
      .from(companyContactRoles)
      .where(eq(companyContactRoles.code, role.code))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(companyContactRoles).values({
        ...role,
        isSystem: true,
        createdBy: userId,
      });
    }
  }
}

// GET - 获取所有角色
async function getRoles(userId: number): Promise<NextResponse> {
  try {
    // 先初始化系统角色
    await initSystemRoles(userId);
    
    const roles = await db
      .select()
      .from(companyContactRoles)
      .orderBy(asc(companyContactRoles.sortOrder), asc(companyContactRoles.id));
    
    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error('Failed to get contact roles:', error);
    return NextResponse.json(
      { success: false, error: '获取角色列表失败' },
      { status: 500 }
    );
  }
}

// POST - 创建自定义角色
async function createRole(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    if (!body.name || !body.code) {
      return NextResponse.json(
        { success: false, error: '角色名称和代码为必填项' },
        { status: 400 }
      );
    }
    
    // 检查代码是否已存在
    const existing = await db
      .select()
      .from(companyContactRoles)
      .where(eq(companyContactRoles.code, body.code))
      .limit(1);
    
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '角色代码已存在' },
        { status: 400 }
      );
    }
    
    const [role] = await db
      .insert(companyContactRoles)
      .values({
        name: body.name,
        code: body.code,
        type: (body.type || 'other') as ContactRoleType,
        description: body.description || null,
        sortOrder: body.sortOrder || 50,
        isSystem: false,
        createdBy: userId,
      })
      .returning();
    
    return NextResponse.json({
      success: true,
      data: role,
      message: '角色创建成功',
    });
  } catch (error) {
    console.error('Failed to create contact role:', error);
    return NextResponse.json(
      { success: false, error: '创建角色失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getRoles(userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createRole(req, userId));
}

/**
 * 公司对接人管理API
 * 支持对接人的增删改查
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { checkCompanyPermission } from '@/lib/auth/resource-permission';
import { db } from '@/db';
import { companyContacts, companyContactRoles } from '@/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';

// ============================================
// GET - 获取对接人列表
// ============================================

async function getContacts(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: '请提供公司ID' },
        { status: 400 }
      );
    }
    
    // 权限检查
    const permissionResult = await checkCompanyPermission(
      userId,
      parseInt(companyId),
      'read'
    );
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { success: false, error: permissionResult.reason || '无权访问' },
        { status: 403 }
      );
    }
    
    // 获取对接人列表
    const contacts = await db
      .select()
      .from(companyContacts)
      .where(eq(companyContacts.companyId, parseInt(companyId)))
      .orderBy(desc(companyContacts.isPrimary), asc(companyContacts.id));
    
    // 获取角色列表（用于前端显示）
    const roles = await db
      .select()
      .from(companyContactRoles)
      .orderBy(asc(companyContactRoles.sortOrder));
    
    return NextResponse.json({
      success: true,
      data: contacts,
      roles,
    });
  } catch (error) {
    console.error('Failed to get company contacts:', error);
    return NextResponse.json(
      { success: false, error: '获取对接人列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - 创建对接人
// ============================================

async function createContact(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    if (!body.companyId || !body.name) {
      return NextResponse.json(
        { success: false, error: '公司ID和姓名为必填项' },
        { status: 400 }
      );
    }
    
    // 权限检查
    const permissionResult = await checkCompanyPermission(
      userId,
      body.companyId,
      'edit'
    );
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { success: false, error: permissionResult.reason || '无权编辑' },
        { status: 403 }
      );
    }
    
    // 如果设置为主要对接人，先取消其他主要对接人
    if (body.isPrimary) {
      await db
        .update(companyContacts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(companyContacts.companyId, body.companyId));
    }
    
    const [contact] = await db
      .insert(companyContacts)
      .values({
        companyId: body.companyId,
        name: body.name,
        department: body.department || null,
        position: body.position || null,
        phone: body.phone || null,
        telephone: body.telephone || null,
        wechat: body.wechat || null,
        qq: body.qq || null,
        email: body.email || null,
        roles: body.roles ? JSON.stringify(body.roles) : null,
        remarks: body.remarks || null,
        isPrimary: body.isPrimary || false,
        isActive: body.isActive !== false,
        createdBy: userId,
      })
      .returning();
    
    return NextResponse.json({
      success: true,
      data: contact,
      message: '对接人添加成功',
    });
  } catch (error) {
    console.error('Failed to create company contact:', error);
    return NextResponse.json(
      { success: false, error: '添加对接人失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - 更新对接人
// ============================================

async function updateContact(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: '请提供对接人ID' },
        { status: 400 }
      );
    }
    
    // 获取现有对接人信息
    const [existing] = await db
      .select()
      .from(companyContacts)
      .where(eq(companyContacts.id, body.id))
      .limit(1);
    
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '对接人不存在' },
        { status: 404 }
      );
    }
    
    // 权限检查
    const permissionResult = await checkCompanyPermission(
      userId,
      existing.companyId,
      'edit'
    );
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { success: false, error: permissionResult.reason || '无权编辑' },
        { status: 403 }
      );
    }
    
    // 如果设置为主要对接人，先取消其他主要对接人
    if (body.isPrimary) {
      await db
        .update(companyContacts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(companyContacts.companyId, existing.companyId));
    }
    
    // 更新数据
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    
    const fields = [
      'name', 'department', 'position',
      'phone', 'telephone', 'wechat', 'qq', 'email',
      'remarks', 'isPrimary', 'isActive'
    ];
    
    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    
    if (body.roles !== undefined) {
      updateData.roles = body.roles ? JSON.stringify(body.roles) : null;
    }
    
    const [updated] = await db
      .update(companyContacts)
      .set(updateData)
      .where(eq(companyContacts.id, body.id))
      .returning();
    
    return NextResponse.json({
      success: true,
      data: updated,
      message: '对接人更新成功',
    });
  } catch (error) {
    console.error('Failed to update company contact:', error);
    return NextResponse.json(
      { success: false, error: '更新对接人失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 删除对接人
// ============================================

async function deleteContact(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: '请提供对接人ID' },
        { status: 400 }
      );
    }
    
    // 获取现有对接人信息
    const [existing] = await db
      .select()
      .from(companyContacts)
      .where(eq(companyContacts.id, parseInt(id)))
      .limit(1);
    
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '对接人不存在' },
        { status: 404 }
      );
    }
    
    // 权限检查
    const permissionResult = await checkCompanyPermission(
      userId,
      existing.companyId,
      'edit'
    );
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { success: false, error: permissionResult.reason || '无权删除' },
        { status: 403 }
      );
    }
    
    await db
      .delete(companyContacts)
      .where(eq(companyContacts.id, parseInt(id)));
    
    return NextResponse.json({
      success: true,
      message: '对接人删除成功',
    });
  } catch (error) {
    console.error('Failed to delete company contact:', error);
    return NextResponse.json(
      { success: false, error: '删除对接人失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getContacts(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createContact(req, userId));
}

export async function PUT(request: NextRequest) {
  return withAuth(request, (req, userId) => updateContact(req, userId));
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, (req, userId) => deleteContact(req, userId));
}

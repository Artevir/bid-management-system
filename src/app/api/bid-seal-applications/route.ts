/**
 * 盖章申请API
 * 支持查询、新增、更新、删除盖章申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  createSealApplication,
  getSealApplications,
  getSealApplicationById,
  updateSealApplication,
  deleteSealApplication,
  getSealApplicationStatistics,
  getUsersForSelect,
  getPartnerCompaniesForSelect,
  getCompanyContacts,
  getCompanyAddress,
} from '@/lib/bid-seal/service';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// GET - 查询盖章申请列表
// ============================================

async function getSealApplicationsHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status') || undefined;
    const sealMethod = searchParams.get('sealMethod') || undefined;
    const assigneeId = searchParams.get('assigneeId') ? parseInt(searchParams.get('assigneeId')!) : undefined;
    const partnerCompanyId = searchParams.get('partnerCompanyId') ? parseInt(searchParams.get('partnerCompanyId')!) : undefined;
    const keyword = searchParams.get('keyword') || undefined;
    
    // 特殊路由：获取统计数据
    if (searchParams.get('stats') === 'true') {
      const stats = await getSealApplicationStatistics();
      return NextResponse.json({ success: true, stats });
    }
    
    // 特殊路由：获取用户列表
    if (searchParams.get('users') === 'true') {
      const userList = await getUsersForSelect();
      return NextResponse.json({ success: true, users: userList });
    }
    
    // 特殊路由：获取友司公司列表
    if (searchParams.get('companies') === 'true') {
      const companiesList = await getPartnerCompaniesForSelect();
      return NextResponse.json({ success: true, companies: companiesList });
    }
    
    // 特殊路由：获取公司联系人
    const companyId = searchParams.get('companyId');
    if (companyId && searchParams.get('contacts') === 'true') {
      const contacts = await getCompanyContacts(parseInt(companyId));
      return NextResponse.json({ success: true, contacts });
    }
    
    // 特殊路由：获取公司地址
    if (companyId && searchParams.get('address') === 'true') {
      const address = await getCompanyAddress(parseInt(companyId));
      return NextResponse.json({ success: true, address });
    }
    
    const applications = await getSealApplications({
      status,
      sealMethod,
      assigneeId,
      partnerCompanyId,
      keyword,
    });
    
    // 获取统计
    const stats = await getSealApplicationStatistics();
    
    return NextResponse.json({
      success: true,
      data: applications,
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch bid seal applications:', error);
    return NextResponse.json(
      { success: false, error: '获取盖章申请列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - 新增盖章申请
// ============================================

async function createSealApplicationHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // 验证必填字段
    if (!body.projectName) {
      return NextResponse.json(
        { success: false, error: '项目名称为必填项' },
        { status: 400 }
      );
    }
    
    // 如果有指派人，获取指派人姓名
    let assigneeName = body.assigneeName || null;
    if (body.assigneeId && !assigneeName) {
      const [assignee] = await db
        .select({ name: users.realName })
        .from(users)
        .where(eq(users.id, body.assigneeId))
        .limit(1);
      if (assignee) {
        assigneeName = assignee.name;
      }
    }
    
    // 插入数据
    const application = await createSealApplication({
      projectId: body.projectId || null,
      projectName: body.projectName,
      projectCode: body.projectCode || null,
      sealDeadline: body.sealDeadline ? new Date(body.sealDeadline) : null,
      plannedDate: body.plannedDate ? new Date(body.plannedDate) : null,
      actualDate: body.actualDate ? new Date(body.actualDate) : null,
      sealMethod: body.sealMethod || 'our_company',
      partnerCompanyId: body.partnerCompanyId || null,
      partnerCompanyName: body.partnerCompanyName || null,
      partnerCompanyAddress: body.partnerCompanyAddress || null,
      partnerContactId: body.partnerContactId || null,
      partnerContactName: body.partnerContactName || null,
      partnerContactPhone: body.partnerContactPhone || null,
      sealCount: body.sealCount || 1,
      sealPurpose: body.sealPurpose || null,
      documentType: body.documentType || null,
      specialRequirements: body.specialRequirements || null,
      ourContactId: body.ourContactId || null,
      ourContactName: body.ourContactName || null,
      ourContactPhone: body.ourContactPhone || null,
      assigneeId: body.assigneeId || null,
      assigneeName: assigneeName,
      priority: body.priority || 'medium',
      remarks: body.remarks || null,
      status: body.status || 'pending',
      createdBy: userId,
    });
    
    return NextResponse.json({
      success: true,
      data: application,
      message: '盖章申请创建成功',
    });
  } catch (error) {
    console.error('Failed to create bid seal application:', error);
    return NextResponse.json(
      { success: false, error: '创建盖章申请失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - 更新盖章申请
// ============================================

async function updateSealApplicationHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: '请提供盖章申请ID' },
        { status: 400 }
      );
    }
    
    // 检查是否存在
    const existing = await getSealApplicationById(body.id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '盖章申请不存在' },
        { status: 404 }
      );
    }
    
    // 如果有指派人，获取指派人姓名
    let assigneeName = body.assigneeName;
    if (body.assigneeId !== undefined && !assigneeName) {
      if (body.assigneeId) {
        const [assignee] = await db
          .select({ name: users.realName })
          .from(users)
          .where(eq(users.id, body.assigneeId))
          .limit(1);
        if (assignee) {
          assigneeName = assignee.name;
        }
      } else {
        assigneeName = null;
      }
    }
    
    // 准备更新数据
    const updateData: Record<string, unknown> = {};
    
    const allowedFields = [
      'projectId', 'projectName', 'projectCode', 'sealDeadline', 'plannedDate', 'actualDate',
      'sealMethod',
      'partnerCompanyId', 'partnerCompanyName', 'partnerCompanyAddress',
      'partnerContactId', 'partnerContactName', 'partnerContactPhone',
      'sealCount', 'sealPurpose', 'documentType', 'specialRequirements',
      'ourContactId', 'ourContactName', 'ourContactPhone',
      'assigneeId', 'assigneeName', 'priority',
      'remarks', 'status',
    ];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'sealDeadline' || field === 'plannedDate' || field === 'actualDate') {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else if (field === 'assigneeId') {
          updateData.assigneeId = body.assigneeId || null;
          if (assigneeName !== undefined) {
            updateData.assigneeName = assigneeName;
          }
        } else {
          updateData[field] = body[field];
        }
      }
    }
    
    // 如果状态变为已完成，记录完成时间
    if (body.status === 'completed' && existing.status !== 'completed') {
      updateData.completedAt = new Date();
    }
    
    // 执行更新
    const updated = await updateSealApplication(body.id, updateData);
    
    return NextResponse.json({
      success: true,
      data: updated,
      message: '更新成功',
    });
  } catch (error) {
    console.error('Failed to update bid seal application:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 删除盖章申请
// ============================================

async function deleteSealApplicationHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: '请提供盖章申请ID' },
        { status: 400 }
      );
    }
    
    // 检查是否存在
    const existing = await getSealApplicationById(parseInt(id));
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '盖章申请不存在' },
        { status: 404 }
      );
    }
    
    // 执行删除
    await deleteSealApplication(parseInt(id));
    
    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('Failed to delete bid seal application:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getSealApplicationsHandler(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createSealApplicationHandler(req, userId));
}

export async function PUT(request: NextRequest) {
  return withAuth(request, (req, userId) => updateSealApplicationHandler(req, userId));
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, (req, userId) => deleteSealApplicationHandler(req, userId));
}

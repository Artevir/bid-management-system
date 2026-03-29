/**
 * 打印标书安排API
 * 支持查询、新增、更新、删除打印安排
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  createPrinting,
  getPrintings,
  getPrintingById,
  updatePrinting,
  deletePrinting,
  getPrintingStatistics,
  getUsersForSelect,
  getPartnerCompaniesForSelect,
  getCompanyContacts,
} from '@/lib/bid-printing/service';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// GET - 查询打印标书安排列表
// ============================================

async function getPrintingsHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status') || undefined;
    const printingMethod = searchParams.get('printingMethod') || undefined;
    const assigneeId = searchParams.get('assigneeId') ? parseInt(searchParams.get('assigneeId')!) : undefined;
    const partnerCompanyId = searchParams.get('partnerCompanyId') ? parseInt(searchParams.get('partnerCompanyId')!) : undefined;
    const keyword = searchParams.get('keyword') || undefined;
    
    // 特殊路由：获取统计数据
    if (searchParams.get('stats') === 'true') {
      const stats = await getPrintingStatistics();
      return NextResponse.json({ success: true, stats });
    }
    
    // 特殊路由：获取用户列表
    if (searchParams.get('users') === 'true') {
      const users = await getUsersForSelect();
      return NextResponse.json({ success: true, users });
    }
    
    // 特殊路由：获取友司公司列表
    if (searchParams.get('companies') === 'true') {
      const companies = await getPartnerCompaniesForSelect();
      return NextResponse.json({ success: true, companies });
    }
    
    // 特殊路由：获取公司联系人
    const companyId = searchParams.get('companyId');
    if (companyId && searchParams.get('contacts') === 'true') {
      const contacts = await getCompanyContacts(parseInt(companyId));
      return NextResponse.json({ success: true, contacts });
    }
    
    const printings = await getPrintings({
      status,
      printingMethod,
      assigneeId,
      partnerCompanyId,
      keyword,
    });
    
    // 获取统计
    const stats = await getPrintingStatistics();
    
    return NextResponse.json({
      success: true,
      data: printings,
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch bid printings:', error);
    return NextResponse.json(
      { success: false, error: '获取打印安排列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - 新增打印标书安排
// ============================================

async function createPrintingHandler(
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
    const printing = await createPrinting({
      projectId: body.projectId || null,
      projectName: body.projectName,
      projectCode: body.projectCode || null,
      printingDeadline: body.printingDeadline ? new Date(body.printingDeadline) : null,
      plannedDate: body.plannedDate ? new Date(body.plannedDate) : null,
      actualDate: body.actualDate ? new Date(body.actualDate) : null,
      printingMethod: body.printingMethod || 'our_company',
      partnerCompanyId: body.partnerCompanyId || null,
      partnerCompanyName: body.partnerCompanyName || null,
      partnerContactId: body.partnerContactId || null,
      partnerContactName: body.partnerContactName || null,
      partnerContactPhone: body.partnerContactPhone || null,
      copiesCount: body.copiesCount || 5, // 默认一正四副
      paperSize: body.paperSize || 'A4',
      colorMode: body.colorMode || 'bw',
      bindingMethod: body.bindingMethod || null,
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
      data: printing,
      message: '打印安排创建成功',
    });
  } catch (error) {
    console.error('Failed to create bid printing:', error);
    return NextResponse.json(
      { success: false, error: '创建打印安排失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - 更新打印标书安排
// ============================================

async function updatePrintingHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: '请提供打印安排ID' },
        { status: 400 }
      );
    }
    
    // 检查是否存在
    const existing = await getPrintingById(body.id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '打印安排不存在' },
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
      'projectId', 'projectName', 'projectCode', 'printingDeadline', 'plannedDate', 'actualDate',
      'printingMethod',
      'partnerCompanyId', 'partnerCompanyName', 'partnerContactId', 'partnerContactName', 'partnerContactPhone',
      'copiesCount', 'paperSize', 'colorMode', 'bindingMethod', 'specialRequirements',
      'ourContactId', 'ourContactName', 'ourContactPhone',
      'assigneeId', 'assigneeName', 'priority',
      'remarks', 'status',
    ];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'printingDeadline' || field === 'plannedDate' || field === 'actualDate') {
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
    const updated = await updatePrinting(body.id, updateData);
    
    return NextResponse.json({
      success: true,
      data: updated,
      message: '更新成功',
    });
  } catch (error) {
    console.error('Failed to update bid printing:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 删除打印标书安排
// ============================================

async function deletePrintingHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: '请提供打印安排ID' },
        { status: 400 }
      );
    }
    
    // 检查是否存在
    const existing = await getPrintingById(parseInt(id));
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '打印安排不存在' },
        { status: 404 }
      );
    }
    
    // 执行删除
    await deletePrinting(parseInt(id));
    
    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('Failed to delete bid printing:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getPrintingsHandler(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createPrintingHandler(req, userId));
}

export async function PUT(request: NextRequest) {
  return withAuth(request, (req, userId) => updatePrintingHandler(req, userId));
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, (req, userId) => deletePrintingHandler(req, userId));
}

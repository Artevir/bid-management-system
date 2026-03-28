/**
 * 购买招标文件安排API
 * 支持查询、新增、更新、删除购买安排
 * 支持推送到任务中心
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  bidDocumentPurchases,
  bidDocPurchaseStatusEnum,
  projectTasks,
  users,
} from '@/db/schema';
import { biddingPlatforms } from '@/db/bidding-platform-schema';
import { eq, desc, asc, and, or, like, sql } from 'drizzle-orm';

// ============================================
// GET - 查询购买招标文件安排列表
// ============================================

async function getPurchases(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // 查询参数
    const status = searchParams.get('status') as typeof bidDocPurchaseStatusEnum.enumValues[number] | null;
    const keyword = searchParams.get('keyword');
    const platformId = searchParams.get('platformId');
    const assigneeId = searchParams.get('assigneeId');
    
    // 构建查询条件
    const conditions = [];
    if (status) {
      conditions.push(eq(bidDocumentPurchases.status, status));
    }
    if (platformId) {
      conditions.push(eq(bidDocumentPurchases.platformId, parseInt(platformId)));
    }
    if (assigneeId) {
      conditions.push(eq(bidDocumentPurchases.assigneeId, parseInt(assigneeId)));
    }
    if (keyword) {
      conditions.push(
        or(
          like(bidDocumentPurchases.projectName, `%${keyword}%`),
          like(bidDocumentPurchases.projectCode, `%${keyword}%`),
          like(bidDocumentPurchases.platformName, `%${keyword}%`)
        )
      );
    }
    
    // 执行查询
    const purchases = await db
      .select()
      .from(bidDocumentPurchases)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bidDocumentPurchases.createdAt));
    
    // 统计各状态数量
    const statusStats = await db
      .select({
        status: bidDocumentPurchases.status,
        count: sql<number>`count(*)::int`,
      })
      .from(bidDocumentPurchases)
      .groupBy(bidDocumentPurchases.status);
    
    return NextResponse.json({
      success: true,
      data: purchases,
      stats: statusStats.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Failed to fetch bid document purchases:', error);
    return NextResponse.json(
      { success: false, error: '获取购买安排列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - 新增购买招标文件安排
// ============================================

async function createPurchase(
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
    
    // 如果选择了政采单位，同步其信息
    let platformData = {};
    if (body.platformId) {
      const [platform] = await db
        .select()
        .from(biddingPlatforms)
        .where(eq(biddingPlatforms.id, body.platformId))
        .limit(1);
      
      if (platform) {
        platformData = {
          platformName: platform.name,
          platformAddress: platform.address,
        };
      }
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
    const [purchase] = await db
      .insert(bidDocumentPurchases)
      .values({
        projectId: body.projectId || null,
        projectName: body.projectName,
        projectCode: body.projectCode || null,
        purchaseDeadline: body.purchaseDeadline ? new Date(body.purchaseDeadline) : null,
        plannedDate: body.plannedDate ? new Date(body.plannedDate) : null,
        actualDate: body.actualDate ? new Date(body.actualDate) : null,
        platformId: body.platformId || null,
        platformName: body.platformName || (platformData as any).platformName || null,
        platformAddress: body.platformAddress || (platformData as any).platformAddress || null,
        platformContact: body.platformContact || null,
        platformPhone: body.platformPhone || null,
        ourContactId: body.ourContactId || null,
        ourContactName: body.ourContactName || null,
        ourContactPhone: body.ourContactPhone || null,
        partnerCompanyId: body.partnerCompanyId || null,
        partnerCompanyName: body.partnerCompanyName || null,
        partnerContactId: body.partnerContactId || null,
        partnerContactName: body.partnerContactName || null,
        partnerContactPhone: body.partnerContactPhone || null,
        assigneeId: body.assigneeId || null,
        assigneeName: assigneeName,
        priority: body.priority || 'medium',
        requiredMaterials: body.requiredMaterials ? JSON.stringify(body.requiredMaterials) : null,
        remarks: body.remarks || null,
        status: body.status || 'pending',
        createdBy: userId,
      })
      .returning();
    
    return NextResponse.json({
      success: true,
      data: purchase,
      message: '购买安排创建成功',
    });
  } catch (error) {
    console.error('Failed to create bid document purchase:', error);
    return NextResponse.json(
      { success: false, error: '创建购买安排失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - 更新购买招标文件安排
// ============================================

async function updatePurchase(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: '请提供购买安排ID' },
        { status: 400 }
      );
    }
    
    // 检查是否存在
    const [existing] = await db
      .select()
      .from(bidDocumentPurchases)
      .where(eq(bidDocumentPurchases.id, body.id))
      .limit(1);
    
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '购买安排不存在' },
        { status: 404 }
      );
    }
    
    // 如果选择了政采单位，同步其信息
    let platformData = {};
    if (body.platformId) {
      const [platform] = await db
        .select()
        .from(biddingPlatforms)
        .where(eq(biddingPlatforms.id, body.platformId))
        .limit(1);
      
      if (platform) {
        platformData = {
          platformName: platform.name,
          platformAddress: platform.address,
        };
      }
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
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    
    const allowedFields = [
      'projectId', 'projectName', 'projectCode', 'purchaseDeadline', 'plannedDate', 'actualDate',
      'platformId', 'platformName', 'platformAddress', 'platformContact', 'platformPhone',
      'ourContactId', 'ourContactName', 'ourContactPhone',
      'partnerCompanyId', 'partnerCompanyName', 'partnerContactId', 'partnerContactName', 'partnerContactPhone',
      'assigneeId', 'assigneeName', 'priority',
      'requiredMaterials', 'remarks', 'status',
    ];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'purchaseDeadline' || field === 'plannedDate' || field === 'actualDate') {
          if (body[field]) {
            updateData[field] = new Date(body[field]);
          } else {
            updateData[field] = null;
          }
        } else if (field === 'requiredMaterials' && body[field]) {
          updateData[field] = JSON.stringify(body[field]);
        } else if (field === 'platformId' && body.platformId) {
          // 同步政采单位信息
          updateData.platformId = body.platformId;
          if ((platformData as any).platformName) {
            updateData.platformName = (platformData as any).platformName;
          }
          if ((platformData as any).platformAddress) {
            updateData.platformAddress = (platformData as any).platformAddress;
          }
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
    const [updated] = await db
      .update(bidDocumentPurchases)
      .set(updateData)
      .where(eq(bidDocumentPurchases.id, body.id))
      .returning();
    
    return NextResponse.json({
      success: true,
      data: updated,
      message: '更新成功',
    });
  } catch (error) {
    console.error('Failed to update bid document purchase:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 删除购买招标文件安排
// ============================================

async function deletePurchase(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: '请提供购买安排ID' },
        { status: 400 }
      );
    }
    
    // 检查是否存在
    const [existing] = await db
      .select()
      .from(bidDocumentPurchases)
      .where(eq(bidDocumentPurchases.id, parseInt(id)))
      .limit(1);
    
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '购买安排不存在' },
        { status: 404 }
      );
    }
    
    // 如果已推送到任务中心，同步删除任务
    if (existing.taskId) {
      await db
        .delete(projectTasks)
        .where(eq(projectTasks.id, existing.taskId));
    }
    
    // 执行删除
    await db
      .delete(bidDocumentPurchases)
      .where(eq(bidDocumentPurchases.id, parseInt(id)));
    
    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('Failed to delete bid document purchase:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getPurchases(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createPurchase(req, userId));
}

export async function PUT(request: NextRequest) {
  return withAuth(request, (req, userId) => updatePurchase(req, userId));
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, (req, userId) => deletePurchase(req, userId));
}

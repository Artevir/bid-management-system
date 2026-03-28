/**
 * 价格申请详情API路由
 * GET /api/support/price-applications/[id] - 获取价格申请详情
 * PUT /api/support/price-applications/[id] - 更新价格申请
 * DELETE /api/support/price-applications/[id] - 删除价格申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getPriceApplicationById,
  updatePriceApplication,
  deletePriceApplication,
  submitPriceApplication,
} from '@/lib/price-application/service';

// GET - 获取价格申请详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);

    const application = await getPriceApplicationById(applicationId);
    if (!application) {
      return NextResponse.json({ error: '价格申请不存在' }, { status: 404 });
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error('获取价格申请详情失败:', error);
    return NextResponse.json({ error: '获取价格申请详情失败' }, { status: 500 });
  }
}

// PUT - 更新价格申请
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);
    const body = await req.json();

    // 特殊操作：提交申请
    if (body.action === 'submit') {
      const application = await submitPriceApplication(applicationId);
      return NextResponse.json(application);
    }

    const updateData: any = {};
    
    if (body.applicationDate !== undefined) {
      updateData.applicationDate = body.applicationDate ? new Date(body.applicationDate) : null;
    }
    if (body.handlerId !== undefined) updateData.handlerId = body.handlerId;
    if (body.handlerName !== undefined) updateData.handlerName = body.handlerName;
    if (body.handlerPhone !== undefined) updateData.handlerPhone = body.handlerPhone;
    if (body.projectName !== undefined) updateData.projectName = body.projectName;
    if (body.projectCode !== undefined) updateData.projectCode = body.projectCode;
    if (body.tenderOrganization !== undefined) updateData.tenderOrganization = body.tenderOrganization;
    if (body.submissionDeadline !== undefined) {
      updateData.submissionDeadline = body.submissionDeadline ? new Date(body.submissionDeadline) : null;
    }
    if (body.priceValidFrom !== undefined) {
      updateData.priceValidFrom = body.priceValidFrom ? new Date(body.priceValidFrom) : null;
    }
    if (body.priceValidTo !== undefined) {
      updateData.priceValidTo = body.priceValidTo ? new Date(body.priceValidTo) : null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.trackingStatus !== undefined) updateData.trackingStatus = body.trackingStatus;
    if (body.status !== undefined) updateData.status = body.status;

    const application = await updatePriceApplication(applicationId, updateData);
    return NextResponse.json(application);
  } catch (error) {
    console.error('更新价格申请失败:', error);
    return NextResponse.json({ error: '更新价格申请失败' }, { status: 500 });
  }
}

// DELETE - 删除价格申请
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);

    await deletePriceApplication(applicationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除价格申请失败:', error);
    return NextResponse.json({ error: '删除价格申请失败' }, { status: 500 });
  }
}

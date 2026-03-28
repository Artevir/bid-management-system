/**
 * 授权申请详情API路由
 * GET /api/preparation/authorizations/[id] - 获取授权申请详情
 * PUT /api/preparation/authorizations/[id] - 更新授权申请
 * DELETE /api/preparation/authorizations/[id] - 删除授权申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getApplicationById,
  updateApplication,
  deleteApplication,
  submitApplication,
} from '@/lib/authorization/service';

// GET - 获取授权申请详情
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

    const application = await getApplicationById(applicationId);
    if (!application) {
      return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error('获取授权申请详情失败:', error);
    return NextResponse.json({ error: '获取授权申请详情失败' }, { status: 500 });
  }
}

// PUT - 更新授权申请
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
      const application = await submitApplication(applicationId);
      return NextResponse.json(application);
    }

    const updateData: any = {};
    
    if (body.applicationDate !== undefined) {
      updateData.applicationDate = body.applicationDate ? new Date(body.applicationDate) : null;
    }
    if (body.handlerId !== undefined) updateData.handlerId = body.handlerId;
    if (body.handlerName !== undefined) updateData.handlerName = body.handlerName;
    if (body.handlerPhone !== undefined) updateData.handlerPhone = body.handlerPhone;
    if (body.materialDeadline !== undefined) {
      updateData.materialDeadline = body.materialDeadline ? new Date(body.materialDeadline) : null;
    }
    if (body.electronicMaterialReceivedAt !== undefined) {
      updateData.electronicMaterialReceivedAt = body.electronicMaterialReceivedAt ? new Date(body.electronicMaterialReceivedAt) : null;
    }
    if (body.paperMaterialReceivedAt !== undefined) {
      updateData.paperMaterialReceivedAt = body.paperMaterialReceivedAt ? new Date(body.paperMaterialReceivedAt) : null;
    }
    if (body.allMaterialReceivedAt !== undefined) {
      updateData.allMaterialReceivedAt = body.allMaterialReceivedAt ? new Date(body.allMaterialReceivedAt) : null;
    }
    if (body.supplementaryNotes !== undefined) updateData.supplementaryNotes = body.supplementaryNotes;
    if (body.trackingStatus !== undefined) updateData.trackingStatus = body.trackingStatus;
    if (body.projectName !== undefined) updateData.projectName = body.projectName;
    if (body.projectCode !== undefined) updateData.projectCode = body.projectCode;
    if (body.tenderOrganization !== undefined) updateData.tenderOrganization = body.tenderOrganization;
    if (body.submissionDeadline !== undefined) {
      updateData.submissionDeadline = body.submissionDeadline ? new Date(body.submissionDeadline) : null;
    }
    if (body.projectInfoChangeReason !== undefined) updateData.projectInfoChangeReason = body.projectInfoChangeReason;
    if (body.status !== undefined) updateData.status = body.status;

    const application = await updateApplication(applicationId, updateData);
    return NextResponse.json(application);
  } catch (error) {
    console.error('更新授权申请失败:', error);
    return NextResponse.json({ error: '更新授权申请失败' }, { status: 500 });
  }
}

// DELETE - 删除授权申请
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

    await deleteApplication(applicationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除授权申请失败:', error);
    return NextResponse.json({ error: '删除授权申请失败' }, { status: 500 });
  }
}

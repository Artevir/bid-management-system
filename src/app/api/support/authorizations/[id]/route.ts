/**
 * 授权申请详情API路由
 * GET /api/preparation/authorizations/[id] - 获取授权申请详情
 * PUT /api/preparation/authorizations/[id] - 更新授权申请
 * DELETE /api/preparation/authorizations/[id] - 删除授权申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getApplicationById,
  updateApplication,
  deleteApplication,
  submitApplication,
} from '@/lib/authorization/service';
import { parseIdFromParams } from '@/lib/api/validators';
import { canAccessAuthorizationApplication } from '@/lib/support/application-access';

// GET - 获取授权申请详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const application = await getApplicationById(applicationId);
      if (!application) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      return NextResponse.json(application);
    } catch (error) {
      console.error('获取授权申请详情失败:', error);
      return NextResponse.json({ error: '获取授权申请详情失败' }, { status: 500 });
    }
  });
}

// PUT - 更新授权申请
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
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
        updateData.materialDeadline = body.materialDeadline
          ? new Date(body.materialDeadline)
          : null;
      }
      if (body.electronicMaterialReceivedAt !== undefined) {
        updateData.electronicMaterialReceivedAt = body.electronicMaterialReceivedAt
          ? new Date(body.electronicMaterialReceivedAt)
          : null;
      }
      if (body.paperMaterialReceivedAt !== undefined) {
        updateData.paperMaterialReceivedAt = body.paperMaterialReceivedAt
          ? new Date(body.paperMaterialReceivedAt)
          : null;
      }
      if (body.allMaterialReceivedAt !== undefined) {
        updateData.allMaterialReceivedAt = body.allMaterialReceivedAt
          ? new Date(body.allMaterialReceivedAt)
          : null;
      }
      if (body.supplementaryNotes !== undefined)
        updateData.supplementaryNotes = body.supplementaryNotes;
      if (body.trackingStatus !== undefined) updateData.trackingStatus = body.trackingStatus;
      if (body.projectName !== undefined) updateData.projectName = body.projectName;
      if (body.projectCode !== undefined) updateData.projectCode = body.projectCode;
      if (body.tenderOrganization !== undefined)
        updateData.tenderOrganization = body.tenderOrganization;
      if (body.submissionDeadline !== undefined) {
        updateData.submissionDeadline = body.submissionDeadline
          ? new Date(body.submissionDeadline)
          : null;
      }
      if (body.projectInfoChangeReason !== undefined)
        updateData.projectInfoChangeReason = body.projectInfoChangeReason;
      if (body.status !== undefined) updateData.status = body.status;

      const application = await updateApplication(applicationId, updateData);
      return NextResponse.json(application);
    } catch (error) {
      console.error('更新授权申请失败:', error);
      return NextResponse.json({ error: '更新授权申请失败' }, { status: 500 });
    }
  });
}

// DELETE - 删除授权申请
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权删除该申请' }, { status: 403 });
      }

      await deleteApplication(applicationId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除授权申请失败:', error);
      return NextResponse.json({ error: '删除授权申请失败' }, { status: 500 });
    }
  });
}

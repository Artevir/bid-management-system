/**
 * 样机申请详情API路由
 * GET /api/support/sample-applications/[id] - 获取样机申请详情
 * PUT /api/support/sample-applications/[id] - 更新样机申请
 * DELETE /api/support/sample-applications/[id] - 删除样机申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getSampleApplicationById,
  updateSampleApplication,
  deleteSampleApplication,
  submitSampleApplication,
} from '@/lib/sample-application/service';
import { parseIdFromParams } from '@/lib/api/validators';
import { canAccessSampleApplication } from '@/lib/support/application-access';

// GET - 获取样机申请详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '样机申请');

      const permission = await canAccessSampleApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '样机申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const application = await getSampleApplicationById(applicationId);
      if (!application) {
        return NextResponse.json({ error: '样机申请不存在' }, { status: 404 });
      }

      return NextResponse.json(application);
    } catch (error) {
      console.error('获取样机申请详情失败:', error);
      return NextResponse.json({ error: '获取样机申请详情失败' }, { status: 500 });
    }
  });
}

// PUT - 更新样机申请
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '样机申请');
      const permission = await canAccessSampleApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '样机申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const body = await req.json();

      // 特殊操作：提交申请
      if (body.action === 'submit') {
        const application = await submitSampleApplication(applicationId);
        return NextResponse.json(application);
      }

      const updateData: any = {};

      if (body.applicationDate !== undefined) {
        updateData.applicationDate = body.applicationDate ? new Date(body.applicationDate) : null;
      }
      if (body.handlerId !== undefined) updateData.handlerId = body.handlerId;
      if (body.handlerName !== undefined) updateData.handlerName = body.handlerName;
      if (body.handlerPhone !== undefined) updateData.handlerPhone = body.handlerPhone;
      if (body.sampleDeadline !== undefined) {
        updateData.sampleDeadline = body.sampleDeadline ? new Date(body.sampleDeadline) : null;
      }
      if (body.sampleReceivedAt !== undefined) {
        updateData.sampleReceivedAt = body.sampleReceivedAt
          ? new Date(body.sampleReceivedAt)
          : null;
      }
      if (body.sampleReturnedAt !== undefined) {
        updateData.sampleReturnedAt = body.sampleReturnedAt
          ? new Date(body.sampleReturnedAt)
          : null;
      }
      if (body.projectName !== undefined) updateData.projectName = body.projectName;
      if (body.projectCode !== undefined) updateData.projectCode = body.projectCode;
      if (body.receiveMethod !== undefined) updateData.receiveMethod = body.receiveMethod;
      if (body.receiverName !== undefined) updateData.receiverName = body.receiverName;
      if (body.receiverPhone !== undefined) updateData.receiverPhone = body.receiverPhone;
      if (body.storageLocationType !== undefined)
        updateData.storageLocationType = body.storageLocationType;
      if (body.storageAddress !== undefined) updateData.storageAddress = body.storageAddress;
      if (body.storageRequirements !== undefined)
        updateData.storageRequirements = body.storageRequirements;
      if (body.returnMethod !== undefined) updateData.returnMethod = body.returnMethod;
      if (body.returnContactName !== undefined)
        updateData.returnContactName = body.returnContactName;
      if (body.returnContactPhone !== undefined)
        updateData.returnContactPhone = body.returnContactPhone;
      if (body.supplementaryNotes !== undefined)
        updateData.supplementaryNotes = body.supplementaryNotes;
      if (body.trackingStatus !== undefined) updateData.trackingStatus = body.trackingStatus;
      if (body.status !== undefined) updateData.status = body.status;

      const application = await updateSampleApplication(applicationId, updateData);
      return NextResponse.json(application);
    } catch (error) {
      console.error('更新样机申请失败:', error);
      return NextResponse.json({ error: '更新样机申请失败' }, { status: 500 });
    }
  });
}

// DELETE - 删除样机申请
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '样机申请');
      const permission = await canAccessSampleApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '样机申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权删除该申请' }, { status: 403 });
      }

      await deleteSampleApplication(applicationId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除样机申请失败:', error);
      return NextResponse.json({ error: '删除样机申请失败' }, { status: 500 });
    }
  });
}

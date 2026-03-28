/**
 * 友司支持申请详情API路由
 * GET /api/support/partner-applications/[id] - 获取友司支持申请详情
 * PUT /api/support/partner-applications/[id] - 更新友司支持申请
 * DELETE /api/support/partner-applications/[id] - 删除友司支持申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getPartnerApplicationById,
  updatePartnerApplication,
  deletePartnerApplication,
  submitPartnerApplication,
} from '@/lib/partner-application/service';

// GET - 获取友司支持申请详情
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

    const application = await getPartnerApplicationById(applicationId);
    if (!application) {
      return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error('获取友司支持申请详情失败:', error);
    return NextResponse.json({ error: '获取友司支持申请详情失败' }, { status: 500 });
  }
}

// PUT - 更新友司支持申请
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
      const application = await submitPartnerApplication(applicationId);
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
    if (body.smsReminderEnabled !== undefined) updateData.smsReminderEnabled = body.smsReminderEnabled;
    if (body.trackingStatus !== undefined) updateData.trackingStatus = body.trackingStatus;
    if (body.projectName !== undefined) updateData.projectName = body.projectName;
    if (body.projectCode !== undefined) updateData.projectCode = body.projectCode;
    if (body.tenderOrganization !== undefined) updateData.tenderOrganization = body.tenderOrganization;
    if (body.submissionDeadline !== undefined) {
      updateData.submissionDeadline = body.submissionDeadline ? new Date(body.submissionDeadline) : null;
    }
    if (body.biddingRequirements !== undefined) updateData.biddingRequirements = body.biddingRequirements;
    if (body.partnerCompanyId !== undefined) updateData.partnerCompanyId = body.partnerCompanyId;
    if (body.partnerCompanyName !== undefined) updateData.partnerCompanyName = body.partnerCompanyName;
    if (body.partnerContactPerson !== undefined) updateData.partnerContactPerson = body.partnerContactPerson;
    if (body.partnerContactPhone !== undefined) updateData.partnerContactPhone = body.partnerContactPhone;
    if (body.legalRepName !== undefined) updateData.legalRepName = body.legalRepName;
    if (body.legalRepIdCardProvided !== undefined) updateData.legalRepIdCardProvided = body.legalRepIdCardProvided;
    if (body.legalRepIdCardType !== undefined) updateData.legalRepIdCardType = body.legalRepIdCardType;
    if (body.bidAgentName !== undefined) updateData.bidAgentName = body.bidAgentName;
    if (body.bidAgentIdCardProvided !== undefined) updateData.bidAgentIdCardProvided = body.bidAgentIdCardProvided;
    if (body.bidAgentIdCardType !== undefined) updateData.bidAgentIdCardType = body.bidAgentIdCardType;
    if (body.bidAgentPhone !== undefined) updateData.bidAgentPhone = body.bidAgentPhone;
    if (body.bidAgentWechat !== undefined) updateData.bidAgentWechat = body.bidAgentWechat;
    if (body.partnerLiaisonName !== undefined) updateData.partnerLiaisonName = body.partnerLiaisonName;
    if (body.partnerLiaisonPhone !== undefined) updateData.partnerLiaisonPhone = body.partnerLiaisonPhone;
    if (body.partnerLiaisonWechat !== undefined) updateData.partnerLiaisonWechat = body.partnerLiaisonWechat;
    if (body.partnerConfirmStatus !== undefined) updateData.partnerConfirmStatus = body.partnerConfirmStatus;
    if (body.partnerConfirmedAt !== undefined) {
      updateData.partnerConfirmedAt = body.partnerConfirmedAt ? new Date(body.partnerConfirmedAt) : null;
    }
    if (body.materialReceiverName !== undefined) updateData.materialReceiverName = body.materialReceiverName;
    if (body.materialReceiverPhone !== undefined) updateData.materialReceiverPhone = body.materialReceiverPhone;
    if (body.electronicReceiveAddress !== undefined) updateData.electronicReceiveAddress = body.electronicReceiveAddress;
    if (body.paperReceiveAddress !== undefined) updateData.paperReceiveAddress = body.paperReceiveAddress;
    if (body.materialAcceptanceStatus !== undefined) updateData.materialAcceptanceStatus = body.materialAcceptanceStatus;
    if (body.materialAcceptanceNotes !== undefined) updateData.materialAcceptanceNotes = body.materialAcceptanceNotes;
    if (body.applicationSummary !== undefined) updateData.applicationSummary = body.applicationSummary;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    const application = await updatePartnerApplication(applicationId, updateData);
    return NextResponse.json(application);
  } catch (error) {
    console.error('更新友司支持申请失败:', error);
    return NextResponse.json({ error: '更新友司支持申请失败' }, { status: 500 });
  }
}

// DELETE - 删除友司支持申请
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

    await deletePartnerApplication(applicationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除友司支持申请失败:', error);
    return NextResponse.json({ error: '删除友司支持申请失败' }, { status: 500 });
  }
}

/**
 * 友司支持申请列表API路由
 * GET /api/support/partner-applications - 获取友司支持申请列表
 * POST /api/support/partner-applications - 创建友司支持申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getPartnerApplications,
  createPartnerApplication,
  getPartnerApplicationStatistics,
} from '@/lib/partner-application/service';

// GET - 获取友司支持申请列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    
    // 特殊路由：统计信息
    if (searchParams.get('stats') === 'true') {
      const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
      const stats = await getPartnerApplicationStatistics(projectId);
      return NextResponse.json(stats);
    }

    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const status = searchParams.get('status') || undefined;
    const keyword = searchParams.get('keyword') || undefined;
    const handlerId = searchParams.get('handlerId') ? parseInt(searchParams.get('handlerId')!) : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await getPartnerApplications({
      projectId,
      status,
      keyword,
      handlerId,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取友司支持申请列表失败:', error);
    return NextResponse.json({ error: '获取友司支持申请列表失败' }, { status: 500 });
  }
}

// POST - 创建友司支持申请
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const application = await createPartnerApplication({
      projectId: body.projectId,
      applicationDate: body.applicationDate ? new Date(body.applicationDate) : undefined,
      handlerId: body.handlerId || session.user.id,
      handlerName: body.handlerName || session.user.username,
      handlerPhone: body.handlerPhone,
      materialDeadline: body.materialDeadline ? new Date(body.materialDeadline) : undefined,
      smsReminderEnabled: body.smsReminderEnabled,
      projectName: body.projectName,
      projectCode: body.projectCode,
      tenderOrganization: body.tenderOrganization,
      submissionDeadline: body.submissionDeadline ? new Date(body.submissionDeadline) : undefined,
      interpretationFileId: body.interpretationFileId,
      biddingRequirements: body.biddingRequirements,
      partnerCompanyId: body.partnerCompanyId,
      partnerCompanyName: body.partnerCompanyName,
      partnerContactPerson: body.partnerContactPerson,
      partnerContactPhone: body.partnerContactPhone,
      legalRepName: body.legalRepName,
      legalRepIdCardProvided: body.legalRepIdCardProvided,
      legalRepIdCardType: body.legalRepIdCardType,
      bidAgentName: body.bidAgentName,
      bidAgentIdCardProvided: body.bidAgentIdCardProvided,
      bidAgentIdCardType: body.bidAgentIdCardType,
      bidAgentPhone: body.bidAgentPhone,
      bidAgentWechat: body.bidAgentWechat,
      partnerLiaisonName: body.partnerLiaisonName,
      partnerLiaisonPhone: body.partnerLiaisonPhone,
      partnerLiaisonWechat: body.partnerLiaisonWechat,
      materialReceiverName: body.materialReceiverName,
      materialReceiverPhone: body.materialReceiverPhone,
      electronicReceiveAddress: body.electronicReceiveAddress,
      paperReceiveAddress: body.paperReceiveAddress,
      notes: body.notes,
      createdBy: session.user.id,
      // 额外的材料、费用、待办数据
      materials: body.materials,
      fees: body.fees,
      todos: body.todos,
    });

    return NextResponse.json(application);
  } catch (error) {
    console.error('创建友司支持申请失败:', error);
    return NextResponse.json({ error: '创建友司支持申请失败' }, { status: 500 });
  }
}

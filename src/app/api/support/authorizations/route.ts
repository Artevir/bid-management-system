/**
 * 授权申请列表API路由
 * GET /api/preparation/authorizations - 获取授权申请列表
 * POST /api/preparation/authorizations - 创建授权申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getApplications,
  createApplication,
  getApplicationStatistics,
} from '@/lib/authorization/service';

// GET - 获取授权申请列表
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
      const stats = await getApplicationStatistics(projectId);
      return NextResponse.json(stats);
    }

    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const status = searchParams.get('status') || undefined;
    const keyword = searchParams.get('keyword') || undefined;
    const handlerId = searchParams.get('handlerId') ? parseInt(searchParams.get('handlerId')!) : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await getApplications({
      projectId,
      status,
      keyword,
      handlerId,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取授权申请列表失败:', error);
    return NextResponse.json({ error: '获取授权申请列表失败' }, { status: 500 });
  }
}

// POST - 创建授权申请
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const application = await createApplication({
      projectId: body.projectId,
      applicationDate: body.applicationDate ? new Date(body.applicationDate) : undefined,
      handlerId: body.handlerId || session.user.id,
      handlerName: body.handlerName || session.user.username,
      handlerPhone: body.handlerPhone,
      materialDeadline: body.materialDeadline ? new Date(body.materialDeadline) : undefined,
      supplementaryNotes: body.supplementaryNotes,
      projectName: body.projectName,
      projectCode: body.projectCode,
      tenderOrganization: body.tenderOrganization,
      submissionDeadline: body.submissionDeadline ? new Date(body.submissionDeadline) : undefined,
      interpretationFileId: body.interpretationFileId,
      createdBy: session.user.id,
    });

    return NextResponse.json(application);
  } catch (error) {
    console.error('创建授权申请失败:', error);
    return NextResponse.json({ error: '创建授权申请失败' }, { status: 500 });
  }
}

/**
 * 样机申请列表API路由
 * GET /api/support/sample-applications - 获取样机申请列表
 * POST /api/support/sample-applications - 创建样机申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getSampleApplications,
  createSampleApplication,
  getSampleApplicationStatistics,
} from '@/lib/sample-application/service';

// GET - 获取样机申请列表
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
      const stats = await getSampleApplicationStatistics(projectId);
      return NextResponse.json(stats);
    }

    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const authorizationApplicationId = searchParams.get('authorizationApplicationId') ? parseInt(searchParams.get('authorizationApplicationId')!) : undefined;
    const status = searchParams.get('status') || undefined;
    const keyword = searchParams.get('keyword') || undefined;
    const handlerId = searchParams.get('handlerId') ? parseInt(searchParams.get('handlerId')!) : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await getSampleApplications({
      projectId,
      authorizationApplicationId,
      status,
      keyword,
      handlerId,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取样机申请列表失败:', error);
    return NextResponse.json({ error: '获取样机申请列表失败' }, { status: 500 });
  }
}

// POST - 创建样机申请
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const application = await createSampleApplication({
      authorizationApplicationId: body.authorizationApplicationId,
      projectId: body.projectId,
      applicationDate: body.applicationDate ? new Date(body.applicationDate) : undefined,
      handlerId: body.handlerId || session.user.id,
      handlerName: body.handlerName || session.user.username,
      handlerPhone: body.handlerPhone,
      sampleDeadline: body.sampleDeadline ? new Date(body.sampleDeadline) : undefined,
      projectName: body.projectName,
      projectCode: body.projectCode,
      receiveMethod: body.receiveMethod,
      receiverName: body.receiverName,
      receiverPhone: body.receiverPhone,
      storageLocationType: body.storageLocationType,
      storageAddress: body.storageAddress,
      storageRequirements: body.storageRequirements,
      returnMethod: body.returnMethod,
      returnContactName: body.returnContactName,
      returnContactPhone: body.returnContactPhone,
      supplementaryNotes: body.supplementaryNotes,
      createdBy: session.user.id,
    });

    return NextResponse.json(application);
  } catch (error) {
    console.error('创建样机申请失败:', error);
    return NextResponse.json({ error: '创建样机申请失败' }, { status: 500 });
  }
}

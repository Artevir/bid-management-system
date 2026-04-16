/**
 * 价格申请列表API路由
 * GET /api/support/price-applications - 获取价格申请列表
 * POST /api/support/price-applications - 创建价格申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getPriceApplications,
  createPriceApplication,
  getPriceApplicationStatistics,
} from '@/lib/price-application/service';
import { parseResourceId } from '@/lib/api/validators';
import { hasProjectPermission } from '@/lib/project/member';

// GET - 获取价格申请列表
export async function GET(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const projectIdParam = searchParams.get('projectId');
      const projectId = projectIdParam ? parseResourceId(projectIdParam, '项目') : undefined;
      if (typeof projectId === 'number') {
        const hasAccess = await hasProjectPermission(projectId, userId, 'view');
        if (!hasAccess) {
          return NextResponse.json({ error: '无权访问该项目申请数据' }, { status: 403 });
        }
      }

      if (searchParams.get('stats') === 'true') {
        const stats = await getPriceApplicationStatistics(projectId);
        return NextResponse.json(stats);
      }

      const authorizationApplicationId = searchParams.get('authorizationApplicationId')
        ? parseInt(searchParams.get('authorizationApplicationId')!, 10)
        : undefined;
      const status = searchParams.get('status') || undefined;
      const keyword = searchParams.get('keyword') || undefined;
      const page = parseInt(searchParams.get('page') || '1');
      const pageSize = parseInt(searchParams.get('pageSize') || '20');
      const requestedHandlerId = searchParams.get('handlerId');
      const handlerId = requestedHandlerId ? parseInt(requestedHandlerId, 10) : undefined;
      const scopedHandlerId = typeof projectId === 'number' ? handlerId : userId;

      const result = await getPriceApplications({
        projectId,
        authorizationApplicationId,
        status,
        keyword,
        handlerId: scopedHandlerId,
        page,
        pageSize,
      });

      return NextResponse.json(result);
    } catch (error) {
      console.error('获取价格申请列表失败:', error);
      return NextResponse.json({ error: '获取价格申请列表失败' }, { status: 500 });
    }
  });
}

// POST - 创建价格申请
export async function POST(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const body = await request.json();
      const projectId = parseResourceId(String(body.projectId), '项目');
      const hasAccess = await hasProjectPermission(projectId, userId, 'edit');
      if (!hasAccess) {
        return NextResponse.json({ error: '无权在该项目创建申请' }, { status: 403 });
      }

      const application = await createPriceApplication({
        authorizationApplicationId: body.authorizationApplicationId,
        projectId,
        applicationDate: body.applicationDate ? new Date(body.applicationDate) : undefined,
        handlerId: body.handlerId || userId,
        handlerName: body.handlerName || `用户${userId}`,
        handlerPhone: body.handlerPhone,
        projectName: body.projectName,
        projectCode: body.projectCode,
        tenderOrganization: body.tenderOrganization,
        submissionDeadline: body.submissionDeadline ? new Date(body.submissionDeadline) : undefined,
        priceValidFrom: body.priceValidFrom ? new Date(body.priceValidFrom) : undefined,
        priceValidTo: body.priceValidTo ? new Date(body.priceValidTo) : undefined,
        notes: body.notes,
        createdBy: userId,
      });

      return NextResponse.json(application);
    } catch (error) {
      console.error('创建价格申请失败:', error);
      return NextResponse.json({ error: '创建价格申请失败' }, { status: 500 });
    }
  });
}

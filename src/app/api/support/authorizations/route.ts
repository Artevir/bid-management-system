/**
 * 授权申请列表API路由
 * GET /api/preparation/authorizations - 获取授权申请列表
 * POST /api/preparation/authorizations - 创建授权申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getApplications,
  createApplication,
  getApplicationStatistics,
} from '@/lib/authorization/service';
import { parseResourceId } from '@/lib/api/validators';
import { hasProjectPermission } from '@/lib/project/member';

// GET - 获取授权申请列表
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

      // 特殊路由：统计信息
      if (searchParams.get('stats') === 'true') {
        const stats = await getApplicationStatistics(projectId);
        return NextResponse.json(stats);
      }

      const status = searchParams.get('status') || undefined;
      const keyword = searchParams.get('keyword') || undefined;
      const page = parseInt(searchParams.get('page') || '1');
      const pageSize = parseInt(searchParams.get('pageSize') || '20');
      const requestedHandlerId = searchParams.get('handlerId');
      const handlerId = requestedHandlerId ? parseInt(requestedHandlerId, 10) : undefined;

      // 无项目上下文时强制只看自己，避免横向遍历所有申请
      const scopedHandlerId = typeof projectId === 'number' ? handlerId : userId;

      const result = await getApplications({
        projectId,
        status,
        keyword,
        handlerId: scopedHandlerId,
        page,
        pageSize,
      });

      return NextResponse.json(result);
    } catch (error) {
      console.error('获取授权申请列表失败:', error);
      return NextResponse.json({ error: '获取授权申请列表失败' }, { status: 500 });
    }
  });
}

// POST - 创建授权申请
export async function POST(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const body = await request.json();
      const projectId = parseResourceId(String(body.projectId), '项目');
      const hasAccess = await hasProjectPermission(projectId, userId, 'edit');
      if (!hasAccess) {
        return NextResponse.json({ error: '无权在该项目创建申请' }, { status: 403 });
      }

      const application = await createApplication({
        projectId,
        applicationDate: body.applicationDate ? new Date(body.applicationDate) : undefined,
        handlerId: body.handlerId || userId,
        handlerName: body.handlerName || `用户${userId}`,
        handlerPhone: body.handlerPhone,
        materialDeadline: body.materialDeadline ? new Date(body.materialDeadline) : undefined,
        supplementaryNotes: body.supplementaryNotes,
        projectName: body.projectName,
        projectCode: body.projectCode,
        tenderOrganization: body.tenderOrganization,
        submissionDeadline: body.submissionDeadline ? new Date(body.submissionDeadline) : undefined,
        interpretationFileId: body.interpretationFileId,
        createdBy: userId,
      });

      return NextResponse.json(application);
    } catch (error) {
      console.error('创建授权申请失败:', error);
      return NextResponse.json({ error: '创建授权申请失败' }, { status: 500 });
    }
  });
}

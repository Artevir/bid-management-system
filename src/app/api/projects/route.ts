/**
 * 项目管理API
 * GET: 获取项目列表
 * POST: 创建项目
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withPermission } from '@/lib/auth/middleware';
import {
  getProjectList,
  getProjectStats,
  createProject,
  CreateProjectData,
} from '@/lib/project/service';
import { ProjectStatus } from '@/types/project';
import {
  AppError,
  success,
  created,
  paginated,
} from '@/lib/api/error-handler';
import {
  parseResourceId,
  parseIdFromParams,
  parsePaginationParams,
} from '@/lib/api/validators';

// ============================================
// GET: 获取项目列表
// ============================================

async function getList(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams(request.url);

  const params = {
    page,
    pageSize,
    keyword: searchParams.get('keyword') || undefined,
    status: searchParams.get('status')?.split(',').filter(Boolean) as ProjectStatus[] | undefined,
    industry: searchParams.get('industry')?.split(',').filter(Boolean) || undefined,
    region: searchParams.get('region')?.split(',').filter(Boolean) || undefined,
    departmentId: searchParams.get('departmentId') ? parseInt(searchParams.get('departmentId')!) : undefined,
    ownerId: searchParams.get('ownerId') ? parseInt(searchParams.get('ownerId')!) : undefined,
    tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
  };

  // 判断是获取统计还是列表
  if (searchParams.get('stats') === 'true') {
    const stats = await getProjectStats(userId);
    return success(stats);
  }

  const { items, total } = await getProjectList(params, userId);

  return paginated(items, total, params.page, params.pageSize);
}

// ============================================
// POST: 创建项目
// ============================================

async function create(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();

  // 验证必填字段
  if (!body.name || !body.name.trim()) {
    throw AppError.badRequest('项目名称不能为空');
  }

  if (!body.code || !body.code.trim()) {
    throw AppError.badRequest('项目编码不能为空');
  }

  if (!body.ownerId) {
    throw AppError.badRequest('请指定项目负责人');
  }

  if (!body.departmentId) {
    throw AppError.badRequest('请指定所属部门');
  }

  // 处理日期字段并构建数据对象
  const data: CreateProjectData = {
    name: body.name,
    code: body.code,
    tenderCode: body.tenderCode,
    type: body.type,
    industry: body.industry,
    region: body.region,
    tenderOrganization: body.tenderOrganization,
    tenderAgent: body.tenderAgent,
    tenderMethod: body.tenderMethod,
    budget: body.budget,
    publishDate: body.publishDate ? new Date(body.publishDate) : undefined,
    registerDeadline: body.registerDeadline ? new Date(body.registerDeadline) : undefined,
    questionDeadline: body.questionDeadline ? new Date(body.questionDeadline) : undefined,
    submissionDeadline: body.submissionDeadline ? new Date(body.submissionDeadline) : undefined,
    openBidDate: body.openBidDate ? new Date(body.openBidDate) : undefined,
    ownerId: body.ownerId,
    departmentId: body.departmentId,
    description: body.description,
    tags: body.tags,
  };

  const projectId = await createProject(data, userId);

  return created({ projectId }, '项目创建成功');
}

// ============================================
// 导出路由处理器
// ============================================

export async function GET(request: NextRequest) {
  return withAuth(request, getList);
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'project:create', create);
}

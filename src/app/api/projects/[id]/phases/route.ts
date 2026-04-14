/**
 * 项目阶段API
 * GET: 获取项目阶段列表
 * POST: 创建项目阶段
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withPermission } from '@/lib/auth/middleware';
import { db } from '@/db';
import { projectPhases, projectMilestones } from '@/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { AppError, created, success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

// 获取项目阶段列表
async function getPhases(
  _request: NextRequest,
  _userId: number,
  projectId: number
): Promise<NextResponse> {
  // 获取阶段列表
  const phases = await db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, projectId))
    .orderBy(asc(projectPhases.sortOrder));

  // 获取所有阶段的节点
  const phaseIds = phases.map((p) => p.id);
  let milestones: any[] = [];

  if (phaseIds.length > 0) {
    milestones = await db
      .select()
      .from(projectMilestones)
      .where(inArray(projectMilestones.phaseId, phaseIds))
      .orderBy(asc(projectMilestones.dueDate));
  }

  // 组装数据
  const result = phases.map((phase) => ({
    ...phase,
    milestones: milestones.filter((m) => m.phaseId === phase.id),
  }));

  return success({
    projectId,
    phases: result,
    total: phases.length,
  });
}

// 创建项目阶段
async function createPhase(
  request: NextRequest,
  _userId: number,
  projectId: number
): Promise<NextResponse> {
  const body = await request.json();

  if (!body.name || !body.type) {
    throw AppError.badRequest('阶段名称和类型不能为空');
  }

  const result = await db
    .insert(projectPhases)
    .values({
      projectId,
      type: body.type,
      name: body.name,
      description: body.description,
      sortOrder: body.sortOrder || 0,
      status: 'pending',
    })
    .returning({ id: projectPhases.id });

  return created({ phaseId: result[0].id }, '阶段创建成功');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withAuth(request, (req, userId) => getPhases(req, userId, projectId));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withPermission(request, 'project:update', (req, userId) =>
    createPhase(req, userId, projectId)
  );
}

/**
 * 项目节点API
 * GET: 获取项目节点列表
 * POST: 创建项目节点
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withPermission } from '@/lib/auth/middleware';
import { db } from '@/db';
import { projectMilestones } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { AppError, created, success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

// 获取项目节点列表
async function getMilestones(
  _request: NextRequest,
  _userId: number,
  projectId: number
): Promise<NextResponse> {
  const milestones = await db
    .select()
    .from(projectMilestones)
    .where(eq(projectMilestones.projectId, projectId))
    .orderBy(asc(projectMilestones.dueDate));

  return success({
    projectId,
    milestones,
    total: milestones.length,
  });
}

// 创建项目节点
async function createMilestone(
  request: NextRequest,
  _userId: number,
  projectId: number
): Promise<NextResponse> {
  const body = await request.json();

  if (!body.name || !body.dueDate) {
    throw AppError.badRequest('节点名称和截止日期不能为空');
  }

  const result = await db
    .insert(projectMilestones)
    .values({
      projectId,
      phaseId: body.phaseId || null,
      name: body.name,
      description: body.description,
      dueDate: new Date(body.dueDate),
      status: 'pending',
      reminderDays: body.reminderDays || 3,
      sortOrder: body.sortOrder || 0,
    })
    .returning({ id: projectMilestones.id });

  return created({ milestoneId: result[0].id }, '节点创建成功');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withAuth(request, (req, userId) => getMilestones(req, userId, projectId));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withPermission(request, 'project:update', (req, userId) =>
    createMilestone(req, userId, projectId)
  );
}

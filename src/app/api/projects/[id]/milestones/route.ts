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

// 获取项目节点列表
async function getMilestones(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
    const milestones = await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId))
      .orderBy(asc(projectMilestones.dueDate));

    return NextResponse.json({
      milestones,
      total: milestones.length,
    });
  } catch (error) {
    console.error('Get project milestones error:', error);
    return NextResponse.json({ error: '获取项目节点失败' }, { status: 500 });
  }
}

// 创建项目节点
async function createMilestone(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();

    if (!body.name || !body.dueDate) {
      return NextResponse.json({ error: '节点名称和截止日期不能为空' }, { status: 400 });
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

    return NextResponse.json(
      {
        success: true,
        message: '节点创建成功',
        milestoneId: result[0].id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create project milestone error:', error);
    return NextResponse.json({ error: '创建项目节点失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getMilestones(req, userId, parseInt(id)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withPermission(request, 'project:update', (req, userId) =>
    createMilestone(req, userId, parseInt(id))
  );
}

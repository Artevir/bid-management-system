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

// 获取项目阶段列表
async function getPhases(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
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

    return NextResponse.json({
      phases: result,
      total: phases.length,
    });
  } catch (error) {
    console.error('Get project phases error:', error);
    return NextResponse.json({ error: '获取项目阶段失败' }, { status: 500 });
  }
}

// 创建项目阶段
async function createPhase(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();

    if (!body.name || !body.type) {
      return NextResponse.json({ error: '阶段名称和类型不能为空' }, { status: 400 });
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

    return NextResponse.json(
      {
        success: true,
        message: '阶段创建成功',
        phaseId: result[0].id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create project phase error:', error);
    return NextResponse.json({ error: '创建项目阶段失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getPhases(req, userId, parseInt(id)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withPermission(request, 'project:update', (req, userId) =>
    createPhase(req, userId, parseInt(id))
  );
}

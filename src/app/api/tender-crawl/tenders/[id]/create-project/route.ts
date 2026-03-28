/**
 * 招标信息转项目API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/db';
import { projects, tenderInfos, users, departments } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/tender-crawl/tenders/[id]/create-project - 招标信息转项目
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const tenderId = parseInt(id);

    if (isNaN(tenderId)) {
      return NextResponse.json({ error: '无效的招标信息ID' }, { status: 400 });
    }

    // 获取招标信息
    const [tenderInfo] = await db
      .select()
      .from(tenderInfos)
      .where(eq(tenderInfos.id, tenderId))
      .limit(1);

    if (!tenderInfo) {
      return NextResponse.json({ error: '招标信息不存在' }, { status: 404 });
    }

    // 检查是否已转换为项目
    if (tenderInfo.projectId) {
      const [existingProject] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, tenderInfo.projectId))
        .limit(1);

      if (existingProject) {
        return NextResponse.json({
          project: existingProject,
          message: '该招标信息已转换为项目',
        });
      }
    }

    // 获取用户信息和部门
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: '用户信息不存在' }, { status: 400 });
    }

    const body = await req.json();

    // 生成项目编号
    const projectCode = `PRJ-${Date.now()}`;

    // 创建项目
    const [project] = await db
      .insert(projects)
      .values({
        name: body.name || tenderInfo.title || '未命名项目',
        code: projectCode,
        tenderCode: tenderInfo.tenderCode,
        tenderOrganization: tenderInfo.tenderOrganization,
        tenderAgent: tenderInfo.tenderAgent,
        budget: tenderInfo.budget,
        region: tenderInfo.region,
        industry: tenderInfo.industry,
        
        // 时间节点
        registerDeadline: tenderInfo.registerEndDate,
        questionDeadline: tenderInfo.questionDeadline,
        submissionDeadline: tenderInfo.submissionDeadline,
        openBidDate: tenderInfo.openBidDate,
        publishDate: tenderInfo.publishDate,
        
        // 项目状态
        status: 'draft',
        
        // 项目负责人和部门
        ownerId: session.user.id,
        departmentId: currentUser.departmentId,
        
        // 描述
        description: tenderInfo.summary,
        
        // 标签
        tags: body.tags ? JSON.stringify(body.tags) : null,
        
        // 进度
        progress: 0,
      })
      .returning();

    // 更新招标信息的项目关联
    await db
      .update(tenderInfos)
      .set({
        projectId: project.id,
        status: 'following',
        followedBy: session.user.id,
        followedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenderInfos.id, tenderId));

    return NextResponse.json({
      project,
      message: '项目创建成功',
    });
  } catch (error) {
    console.error('创建项目失败:', error);
    return NextResponse.json({ error: '创建项目失败' }, { status: 500 });
  }
}

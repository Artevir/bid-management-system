/**
 * 项目标签关联API
 * GET: 获取项目的标签列表
 * POST: 为项目添加标签
 * DELETE: 移除项目的标签
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projectTags, projectTagRelations, projects } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/tags - 获取项目的标签列表
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const projectId = parseInt(id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: '无效的项目ID' }, { status: 400 });
    }

    // 检查项目是否存在
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // 获取项目的标签
    const tagRelations = await db
      .select({
        id: projectTags.id,
        name: projectTags.name,
        color: projectTags.color,
        description: projectTags.description,
        addedAt: projectTagRelations.addedAt,
      })
      .from(projectTagRelations)
      .innerJoin(projectTags, eq(projectTagRelations.tagId, projectTags.id))
      .where(eq(projectTagRelations.projectId, projectId));

    return NextResponse.json({ tags: tagRelations });
  } catch (error) {
    console.error('获取项目标签失败:', error);
    return NextResponse.json(
      { error: '获取项目标签失败' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/tags - 为项目添加标签
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const projectId = parseInt(id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: '无效的项目ID' }, { status: 400 });
    }

    // 检查项目是否存在
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const body = await request.json();
    const { tagIds } = body;

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json(
        { error: '请选择要添加的标签' },
        { status: 400 }
      );
    }

    // 获取已存在的标签关联
    const existingRelations = await db
      .select()
      .from(projectTagRelations)
      .where(
        and(
          eq(projectTagRelations.projectId, projectId),
          inArray(projectTagRelations.tagId, tagIds)
        )
      );

    const existingTagIds = new Set(existingRelations.map(r => r.tagId));

    // 过滤出需要新添加的标签
    const newTagIds = tagIds.filter((tagId: number) => !existingTagIds.has(tagId));

    if (newTagIds.length === 0) {
      return NextResponse.json({ 
        message: '所有标签已存在',
        addedCount: 0 
      });
    }

    // 批量添加标签关联
    const values = newTagIds.map((tagId: number) => ({
      projectId,
      tagId,
      addedBy: user.userId,
    }));

    await db.insert(projectTagRelations).values(values);

    return NextResponse.json({ 
      success: true,
      addedCount: newTagIds.length 
    });
  } catch (error) {
    console.error('添加项目标签失败:', error);
    return NextResponse.json(
      { error: '添加项目标签失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/tags - 移除项目的标签
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const projectId = parseInt(id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: '无效的项目ID' }, { status: 400 });
    }

    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json(
        { error: '请指定要移除的标签' },
        { status: 400 }
      );
    }

    // 删除标签关联
    await db
      .delete(projectTagRelations)
      .where(
        and(
          eq(projectTagRelations.projectId, projectId),
          eq(projectTagRelations.tagId, tagId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('移除项目标签失败:', error);
    return NextResponse.json(
      { error: '移除项目标签失败' },
      { status: 500 }
    );
  }
}

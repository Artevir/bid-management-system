/**
 * 单个项目标签API
 * GET: 获取标签详情
 * PUT: 更新标签
 * DELETE: 删除标签
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projectTags, projectTagRelations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/project-tags/[id] - 获取标签详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return NextResponse.json({ error: '无效的标签ID' }, { status: 400 });
    }

    const [tag] = await db
      .select()
      .from(projectTags)
      .where(eq(projectTags.id, tagId))
      .limit(1);

    if (!tag) {
      return NextResponse.json({ error: '标签不存在' }, { status: 404 });
    }

    return NextResponse.json({ tag });
  } catch (error) {
    console.error('获取标签详情失败:', error);
    return NextResponse.json(
      { error: '获取标签详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/project-tags/[id] - 更新标签
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return NextResponse.json({ error: '无效的标签ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, color, description, sortOrder } = body;

    // 检查标签是否存在
    const [existing] = await db
      .select()
      .from(projectTags)
      .where(eq(projectTags.id, tagId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: '标签不存在' }, { status: 404 });
    }

    // 如果修改了名称，检查新名称是否已被使用
    if (name && name.trim() !== existing.name) {
      const [duplicate] = await db
        .select()
        .from(projectTags)
        .where(eq(projectTags.name, name.trim()))
        .limit(1);

      if (duplicate) {
        return NextResponse.json(
          { error: '标签名称已存在' },
          { status: 400 }
        );
      }
    }

    // 更新标签
    const [updatedTag] = await db
      .update(projectTags)
      .set({
        name: name?.trim() || existing.name,
        color: color || existing.color,
        description: description !== undefined ? description?.trim() || null : existing.description,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(projectTags.id, tagId))
      .returning();

    return NextResponse.json({ tag: updatedTag });
  } catch (error) {
    console.error('更新标签失败:', error);
    return NextResponse.json(
      { error: '更新标签失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/project-tags/[id] - 删除标签
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return NextResponse.json({ error: '无效的标签ID' }, { status: 400 });
    }

    // 检查标签是否存在
    const [existing] = await db
      .select()
      .from(projectTags)
      .where(eq(projectTags.id, tagId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: '标签不存在' }, { status: 404 });
    }

    // 删除标签关联关系
    await db
      .delete(projectTagRelations)
      .where(eq(projectTagRelations.tagId, tagId));

    // 删除标签
    await db.delete(projectTags).where(eq(projectTags.id, tagId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除标签失败:', error);
    return NextResponse.json(
      { error: '删除标签失败' },
      { status: 500 }
    );
  }
}

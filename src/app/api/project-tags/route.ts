/**
 * 项目标签管理API
 * GET: 获取所有标签
 * POST: 创建新标签
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projectTags } from '@/db/schema';
import { eq, like, asc, count as _count, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// GET /api/project-tags - 获取标签列表
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword');

    // 构建查询条件
    const conditions = [];
    if (keyword) {
      conditions.push(like(projectTags.name, `%${keyword}%`));
    }

    // 查询标签列表
    let tagsQuery = db
      .select({
        id: projectTags.id,
        name: projectTags.name,
        color: projectTags.color,
        description: projectTags.description,
        sortOrder: projectTags.sortOrder,
        createdAt: projectTags.createdAt,
        // 使用子查询统计使用次数
        usageCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM project_tag_relations 
          WHERE tag_id = ${projectTags.id}
        )`.as('usageCount'),
      })
      .from(projectTags);

    if (conditions.length > 0) {
      tagsQuery = tagsQuery.where(conditions[0]) as typeof tagsQuery;
    }

    const tags = await tagsQuery.orderBy(asc(projectTags.sortOrder), asc(projectTags.name));

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('获取项目标签失败:', error);
    return NextResponse.json(
      { error: '获取项目标签失败' },
      { status: 500 }
    );
  }
}

// POST /api/project-tags - 创建新标签
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { name, color, description } = body;

    // 验证必填字段
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: '标签名称不能为空' },
        { status: 400 }
      );
    }

    // 检查标签名是否已存在
    const existing = await db
      .select()
      .from(projectTags)
      .where(eq(projectTags.name, name.trim()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: '标签名称已存在' },
        { status: 400 }
      );
    }

    // 创建标签
    const [tag] = await db
      .insert(projectTags)
      .values({
        name: name.trim(),
        color: color || '#6366f1',
        description: description?.trim() || null,
        createdBy: user.userId,
      })
      .returning();

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    console.error('创建项目标签失败:', error);
    return NextResponse.json(
      { error: '创建项目标签失败' },
      { status: 500 }
    );
  }
}

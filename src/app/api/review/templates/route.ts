/**
 * 审核意见模板API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { db } from '@/db';
import { reviewCommentTemplates } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const configType = searchParams.get('configType') || 'interpretation';
    const category = searchParams.get('category');

    const conditions = [eq(reviewCommentTemplates.configType, configType)];
    if (category) {
      conditions.push(eq(reviewCommentTemplates.category, category));
    }

    const templates = await db
      .select()
      .from(reviewCommentTemplates)
      .where(and(...conditions))
      .orderBy(desc(reviewCommentTemplates.createdAt));

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('获取模板失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { name, content, category, configType = 'interpretation' } = body;

    if (!name || !content || !category) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const [template] = await db
      .insert(reviewCommentTemplates)
      .values({
        name,
        content,
        category,
        configType,
        createdBy: user.userId,
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('创建模板失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少模板ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, content, category, isActive } = body;

    await db
      .update(reviewCommentTemplates)
      .set({
        ...(name && { name }),
        ...(content && { content }),
        ...(category && { category }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(reviewCommentTemplates.id, parseInt(id)));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('更新模板失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少模板ID' }, { status: 400 });
    }

    await db
      .delete(reviewCommentTemplates)
      .where(eq(reviewCommentTemplates.id, parseInt(id)));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('删除模板失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}

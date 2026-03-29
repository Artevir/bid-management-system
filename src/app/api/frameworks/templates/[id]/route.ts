/**
 * 单个模板管理API
 * 支持模板的查询、更新、删除操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { chapterTemplates } from '@/db/schema';
import { eq, asc as _asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取单个模板详情
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [template] = await db
      .select()
      .from(chapterTemplates)
      .where(eq(chapterTemplates.id, parseInt(id)));

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 解析JSON字段
    let placeholders = null;
    let childrenConfig = null;

    if (template.placeholders) {
      try {
        placeholders = JSON.parse(template.placeholders);
      } catch (_e) {
        // 忽略解析错误
      }
    }

    if (template.childrenConfig) {
      try {
        childrenConfig = JSON.parse(template.childrenConfig);
      } catch (_e) {
        // 忽略解析错误
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...template,
        placeholders,
        childrenConfig,
      },
    });
  } catch (error) {
    console.error('获取模板详情失败:', error);
    return NextResponse.json({ error: '获取模板详情失败' }, { status: 500 });
  }
}

// ============================================
// PUT: 更新模板
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // 检查模板是否存在
    const [existing] = await db
      .select()
      .from(chapterTemplates)
      .where(eq(chapterTemplates.id, parseInt(id)));

    if (!existing) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 准备更新数据
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    const fields = [
      'name',
      'code',
      'description',
      'level',
      'contentType',
      'required',
      'contentTemplate',
      'hasChildren',
      'isActive',
      'sortOrder',
    ];

    fields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // 处理JSON字段
    if (body.placeholders !== undefined) {
      updateData.placeholders = body.placeholders
        ? JSON.stringify(body.placeholders)
        : null;
    }

    if (body.childrenConfig !== undefined) {
      updateData.childrenConfig = body.childrenConfig
        ? JSON.stringify(body.childrenConfig)
        : null;
    }

    const [updated] = await db
      .update(chapterTemplates)
      .set(updateData)
      .where(eq(chapterTemplates.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      success: true,
      message: '模板更新成功',
      data: updated,
    });
  } catch (error) {
    console.error('更新模板失败:', error);
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 });
  }
}

// ============================================
// DELETE: 删除模板
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;

    // 检查模板是否存在
    const [existing] = await db
      .select()
      .from(chapterTemplates)
      .where(eq(chapterTemplates.id, parseInt(id)));

    if (!existing) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    await db
      .delete(chapterTemplates)
      .where(eq(chapterTemplates.id, parseInt(id)));

    return NextResponse.json({
      success: true,
      message: '模板删除成功',
    });
  } catch (error) {
    console.error('删除模板失败:', error);
    return NextResponse.json({ error: '删除模板失败' }, { status: 500 });
  }
}

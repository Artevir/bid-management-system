/**
 * 文档框架章节管理API
 * 支持章节的增删改查、批量操作、树形结构
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { docFrameworkChapters, docFrameworks } from '@/db/schema';
import { eq, and, asc, desc as _desc, inArray, isNull, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取章节列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const frameworkId = searchParams.get('frameworkId');
    const tree = searchParams.get('tree') === 'true';
    const parentId = searchParams.get('parentId');

    if (!frameworkId) {
      return NextResponse.json(
        { error: '缺少框架ID' },
        { status: 400 }
      );
    }

    const conditions = [eq(docFrameworkChapters.frameworkId, parseInt(frameworkId))];
    
    if (parentId !== null && parentId !== 'all') {
      if (parentId === 'null' || parentId === '') {
        conditions.push(isNull(docFrameworkChapters.parentId));
      } else {
        conditions.push(eq(docFrameworkChapters.parentId, parseInt(parentId)));
      }
    }

    // 获取章节列表
    const chapters = await db
      .select()
      .from(docFrameworkChapters)
      .where(and(...conditions))
      .orderBy(asc(docFrameworkChapters.sequence), asc(docFrameworkChapters.level));

    if (tree) {
      // 构建树形结构
      const buildTree = (items: any[], parentId: number | null = null): any[] => {
        return items
          .filter(item => item.parentId === parentId)
          .map(item => ({
            ...item,
            children: buildTree(items, item.id),
          }));
      };
      
      return NextResponse.json({ items: buildTree(chapters) });
    }

    return NextResponse.json({ items: chapters });
  } catch (error) {
    console.error('获取章节列表失败:', error);
    return NextResponse.json(
      { error: '获取章节列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建章节
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      frameworkId,
      title,
      level = 1,
      sequence = 0,
      parentId,
      chapterCode,
      contentType = 'text',
      required = false,
      wordCountMin,
      wordCountMax,
      contentTemplate,
      styleConfig,
      isPlaceholder = false,
      placeholderHint,
    } = body;

    if (!frameworkId || !title) {
      return NextResponse.json(
        { error: '缺少必填字段：frameworkId, title' },
        { status: 400 }
      );
    }

    // 检查框架是否存在
    const [framework] = await db
      .select()
      .from(docFrameworks)
      .where(eq(docFrameworks.id, frameworkId));

    if (!framework) {
      return NextResponse.json(
        { error: '框架不存在' },
        { status: 404 }
      );
    }

    // 如果没有指定sequence，自动计算
    let finalSequence = sequence;
    if (sequence === 0) {
      const maxSeq = await db
        .select({ max: sql<number>`coalesce(max(sequence), 0)` })
        .from(docFrameworkChapters)
        .where(eq(docFrameworkChapters.frameworkId, frameworkId));
      const maxVal = maxSeq[0]?.max;
      finalSequence = (typeof maxVal === 'number' ? maxVal : 0) + 1;
    }

    const insertedChapters = await db
      .insert(docFrameworkChapters)
      .values({
        frameworkId,
        title,
        level,
        sequence: finalSequence,
        parentId: parentId || null,
        chapterCode: chapterCode || null,
        contentType,
        required,
        wordCountMin: wordCountMin || null,
        wordCountMax: wordCountMax || null,
        contentTemplate: contentTemplate || null,
        styleConfig: styleConfig ? JSON.stringify(styleConfig) : '{}',
        isPlaceholder,
        placeholderHint: placeholderHint || null,
      })
      .returning();

    const chapter = insertedChapters[0];

    return NextResponse.json({ item: chapter });
  } catch (error) {
    console.error('创建章节失败:', error);
    return NextResponse.json(
      { error: '创建章节失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新章节
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      id,
      title,
      level,
      sequence,
      parentId,
      chapterCode,
      contentType,
      required,
      wordCountMin,
      wordCountMax,
      contentTemplate,
      styleConfig,
      isPlaceholder,
      placeholderHint,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少章节ID' },
        { status: 400 }
      );
    }

    // 检查章节是否存在
    const [existing] = await db
      .select()
      .from(docFrameworkChapters)
      .where(eq(docFrameworkChapters.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: '章节不存在' },
        { status: 404 }
      );
    }

    // 不能将自己设为父级
    if (parentId === id) {
      return NextResponse.json(
        { error: '不能将章节设为自己的子级' },
        { status: 400 }
      );
    }

    // 更新章节
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updateData.title = title;
    if (level !== undefined) updateData.level = level;
    if (sequence !== undefined) updateData.sequence = sequence;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (chapterCode !== undefined) updateData.chapterCode = chapterCode;
    if (contentType !== undefined) updateData.contentType = contentType;
    if (required !== undefined) updateData.required = required;
    if (wordCountMin !== undefined) updateData.wordCountMin = wordCountMin;
    if (wordCountMax !== undefined) updateData.wordCountMax = wordCountMax;
    if (contentTemplate !== undefined) updateData.contentTemplate = contentTemplate;
    if (styleConfig !== undefined) updateData.styleConfig = JSON.stringify(styleConfig);
    if (isPlaceholder !== undefined) updateData.isPlaceholder = isPlaceholder;
    if (placeholderHint !== undefined) updateData.placeholderHint = placeholderHint;

    const [updated] = await db
      .update(docFrameworkChapters)
      .set(updateData)
      .where(eq(docFrameworkChapters.id, id))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('更新章节失败:', error);
    return NextResponse.json(
      { error: '更新章节失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除章节
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const ids = searchParams.get('ids');

    if (!id && !ids) {
      return NextResponse.json(
        { error: '缺少章节ID' },
        { status: 400 }
      );
    }

    // 批量删除
    if (ids) {
      const chapterIds = ids.split(',').map(Number).filter(Boolean);
      
      if (chapterIds.length === 0) {
        return NextResponse.json(
          { error: '无效的章节ID' },
          { status: 400 }
        );
      }

      // 删除章节（级联删除子章节和内容）
      await db
        .delete(docFrameworkChapters)
        .where(inArray(docFrameworkChapters.id, chapterIds));

      return NextResponse.json({ success: true, count: chapterIds.length });
    }

    const chapterId = parseInt(id!);

    // 检查章节是否存在
    const [chapter] = await db
      .select()
      .from(docFrameworkChapters)
      .where(eq(docFrameworkChapters.id, chapterId));

    if (!chapter) {
      return NextResponse.json(
        { error: '章节不存在' },
        { status: 404 }
      );
    }

    // 删除章节（级联删除子章节）
    await db
      .delete(docFrameworkChapters)
      .where(eq(docFrameworkChapters.id, chapterId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除章节失败:', error);
    return NextResponse.json(
      { error: '删除章节失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH: 批量操作
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { operation, data } = body;

    switch (operation) {
      case 'batch-create':
        return await batchCreateChapters(data);
      case 'batch-update-sequence':
        return await batchUpdateSequence(data);
      case 'reorder':
        return await reorderChapters(data);
      default:
        return NextResponse.json(
          { error: '无效的操作类型' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('批量操作失败:', error);
    return NextResponse.json(
      { error: '批量操作失败' },
      { status: 500 }
    );
  }
}

// 批量创建章节
async function batchCreateChapters(data: { frameworkId: number; chapters: any[] }) {
  if (!data.frameworkId || !data.chapters || !Array.isArray(data.chapters)) {
    return NextResponse.json(
      { error: '无效的数据' },
      { status: 400 }
    );
  }

  const created = await db
    .insert(docFrameworkChapters)
    .values(
      data.chapters.map((ch, index) => ({
        frameworkId: data.frameworkId,
        title: ch.title,
        level: ch.level || 1,
        sequence: ch.sequence || index,
        parentId: ch.parentId || null,
        chapterCode: ch.chapterCode || null,
        contentType: ch.contentType || 'text',
        required: ch.required || false,
        wordCountMin: ch.wordCountMin || null,
        wordCountMax: ch.wordCountMax || null,
        contentTemplate: ch.contentTemplate || null,
        styleConfig: ch.styleConfig ? JSON.stringify(ch.styleConfig) : '{}',
        isPlaceholder: ch.isPlaceholder || false,
        placeholderHint: ch.placeholderHint || null,
      }))
    )
    .returning() as any;

  return NextResponse.json({ success: true, count: created.length, items: created });
}

// 批量更新排序
async function batchUpdateSequence(data: { chapters: { id: number; sequence: number }[] }) {
  if (!data.chapters || !Array.isArray(data.chapters)) {
    return NextResponse.json(
      { error: '无效的数据' },
      { status: 400 }
    );
  }

  for (const item of data.chapters) {
    await db
      .update(docFrameworkChapters)
      .set({ sequence: item.sequence, updatedAt: new Date() })
      .where(eq(docFrameworkChapters.id, item.id));
  }

  return NextResponse.json({ success: true, count: data.chapters.length });
}

// 重新排序章节
async function reorderChapters(data: { frameworkId: number; order: number[] }) {
  if (!data.frameworkId || !data.order || !Array.isArray(data.order)) {
    return NextResponse.json(
      { error: '无效的数据' },
      { status: 400 }
    );
  }

  for (let i = 0; i < data.order.length; i++) {
    await db
      .update(docFrameworkChapters)
      .set({ sequence: i, updatedAt: new Date() })
      .where(eq(docFrameworkChapters.id, data.order[i]));
  }

  return NextResponse.json({ success: true });
}

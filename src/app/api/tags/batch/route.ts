/**
 * 标签批量操作API
 * 支持批量创建、更新、删除、关联
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { unifiedTags, entityTags, tagCategories as _tagCategories } from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// POST: 批量操作
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { operation, data } = body;

    switch (operation) {
      case 'batch-create':
        return await batchCreate(data, currentUser.userId);
      case 'batch-update':
        return await batchUpdate(data);
      case 'batch-delete':
        return await batchDelete(data);
      case 'batch-associate':
        return await batchAssociate(data);
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

// ============================================
// 批量创建标签
// ============================================

async function batchCreate(tags: any[], userId: number) {
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json(
      { error: '无效的标签数据' },
      { status: 400 }
    );
  }

  // 验证必填字段
  for (const tag of tags) {
    if (!tag.name) {
      return NextResponse.json(
        { error: '标签名称不能为空' },
        { status: 400 }
      );
    }
  }

  // 检查code唯一性
  const codes = tags.filter(t => t.code).map(t => t.code);
  if (codes.length > 0) {
    const existing = await db
      .select()
      .from(unifiedTags)
      .where(inArray(unifiedTags.code, codes));

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `标签代码 ${existing.map(t => t.code).join(', ')} 已存在` },
        { status: 400 }
      );
    }
  }

  // 批量插入
  const created = await db
    .insert(unifiedTags)
    .values(
      tags.map(tag => ({
        name: tag.name,
        code: tag.code || `tag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        slug: tag.slug || null,
        categoryId: tag.categoryId || null,
        parentId: tag.parentId || null,
        type: tag.type || 'tag',
        color: tag.color || '#6366f1',
        icon: tag.icon || null,
        description: tag.description || null,
        entityTypes: tag.entityTypes ? JSON.stringify(tag.entityTypes) : null,
        sortOrder: tag.sortOrder || 0,
        createdBy: userId,
      }))
    )
    .returning();

  return NextResponse.json({ 
    success: true, 
    count: created.length,
    items: created,
  });
}

// ============================================
// 批量更新标签
// ============================================

async function batchUpdate(updates: any[]) {
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json(
      { error: '无效的更新数据' },
      { status: 400 }
    );
  }

  const results = [];

  for (const update of updates) {
    if (!update.id) {
      continue;
    }

    // 检查标签是否存在
    const [existing] = await db
      .select()
      .from(unifiedTags)
      .where(eq(unifiedTags.id, update.id));

    if (!existing) {
      continue;
    }

    // 系统标签不可修改
    if (existing.isSystem) {
      continue;
    }

    const [updated] = await db
      .update(unifiedTags)
      .set({
        name: update.name || existing.name,
        color: update.color || existing.color,
        categoryId: update.categoryId !== undefined ? update.categoryId : existing.categoryId,
        sortOrder: update.sortOrder !== undefined ? update.sortOrder : existing.sortOrder,
        isActive: update.isActive !== undefined ? update.isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(unifiedTags.id, update.id))
      .returning();

    results.push(updated);
  }

  return NextResponse.json({ 
    success: true, 
    count: results.length,
    items: results,
  });
}

// ============================================
// 批量删除标签
// ============================================

async function batchDelete(ids: number[]) {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: '无效的标签ID' },
      { status: 400 }
    );
  }

  // 检查是否包含系统标签
  const systemTags = await db
    .select()
    .from(unifiedTags)
    .where(inArray(unifiedTags.id, ids));

  const systemTagIds = systemTags.filter(t => t.isSystem).map(t => t.id);
  const deletableIds = ids.filter(id => !systemTagIds.includes(id));

  if (deletableIds.length === 0) {
    return NextResponse.json(
      { error: '没有可删除的标签' },
      { status: 400 }
    );
  }

  // 删除标签关联
  await db
    .delete(entityTags)
    .where(inArray(entityTags.tagId, deletableIds));

  // 删除标签
  const deleted = await db
    .delete(unifiedTags)
    .where(inArray(unifiedTags.id, deletableIds))
    .returning();

  return NextResponse.json({ 
    success: true, 
    count: deleted.length,
    deletedIds: deletableIds,
  });
}

// ============================================
// 批量关联实体
// ============================================

async function batchAssociate(data: {
  entityType: string;
  entityId: number;
  tagIds: number[];
}) {
  if (!data.entityType || !data.entityId || !data.tagIds || !Array.isArray(data.tagIds)) {
    return NextResponse.json(
      { error: '缺少必要参数' },
      { status: 400 }
    );
  }

  // 验证实体类型
  const validTypes = ['project', 'document', 'template', 'scheme', 'bid'];
  if (!validTypes.includes(data.entityType)) {
    return NextResponse.json(
      { error: '无效的实体类型' },
      { status: 400 }
    );
  }

  // 检查标签是否存在
  const tags = await db
    .select()
    .from(unifiedTags)
    .where(inArray(unifiedTags.id, data.tagIds));

  if (tags.length !== data.tagIds.length) {
    return NextResponse.json(
      { error: '部分标签不存在' },
      { status: 400 }
    );
  }

  // 删除现有关联
  await db
    .delete(entityTags)
    .where(
      sql`${entityTags.entityType} = ${data.entityType} AND ${entityTags.entityId} = ${data.entityId}`
    );

  // 创建新关联
  const associations = await db
    .insert(entityTags)
    .values(
      data.tagIds.map(tagId => ({
        entityType: data.entityType,
        entityId: data.entityId,
        tagId,
      }))
    )
    .returning();

  // 更新标签使用次数
  for (const tagId of data.tagIds) {
    await db
      .update(unifiedTags)
      .set({
        useCount: sql`${unifiedTags.useCount} + 1`,
      })
      .where(eq(unifiedTags.id, tagId));
  }

  return NextResponse.json({ 
    success: true, 
    count: associations.length,
    items: associations,
  });
}

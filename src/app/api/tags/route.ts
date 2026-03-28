/**
 * 统一标签管理API
 * 支持标签的增删改查、层级管理、批量操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { unifiedTags, tagCategories, entityTags, users, tagVersions } from '@/db/schema';
import { eq, like, desc, asc, and, or, inArray, isNull, sql, not } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';
import { logOperation } from '@/lib/tags/logger';

// ============================================
// 辅助函数：创建版本快照
// ============================================

async function createVersionSnapshot(tagId: number, userId: number, changeSummary: string) {
  try {
    // 获取当前标签
    const [tag] = await db
      .select()
      .from(unifiedTags)
      .where(eq(unifiedTags.id, tagId));

    if (!tag) return;

    // 获取当前最大版本号
    const versions = await db
      .select({ version: tagVersions.version })
      .from(tagVersions)
      .where(eq(tagVersions.tagId, tagId))
      .orderBy(desc(tagVersions.version))
      .limit(1);

    const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1;

    // 创建版本快照
    await db.insert(tagVersions).values({
      tagId,
      version: nextVersion,
      snapshot: JSON.stringify(tag),
      changeSummary,
      changedBy: userId,
    });
  } catch (error) {
    console.error('创建版本快照失败:', error);
  }
}

// ============================================
// GET: 获取标签列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword');
    const categoryId = searchParams.get('categoryId');
    const entityType = searchParams.get('entityType');
    const type = searchParams.get('type'); // tag/directory
    const tree = searchParams.get('tree') === 'true';
    const parentId = searchParams.get('parentId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const conditions = [eq(unifiedTags.isActive, true)];
    
    if (keyword) {
      conditions.push(
        or(
          like(unifiedTags.name, `%${keyword}%`),
          like(unifiedTags.code, `%${keyword}%`),
          like(unifiedTags.description, `%${keyword}%`)
        )!
      );
    }
    
    if (categoryId && categoryId !== 'all') {
      conditions.push(eq(unifiedTags.categoryId, parseInt(categoryId)));
    }
    
    if (type && type !== 'all') {
      conditions.push(eq(unifiedTags.type, type));
    }
    
    if (parentId !== null && parentId !== 'all') {
      if (parentId === 'null' || parentId === '') {
        conditions.push(isNull(unifiedTags.parentId));
      } else {
        conditions.push(eq(unifiedTags.parentId, parseInt(parentId)));
      }
    }

    // 如果指定了entityType，筛选适用于该实体类型的标签
    if (entityType && entityType !== 'all') {
      const entityTypeCondition = or(
        isNull(unifiedTags.entityTypes),
        sql`${unifiedTags.entityTypes}::jsonb @> ${JSON.stringify([entityType])}::jsonb`
      );
      if (entityTypeCondition) {
        conditions.push(entityTypeCondition);
      }
    }

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(unifiedTags)
      .where(and(...conditions));
    
    const total = countResult[0]?.count || 0;

    // 获取标签列表
    const tags = await db
      .select({
        id: unifiedTags.id,
        name: unifiedTags.name,
        code: unifiedTags.code,
        slug: unifiedTags.slug,
        categoryId: unifiedTags.categoryId,
        category: {
          id: tagCategories.id,
          name: tagCategories.name,
          color: tagCategories.color,
        },
        parentId: unifiedTags.parentId,
        type: unifiedTags.type,
        color: unifiedTags.color,
        icon: unifiedTags.icon,
        description: unifiedTags.description,
        entityTypes: unifiedTags.entityTypes,
        useCount: unifiedTags.useCount,
        isSystem: unifiedTags.isSystem,
        isActive: unifiedTags.isActive,
        sortOrder: unifiedTags.sortOrder,
        createdAt: unifiedTags.createdAt,
        updatedAt: unifiedTags.updatedAt,
        createdBy: unifiedTags.createdBy,
        creator: {
          id: users.id,
          username: users.username,
          realName: users.realName,
        },
      })
      .from(unifiedTags)
      .leftJoin(tagCategories, eq(unifiedTags.categoryId, tagCategories.id))
      .leftJoin(users, eq(unifiedTags.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(asc(unifiedTags.sortOrder), asc(unifiedTags.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

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
      
      return NextResponse.json({ 
        items: buildTree(tags),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    }

    return NextResponse.json({ 
      items: tags,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('获取标签列表失败:', error);
    return NextResponse.json(
      { error: '获取标签列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建标签
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      name, 
      code, 
      slug,
      categoryId,
      parentId,
      type = 'tag',
      color, 
      icon, 
      description,
      entityTypes,
      sortOrder,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: '缺少必填字段：name' },
        { status: 400 }
      );
    }

    // 检查code是否已存在
    if (code) {
      const existing = await db
        .select()
        .from(unifiedTags)
        .where(eq(unifiedTags.code, code));
      
      if (existing.length > 0) {
        return NextResponse.json(
          { error: '标签代码已存在' },
          { status: 400 }
        );
      }
    }

    // 检查slug是否已存在
    if (slug) {
      const existing = await db
        .select()
        .from(unifiedTags)
        .where(eq(unifiedTags.slug, slug));
      
      if (existing.length > 0) {
        return NextResponse.json(
          { error: '标签slug已存在' },
          { status: 400 }
        );
      }
    }

    const [tag] = await db
      .insert(unifiedTags)
      .values({
        name,
        code: code || null,
        slug: slug || null,
        categoryId: categoryId || null,
        parentId: parentId || null,
        type,
        color: color || '#6366f1',
        icon: icon || null,
        description: description || null,
        entityTypes: entityTypes ? JSON.stringify(entityTypes) : null,
        sortOrder: sortOrder || 0,
        createdBy: currentUser.userId,
      })
      .returning();

    // 创建初始版本快照
    await createVersionSnapshot(tag.id, currentUser.userId, '创建标签');
    
    // 记录操作日志
    await logOperation({
      userId: currentUser.userId,
      action: 'create',
      entityType: 'tag',
      entityId: tag.id,
      entityName: tag.name,
      newValue: tag,
    });

    return NextResponse.json({ item: tag });
  } catch (error) {
    console.error('创建标签失败:', error);
    return NextResponse.json(
      { error: '创建标签失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新标签
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
      name, 
      slug,
      categoryId,
      parentId,
      type,
      color, 
      icon, 
      description,
      entityTypes,
      sortOrder, 
      isActive 
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少标签ID' },
        { status: 400 }
      );
    }

    // 检查标签是否存在
    const [existing] = await db
      .select()
      .from(unifiedTags)
      .where(eq(unifiedTags.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: '标签不存在' },
        { status: 404 }
      );
    }

    // 系统标签不可修改
    if (existing.isSystem) {
      return NextResponse.json(
        { error: '系统内置标签不可修改' },
        { status: 400 }
      );
    }

    // 不能将自己设为父级
    if (parentId === id) {
      return NextResponse.json(
        { error: '不能将标签设为自己的子级' },
        { status: 400 }
      );
    }

    // 检查slug是否已被其他标签使用
    if (slug && slug !== existing.slug) {
      const slugExists = await db
        .select()
        .from(unifiedTags)
        .where(and(eq(unifiedTags.slug, slug), not(eq(unifiedTags.id, id))));
      
      if (slugExists.length > 0) {
        return NextResponse.json(
          { error: 'slug已被使用' },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(unifiedTags)
      .set({
        name: name || existing.name,
        slug: slug !== undefined ? slug : existing.slug,
        categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        parentId: parentId !== undefined ? parentId : existing.parentId,
        type: type || existing.type,
        color: color || existing.color,
        icon: icon !== undefined ? icon : existing.icon,
        description: description !== undefined ? description : existing.description,
        entityTypes: entityTypes !== undefined ? JSON.stringify(entityTypes) : existing.entityTypes,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(unifiedTags.id, id))
      .returning();

    // 创建版本快照
    await createVersionSnapshot(id, currentUser.userId, '更新标签');
    
    // 记录操作日志
    await logOperation({
      userId: currentUser.userId,
      action: 'update',
      entityType: 'tag',
      entityId: id,
      entityName: updated.name,
      oldValue: existing,
      newValue: updated,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('更新标签失败:', error);
    return NextResponse.json(
      { error: '更新标签失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除标签
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const ids = searchParams.get('ids'); // 支持批量删除

    if (!id && !ids) {
      return NextResponse.json(
        { error: '缺少标签ID' },
        { status: 400 }
      );
    }

    // 批量删除
    if (ids) {
      const tagIds = ids.split(',').map(Number).filter(Boolean);
      
      if (tagIds.length === 0) {
        return NextResponse.json(
          { error: '无效的标签ID' },
          { status: 400 }
        );
      }

      // 检查是否包含系统标签
      const systemTags = await db
        .select()
        .from(unifiedTags)
        .where(and(inArray(unifiedTags.id, tagIds), eq(unifiedTags.isSystem, true)));

      if (systemTags.length > 0) {
        return NextResponse.json(
          { error: '包含系统内置标签，无法删除' },
          { status: 400 }
        );
      }

      // 获取要删除的标签信息
      const tagsToDelete = await db
        .select()
        .from(unifiedTags)
        .where(inArray(unifiedTags.id, tagIds));

      // 删除标签关联
      await db
        .delete(entityTags)
        .where(inArray(entityTags.tagId, tagIds));

      // 删除标签
      await db
        .delete(unifiedTags)
        .where(inArray(unifiedTags.id, tagIds));

      // 记录操作日志
      for (const tag of tagsToDelete) {
        await logOperation({
          userId: currentUser.userId,
          action: 'delete',
          entityType: 'tag',
          entityId: tag.id,
          entityName: tag.name,
          oldValue: tag,
        });
      }

      return NextResponse.json({ success: true, count: tagIds.length });
    }

    const tagId = parseInt(id!);

    // 检查标签是否存在
    const [tag] = await db
      .select()
      .from(unifiedTags)
      .where(eq(unifiedTags.id, tagId));

    if (!tag) {
      return NextResponse.json(
        { error: '标签不存在' },
        { status: 404 }
      );
    }

    // 系统标签不可删除
    if (tag.isSystem) {
      return NextResponse.json(
        { error: '系统内置标签不能删除' },
        { status: 400 }
      );
    }

    // 检查是否有子标签
    const children = await db
      .select()
      .from(unifiedTags)
      .where(eq(unifiedTags.parentId, tagId));

    if (children.length > 0) {
      return NextResponse.json(
        { error: '存在子标签，无法删除' },
        { status: 400 }
      );
    }

    // 删除标签关联
    await db
      .delete(entityTags)
      .where(eq(entityTags.tagId, tagId));

    // 删除标签
    await db
      .delete(unifiedTags)
      .where(eq(unifiedTags.id, tagId));

    // 记录操作日志
    await logOperation({
      userId: currentUser.userId,
      action: 'delete',
      entityType: 'tag',
      entityId: tagId,
      entityName: tag.name,
      oldValue: tag,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除标签失败:', error);
    return NextResponse.json(
      { error: '删除标签失败' },
      { status: 500 }
    );
  }
}

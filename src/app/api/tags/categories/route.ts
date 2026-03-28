/**
 * 标签分类管理API
 * 支持分类的增删改查、层级管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tagCategories, unifiedTags, users } from '@/db/schema';
import { eq, like, desc, asc, and, or, inArray, isNull } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取分类列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const keyword = searchParams.get('keyword');
    const tree = searchParams.get('tree') === 'true';
    const parentId = searchParams.get('parentId');

    const conditions = [eq(tagCategories.isActive, true)];
    
    if (entityType && entityType !== 'all') {
      conditions.push(eq(tagCategories.entityType, entityType));
    }
    
    if (keyword) {
      conditions.push(like(tagCategories.name, `%${keyword}%`));
    }
    
    if (parentId !== null) {
      if (parentId === 'null' || parentId === '') {
        conditions.push(isNull(tagCategories.parent_id));
      } else {
        conditions.push(eq(tagCategories.parent_id, parseInt(parentId)));
      }
    }

    const categories = await db
      .select({
        id: tagCategories.id,
        name: tagCategories.name,
        code: tagCategories.code,
        description: tagCategories.description,
        icon: tagCategories.icon,
        color: tagCategories.color,
        entityType: tagCategories.entityType,
        parentId: tagCategories.parent_id,
        sortOrder: tagCategories.sortOrder,
        isActive: tagCategories.isActive,
        createdAt: tagCategories.createdAt,
        updatedAt: tagCategories.updatedAt,
        createdBy: tagCategories.createdBy,
        creator: {
          id: users.id,
          username: users.username,
          realName: users.realName,
        },
      })
      .from(tagCategories)
      .leftJoin(users, eq(tagCategories.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(asc(tagCategories.sortOrder), asc(tagCategories.name));

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
      
      return NextResponse.json({ items: buildTree(categories) });
    }

    // 获取每个分类下的标签数量
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const tags = await db
          .select({ count: unifiedTags.id })
          .from(unifiedTags)
          .where(eq(unifiedTags.categoryId, category.id));
        
        return {
          ...category,
          tagCount: tags.length,
        };
      })
    );

    return NextResponse.json({ items: categoriesWithCount });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    return NextResponse.json(
      { error: '获取分类列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建分类
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
      description, 
      icon, 
      color, 
      entityType,
      parentId,
      sortOrder 
    } = body;

    if (!name || !entityType) {
      return NextResponse.json(
        { error: '缺少必填字段：name, entityType' },
        { status: 400 }
      );
    }

    // 检查code是否已存在
    if (code) {
      const existing = await db
        .select()
        .from(tagCategories)
        .where(eq(tagCategories.code, code));
      
      if (existing.length > 0) {
        return NextResponse.json(
          { error: '分类代码已存在' },
          { status: 400 }
        );
      }
    }

    const [category] = await db
      .insert(tagCategories)
      .values({
        name,
        code: code || `cat_${Date.now()}`,
        description,
        icon,
        color: color || '#6366f1',
        entityType,
        parent_id: parentId || null,
        sortOrder: sortOrder || 0,
        createdBy: currentUser.userId,
      })
      .returning();

    return NextResponse.json({ item: category });
  } catch (error) {
    console.error('创建分类失败:', error);
    return NextResponse.json(
      { error: '创建分类失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新分类
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, icon, color, parentId, sortOrder, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少分类ID' },
        { status: 400 }
      );
    }

    // 检查分类是否存在
    const [existing] = await db
      .select()
      .from(tagCategories)
      .where(eq(tagCategories.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: '分类不存在' },
        { status: 404 }
      );
    }

    // 不能将自己设为父级
    if (parentId === id) {
      return NextResponse.json(
        { error: '不能将分类设为自己的子级' },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(tagCategories)
      .set({
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        icon: icon !== undefined ? icon : existing.icon,
        color: color || existing.color,
        parent_id: parentId !== undefined ? parentId : existing.parent_id,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(tagCategories.id, id))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('更新分类失败:', error);
    return NextResponse.json(
      { error: '更新分类失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除分类
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少分类ID' },
        { status: 400 }
      );
    }

    const categoryId = parseInt(id);

    // 检查分类是否存在
    const [category] = await db
      .select()
      .from(tagCategories)
      .where(eq(tagCategories.id, categoryId));

    if (!category) {
      return NextResponse.json(
        { error: '分类不存在' },
        { status: 404 }
      );
    }

    // 检查是否有子分类
    const children = await db
      .select()
      .from(tagCategories)
      .where(eq(tagCategories.parent_id, categoryId));

    if (children.length > 0) {
      return NextResponse.json(
        { error: '存在子分类，无法删除' },
        { status: 400 }
      );
    }

    // 检查是否有标签关联
    const tags = await db
      .select()
      .from(unifiedTags)
      .where(eq(unifiedTags.categoryId, categoryId));

    if (tags.length > 0) {
      return NextResponse.json(
        { error: '分类下存在标签，无法删除' },
        { status: 400 }
      );
    }

    // 删除分类
    await db
      .delete(tagCategories)
      .where(eq(tagCategories.id, categoryId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除分类失败:', error);
    return NextResponse.json(
      { error: '删除分类失败' },
      { status: 500 }
    );
  }
}

/**
 * 标签高级搜索API
 * 支持多维度筛选、全文检索、智能匹配
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { unifiedTags, tagCategories, entityTags, users } from '@/db/schema';
import { eq, like, desc, asc, and, or, inArray, isNull, sql, not, between, gte, lte } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// POST: 高级搜索
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      keyword,
      categoryIds,
      types,
      colors,
      entityTypes,
      useCountRange,
      dateRange,
      createdBy,
      isSystem,
      isActive,
      hasChildren,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      pageSize = 50,
    } = body;

    const conditions: any[] = [];

    // 关键词搜索（支持全文检索）
    if (keyword) {
      const keywordConditions = [
        like(unifiedTags.name, `%${keyword}%`),
        like(unifiedTags.code, `%${keyword}%`),
        like(unifiedTags.description, `%${keyword}%`),
        // PostgreSQL 全文搜索
        sql`to_tsvector('simple', ${unifiedTags.name} || ' ' || COALESCE(${unifiedTags.description}, '')) @@ plainto_tsquery('simple', ${keyword})`,
      ];
      conditions.push(or(...keywordConditions)!);
    }

    // 分类筛选
    if (categoryIds && categoryIds.length > 0) {
      if (categoryIds.includes(null)) {
        const filteredIds = categoryIds.filter((id: number | null) => id !== null);
        if (filteredIds.length > 0) {
          conditions.push(
            or(
              isNull(unifiedTags.categoryId),
              inArray(unifiedTags.categoryId, filteredIds)
            )!
          );
        } else {
          conditions.push(isNull(unifiedTags.categoryId));
        }
      } else {
        conditions.push(inArray(unifiedTags.categoryId, categoryIds));
      }
    }

    // 类型筛选
    if (types && types.length > 0) {
      conditions.push(inArray(unifiedTags.type, types));
    }

    // 颜色筛选
    if (colors && colors.length > 0) {
      conditions.push(inArray(unifiedTags.color, colors));
    }

    // 实体类型筛选
    if (entityTypes && entityTypes.length > 0) {
      const entityTypeConditions = entityTypes.map((type: string) =>
        sql`${unifiedTags.entityTypes}::jsonb @> ${JSON.stringify([type])}::jsonb`
      );
      conditions.push(
        or(
          isNull(unifiedTags.entityTypes),
          ...entityTypeConditions
        )!
      );
    }

    // 使用次数范围筛选
    if (useCountRange) {
      const { min, max } = useCountRange;
      if (min !== undefined && max !== undefined) {
        conditions.push(between(unifiedTags.useCount, min, max));
      } else if (min !== undefined) {
        conditions.push(gte(unifiedTags.useCount, min));
      } else if (max !== undefined) {
        conditions.push(lte(unifiedTags.useCount, max));
      }
    }

    // 创建日期范围筛选
    if (dateRange) {
      const { start, end } = dateRange;
      if (start) {
        conditions.push(gte(unifiedTags.createdAt, new Date(start)));
      }
      if (end) {
        conditions.push(lte(unifiedTags.createdAt, new Date(end)));
      }
    }

    // 创建人筛选
    if (createdBy && createdBy.length > 0) {
      conditions.push(inArray(unifiedTags.createdBy, createdBy));
    }

    // 系统标签筛选
    if (isSystem !== undefined) {
      conditions.push(eq(unifiedTags.isSystem, isSystem));
    }

    // 活跃状态筛选
    if (isActive !== undefined) {
      conditions.push(eq(unifiedTags.isActive, isActive));
    }

    // 是否有子标签
    if (hasChildren !== undefined) {
      if (hasChildren) {
        conditions.push(
          sql`${unifiedTags.id} IN (SELECT parent_id FROM unified_tags WHERE parent_id IS NOT NULL)`
        );
      } else {
        conditions.push(
          sql`${unifiedTags.id} NOT IN (SELECT parent_id FROM unified_tags WHERE parent_id IS NOT NULL)`
        );
      }
    }

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(unifiedTags)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = countResult[0]?.count || 0;

    // 排序
    const orderDirection = sortOrder === 'desc' ? desc : asc;
    let orderBy: any;
    
    switch (sortBy) {
      case 'name':
        orderBy = orderDirection(unifiedTags.name);
        break;
      case 'useCount':
        orderBy = orderDirection(unifiedTags.useCount);
        break;
      case 'createdAt':
        orderBy = orderDirection(unifiedTags.createdAt);
        break;
      case 'updatedAt':
        orderBy = orderDirection(unifiedTags.updatedAt);
        break;
      case 'sortOrder':
        orderBy = orderDirection(unifiedTags.sortOrder);
        break;
      default:
        orderBy = orderDirection(unifiedTags.name);
    }

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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // 获取每个标签的关联实体数量
    const tagsWithEntityCount = await Promise.all(
      tags.map(async (tag) => {
        const entityCount = await db
          .select({ count: sql<number>`count(distinct ${entityTags.entityType})` })
          .from(entityTags)
          .where(eq(entityTags.tagId, tag.id));
        
        return {
          ...tag,
          entityCount: entityCount[0]?.count || 0,
        };
      })
    );

    return NextResponse.json({
      items: tagsWithEntityCount,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      filters: {
        keyword,
        categoryIds,
        types,
        colors,
        entityTypes,
        useCountRange,
        dateRange,
        createdBy,
        isSystem,
        isActive,
        hasChildren,
      },
    });
  } catch (error) {
    console.error('高级搜索失败:', error);
    return NextResponse.json(
      { error: '高级搜索失败' },
      { status: 500 }
    );
  }
}

// ============================================
// GET: 获取搜索建议
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!keyword || keyword.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // 搜索标签名称
    const tags = await db
      .select({
        id: unifiedTags.id,
        name: unifiedTags.name,
        type: sql<string>`'tag'`,
        color: unifiedTags.color,
      })
      .from(unifiedTags)
      .where(
        and(
          eq(unifiedTags.isActive, true),
          like(unifiedTags.name, `%${keyword}%`)
        )
      )
      .limit(limit);

    // 搜索分类名称
    const categories = await db
      .select({
        id: tagCategories.id,
        name: tagCategories.name,
        type: sql<string>`'category'`,
        color: tagCategories.color,
      })
      .from(tagCategories)
      .where(
        and(
          eq(tagCategories.isActive, true),
          like(tagCategories.name, `%${keyword}%`)
        )
      )
      .limit(limit);

    // 合并结果
    const suggestions = [
      ...tags.map(t => ({ ...t, label: t.name, value: `tag:${t.id}` })),
      ...categories.map(c => ({ ...c, label: c.name, value: `category:${c.id}` })),
    ].slice(0, limit);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('获取搜索建议失败:', error);
    return NextResponse.json(
      { error: '获取搜索建议失败' },
      { status: 500 }
    );
  }
}

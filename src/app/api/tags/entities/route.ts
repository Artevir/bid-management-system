/**
 * 实体标签关联API
 * 支持实体与标签的关联管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { entityTags, unifiedTags, projects, bidDocuments, promptTemplates } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取实体的标签列表或标签的实体列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const tagId = searchParams.get('tagId');

    // 获取实体关联的所有标签
    if (entityType && entityId) {
      const tags = await db
        .select({
          id: unifiedTags.id,
          name: unifiedTags.name,
          code: unifiedTags.code,
          color: unifiedTags.color,
          icon: unifiedTags.icon,
          type: unifiedTags.type,
          createdAt: entityTags.addedAt,
        })
        .from(entityTags)
        .innerJoin(unifiedTags, eq(entityTags.tagId, unifiedTags.id))
        .where(
          and(
            eq(entityTags.entityType, entityType),
            eq(entityTags.entityId, parseInt(entityId))
          )
        );

      return NextResponse.json({ items: tags });
    }

    // 获取标签关联的所有实体
    if (tagId) {
      const entities = await db
        .select({
          id: entityTags.entityId,
          entityType: entityTags.entityType,
          createdAt: entityTags.addedAt,
        })
        .from(entityTags)
        .where(eq(entityTags.tagId, parseInt(tagId)));

      // 根据实体类型获取实体详情
      const result: any[] = [];
      
      const projectEntities = entities.filter(e => e.entityType === 'project');
      if (projectEntities.length > 0) {
        const projectIds = projectEntities.map(e => e.id);
        const projectList = await db
          .select({
            id: projects.id,
            name: projects.name,
            code: projects.code,
          })
          .from(projects)
          .where(inArray(projects.id, projectIds));
        
        result.push(...projectList.map(p => ({ ...p, entityType: 'project' })));
      }

      const documentEntities = entities.filter(e => e.entityType === 'document');
      if (documentEntities.length > 0) {
        const docIds = documentEntities.map(e => e.id);
        const docList = await db
          .select({
            id: bidDocuments.id,
            name: bidDocuments.name,
          })
          .from(bidDocuments)
          .where(inArray(bidDocuments.id, docIds));
        
        result.push(...docList.map(d => ({ ...d, entityType: 'document' })));
      }

      const templateEntities = entities.filter(e => e.entityType === 'template');
      if (templateEntities.length > 0) {
        const templateIds = templateEntities.map(e => e.id);
        const templateList = await db
          .select({
            id: promptTemplates.id,
            name: promptTemplates.name,
            code: promptTemplates.code,
          })
          .from(promptTemplates)
          .where(inArray(promptTemplates.id, templateIds));
        
        result.push(...templateList.map(t => ({ ...t, entityType: 'template' })));
      }

      return NextResponse.json({ items: result });
    }

    return NextResponse.json(
      { error: '缺少必要参数：entityType+entityId 或 tagId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('获取关联信息失败:', error);
    return NextResponse.json(
      { error: '获取关联信息失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建实体标签关联
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { entityType, entityId, tagIds } = body;

    if (!entityType || !entityId || !tagIds || !Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: '缺少必填字段：entityType, entityId, tagIds' },
        { status: 400 }
      );
    }

    // 验证实体类型
    const validTypes = ['project', 'document', 'template', 'scheme', 'bid'];
    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        { error: '无效的实体类型' },
        { status: 400 }
      );
    }

    // 检查标签是否存在
    const tags = await db
      .select()
      .from(unifiedTags)
      .where(inArray(unifiedTags.id, tagIds));

    if (tags.length !== tagIds.length) {
      return NextResponse.json(
        { error: '部分标签不存在' },
        { status: 400 }
      );
    }

    // 检查标签是否适用于该实体类型
    const invalidTags = tags.filter(tag => {
      if (!tag.entityTypes) return false;
      const types = JSON.parse(tag.entityTypes as string);
      return !types.includes(entityType);
    });

    if (invalidTags.length > 0) {
      return NextResponse.json(
        { error: `标签 ${invalidTags.map(t => t.name).join(', ')} 不适用于该实体类型` },
        { status: 400 }
      );
    }

    // 删除现有关联
    await db
      .delete(entityTags)
      .where(
        and(
          eq(entityTags.entityType, entityType),
          eq(entityTags.entityId, entityId)
        )
      );

    // 创建新关联
    const associations = await db
      .insert(entityTags)
      .values(
        tagIds.map(tagId => ({
          entityType,
          entityId,
          tagId,
        }))
      )
      .returning();

    // 更新标签使用次数
    for (const tagId of tagIds) {
      await db
        .update(unifiedTags)
        .set({
          useCount: sql`${unifiedTags.useCount} + 1`,
        })
        .where(eq(unifiedTags.id, tagId));
    }

    return NextResponse.json({ items: associations, count: associations.length });
  } catch (error) {
    console.error('创建关联失败:', error);
    return NextResponse.json(
      { error: '创建关联失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新实体标签关联（添加或移除单个标签）
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { entityType, entityId, tagId, action } = body;

    if (!entityType || !entityId || !tagId || !action) {
      return NextResponse.json(
        { error: '缺少必填字段：entityType, entityId, tagId, action' },
        { status: 400 }
      );
    }

    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: '无效的action值，必须是add或remove' },
        { status: 400 }
      );
    }

    if (action === 'add') {
      // 检查是否已存在
      const [existing] = await db
        .select()
        .from(entityTags)
        .where(
          and(
            eq(entityTags.entityType, entityType),
            eq(entityTags.entityId, entityId),
            eq(entityTags.tagId, tagId)
          )
        );

      if (existing) {
        return NextResponse.json(
          { error: '关联已存在' },
          { status: 400 }
        );
      }

      // 创建关联
      const [association] = await db
        .insert(entityTags)
        .values({ entityType, entityId, tagId })
        .returning();

      // 更新标签使用次数
      await db
        .update(unifiedTags)
        .set({
          useCount: sql`${unifiedTags.useCount} + 1`,
        })
        .where(eq(unifiedTags.id, tagId));

      return NextResponse.json({ item: association });
    } else {
      // 删除关联
      const result = await db
        .delete(entityTags)
        .where(
          and(
            eq(entityTags.entityType, entityType),
            eq(entityTags.entityId, entityId),
            eq(entityTags.tagId, tagId)
          )
        )
        .returning();

      if (result.length === 0) {
        return NextResponse.json(
          { error: '关联不存在' },
          { status: 404 }
        );
      }

      // 更新标签使用次数
      await db
        .update(unifiedTags)
        .set({
          useCount: sql`${unifiedTags.useCount} - 1`,
        })
        .where(eq(unifiedTags.id, tagId));

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('更新关联失败:', error);
    return NextResponse.json(
      { error: '更新关联失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除实体标签关联
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const tagId = searchParams.get('tagId');

    if (entityType && entityId && tagId) {
      // 删除单个关联
      const result = await db
        .delete(entityTags)
        .where(
          and(
            eq(entityTags.entityType, entityType),
            eq(entityTags.entityId, parseInt(entityId)),
            eq(entityTags.tagId, parseInt(tagId))
          )
        )
        .returning();

      if (result.length === 0) {
        return NextResponse.json(
          { error: '关联不存在' },
          { status: 404 }
        );
      }

      // 更新标签使用次数
      await db
        .update(unifiedTags)
        .set({
          useCount: sql`${unifiedTags.useCount} - 1`,
        })
        .where(eq(unifiedTags.id, parseInt(tagId)));

      return NextResponse.json({ success: true });
    }

    if (entityType && entityId) {
      // 删除实体的所有标签关联
      const result = await db
        .delete(entityTags)
        .where(
          and(
            eq(entityTags.entityType, entityType),
            eq(entityTags.entityId, parseInt(entityId))
          )
        )
        .returning();

      // 更新所有相关标签的使用次数
      for (const item of result) {
        await db
          .update(unifiedTags)
          .set({
            useCount: sql`${unifiedTags.useCount} - 1`,
          })
          .where(eq(unifiedTags.id, item.tagId));
      }

      return NextResponse.json({ success: true, count: result.length });
    }

    return NextResponse.json(
      { error: '缺少必要参数' },
      { status: 400 }
    );
  } catch (error) {
    console.error('删除关联失败:', error);
    return NextResponse.json(
      { error: '删除关联失败' },
      { status: 500 }
    );
  }
}

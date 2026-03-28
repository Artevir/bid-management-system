/**
 * 方案库服务层
 * 提供方案的CRUD、分类管理、AI生成等功能
 */

import { db } from '@/db';
import {
  schemeCategories,
  schemes,
  schemeChapters,
  schemeTags,
  schemeTagRelations,
  schemeFiles,
  schemeGenerationLogs,
  schemeVersions,
  schemeShares,
} from '@/db/scheme-schema';
import { docFrameworks, docFrameworkChapters, users } from '@/db/schema';
import {
  eq,
  and,
  or,
  like,
  desc,
  asc,
  inArray,
  sql,
  count,
  isNull,
} from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface CreateSchemeParams {
  name: string;
  code?: string;
  description?: string;
  categoryId?: number;
  stage?: 'draft' | 'detailed' | 'final' | 'bidding';
  frameworkId?: number;
  source?: 'manual' | 'upload' | 'ai_generate';
  tags?: string[];
  createdBy: number;
}

export interface UpdateSchemeParams {
  name?: string;
  description?: string;
  categoryId?: number;
  stage?: 'draft' | 'detailed' | 'final' | 'bidding';
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
}

export interface SchemeQueryParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  stage?: string;
  status?: string;
  tags?: string[];
  createdBy?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateCategoryParams {
  name: string;
  code?: string;
  description?: string;
  parentId?: number;
  type?: string;
  createdBy: number;
}

export interface CreateChapterParams {
  schemeId: number;
  title: string;
  parentId?: number;
  serialNumber?: string;
  content?: string;
}

export interface AIGenerateParams {
  schemeId?: number;
  chapterId?: number;
  generateType: 'full' | 'segment';
  generateMode: 'default' | 'llm';
  prompt: string;
  parameters?: {
    projectType?: string;
    wordCount?: number;
    focus?: string;
    style?: string;
  };
  userId: number;
}

// ============================================
// 分类服务
// ============================================

/**
 * 获取分类列表（树形结构）
 */
export async function getCategoryTree() {
  const allCategories = await db
    .select({
      id: schemeCategories.id,
      name: schemeCategories.name,
      code: schemeCategories.code,
      description: schemeCategories.description,
      parentId: schemeCategories.parentId,
      level: schemeCategories.level,
      type: schemeCategories.type,
      sortOrder: schemeCategories.sortOrder,
      schemeCount: schemeCategories.schemeCount,
      isActive: schemeCategories.isActive,
    })
    .from(schemeCategories)
    .where(eq(schemeCategories.isActive, true))
    .orderBy(asc(schemeCategories.sortOrder));

  // 构建树形结构
  const buildTree = (items: typeof allCategories, parentId: number | null = null): any[] => {
    return items
      .filter((item) => item.parentId === parentId)
      .map((item) => ({
        ...item,
        children: buildTree(items, item.id),
      }));
  };

  return buildTree(allCategories, null);
}

/**
 * 创建分类
 */
export async function createCategory(params: CreateCategoryParams) {
  // 计算层级
  let level = 1;
  if (params.parentId) {
    const [parent] = await db
      .select({ level: schemeCategories.level })
      .from(schemeCategories)
      .where(eq(schemeCategories.id, params.parentId))
      .limit(1);
    
    if (parent) {
      level = parent.level + 1;
      if (level > 3) {
        throw new Error('分类层级最多支持3级');
      }
    }
  }

  const [category] = await db
    .insert(schemeCategories)
    .values({
      name: params.name,
      code: params.code,
      description: params.description,
      parentId: params.parentId || null,
      level,
      type: params.type,
      createdBy: params.createdBy,
    })
    .returning();

  return category;
}

/**
 * 更新分类
 */
export async function updateCategory(
  categoryId: number,
  data: Partial<{
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>
) {
  const [category] = await db
    .update(schemeCategories)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(schemeCategories.id, categoryId))
    .returning();

  return category;
}

/**
 * 删除分类
 */
export async function deleteCategory(categoryId: number) {
  // 检查是否有子分类
  const [child] = await db
    .select()
    .from(schemeCategories)
    .where(eq(schemeCategories.parentId, categoryId))
    .limit(1);

  if (child) {
    throw new Error('该分类下存在子分类，无法删除');
  }

  // 检查是否有方案
  const [scheme] = await db
    .select()
    .from(schemes)
    .where(eq(schemes.categoryId, categoryId))
    .limit(1);

  if (scheme) {
    throw new Error('该分类下存在方案，请先移动方案后再删除');
  }

  await db.delete(schemeCategories).where(eq(schemeCategories.id, categoryId));
  return true;
}

// ============================================
// 方案服务
// ============================================

/**
 * 获取方案列表
 */
export async function getSchemeList(params: SchemeQueryParams) {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    categoryId,
    stage,
    status,
    tags,
    createdBy,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  const conditions = [];

  if (keyword) {
    conditions.push(
      or(
        like(schemes.name, `%${keyword}%`),
        like(schemes.description, `%${keyword}%`)
      )
    );
  }

  if (categoryId) {
    conditions.push(eq(schemes.categoryId, categoryId));
  }

  if (stage) {
    conditions.push(eq(schemes.stage, stage as any));
  }

  if (status) {
    conditions.push(eq(schemes.status, status as any));
  }

  if (createdBy) {
    conditions.push(eq(schemes.createdBy, createdBy));
  }

  // 标签筛选
  if (tags && tags.length > 0) {
    const tagIds = tags.map((t) => parseInt(t, 10)).filter((id) => !isNaN(id));
    if (tagIds.length > 0) {
      const schemeIdsWithTag = await db
        .selectDistinct({ schemeId: schemeTagRelations.schemeId })
        .from(schemeTagRelations)
        .where(inArray(schemeTagRelations.tagId, tagIds));

      const schemeIds = schemeIdsWithTag.map((s) => s.schemeId);
      if (schemeIds.length > 0) {
        conditions.push(inArray(schemes.id, schemeIds));
      } else {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }
    }
  }

  // 排序
  const orderDirection = sortOrder === 'asc' ? asc : desc;
  let orderBy;
  switch (sortBy) {
    case 'name':
      orderBy = orderDirection(schemes.name);
      break;
    case 'wordCount':
      orderBy = orderDirection(schemes.wordCount);
      break;
    case 'updatedAt':
      orderBy = orderDirection(schemes.updatedAt);
      break;
    default:
      orderBy = orderDirection(schemes.createdAt);
  }

  // 查询总数
  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schemes)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // 查询列表
  const items = await db
    .select({
      id: schemes.id,
      name: schemes.name,
      code: schemes.code,
      description: schemes.description,
      categoryId: schemes.categoryId,
      categoryName: schemeCategories.name,
      stage: schemes.stage,
      status: schemes.status,
      totalChapters: schemes.totalChapters,
      wordCount: schemes.wordCount,
      progress: schemes.progress,
      source: schemes.source,
      aiGenerated: schemes.aiGenerated,
      createdAt: schemes.createdAt,
      updatedAt: schemes.updatedAt,
      creatorName: users.realName,
    })
    .from(schemes)
    .leftJoin(schemeCategories, eq(schemes.categoryId, schemeCategories.id))
    .leftJoin(users, eq(schemes.createdBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy)
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  // 批量加载标签
  const schemeIds = items.map((item) => item.id);
  const tagMap = await batchLoadSchemeTags(schemeIds);

  return {
    items: items.map((item) => ({
      ...item,
      tags: tagMap.get(item.id) || [],
    })),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.ceil(Number(total) / pageSize),
  };
}

/**
 * 批量加载方案标签
 */
async function batchLoadSchemeTags(schemeIds: number[]): Promise<Map<number, any[]>> {
  if (schemeIds.length === 0) return new Map();

  const tagRelations = await db
    .select({
      schemeId: schemeTagRelations.schemeId,
      tagId: schemeTags.id,
      tagName: schemeTags.name,
      tagColor: schemeTags.color,
    })
    .from(schemeTagRelations)
    .innerJoin(schemeTags, eq(schemeTagRelations.tagId, schemeTags.id))
    .where(inArray(schemeTagRelations.schemeId, schemeIds));

  const tagMap = new Map<number, any[]>();
  for (const rel of tagRelations) {
    if (!tagMap.has(rel.schemeId)) {
      tagMap.set(rel.schemeId, []);
    }
    tagMap.get(rel.schemeId)!.push({
      id: rel.tagId,
      name: rel.tagName,
      color: rel.tagColor,
    });
  }

  return tagMap;
}

/**
 * 获取方案详情
 */
export async function getSchemeById(schemeId: number) {
  const [scheme] = await db
    .select({
      id: schemes.id,
      name: schemes.name,
      code: schemes.code,
      description: schemes.description,
      categoryId: schemes.categoryId,
      categoryName: schemeCategories.name,
      stage: schemes.stage,
      status: schemes.status,
      totalChapters: schemes.totalChapters,
      completedChapters: schemes.completedChapters,
      wordCount: schemes.wordCount,
      progress: schemes.progress,
      frameworkId: schemes.frameworkId,
      source: schemes.source,
      aiGenerated: schemes.aiGenerated,
      aiGenerateMode: schemes.aiGenerateMode,
      version: schemes.version,
      expiryDate: schemes.expiryDate,
      createdAt: schemes.createdAt,
      updatedAt: schemes.updatedAt,
      createdBy: schemes.createdBy,
      creatorName: users.realName,
    })
    .from(schemes)
    .leftJoin(schemeCategories, eq(schemes.categoryId, schemeCategories.id))
    .leftJoin(users, eq(schemes.createdBy, users.id))
    .where(eq(schemes.id, schemeId))
    .limit(1);

  if (!scheme) return null;

  // 获取章节
  const chapters = await db
    .select()
    .from(schemeChapters)
    .where(eq(schemeChapters.schemeId, schemeId))
    .orderBy(asc(schemeChapters.sortOrder));

  // 获取标签
  const tags = await db
    .select({
      id: schemeTags.id,
      name: schemeTags.name,
      color: schemeTags.color,
    })
    .from(schemeTags)
    .innerJoin(schemeTagRelations, eq(schemeTags.id, schemeTagRelations.tagId))
    .where(eq(schemeTagRelations.schemeId, schemeId));

  return {
    ...scheme,
    chapters,
    tags,
  };
}

/**
 * 创建方案
 */
export async function createScheme(params: CreateSchemeParams) {
  const [scheme] = await db
    .insert(schemes)
    .values({
      name: params.name,
      code: params.code,
      description: params.description,
      categoryId: params.categoryId,
      stage: params.stage || 'draft',
      frameworkId: params.frameworkId,
      source: params.source || 'manual',
      createdBy: params.createdBy,
    })
    .returning();

  // 如果有文档框架，复制框架章节
  if (params.frameworkId) {
    await copyFrameworkChapters(scheme.id, params.frameworkId);
  }

  // 处理标签
  if (params.tags && params.tags.length > 0) {
    await updateSchemeTags(scheme.id, params.tags);
  }

  // 更新分类方案数量
  if (params.categoryId) {
    await db
      .update(schemeCategories)
      .set({
        schemeCount: sql`${schemeCategories.schemeCount} + 1`,
      })
      .where(eq(schemeCategories.id, params.categoryId));
  }

  // 创建初始版本
  await db.insert(schemeVersions).values({
    schemeId: scheme.id,
    version: 1,
    changeLog: '创建方案',
    changeType: 'create',
    createdBy: params.createdBy,
  });

  return scheme;
}

/**
 * 从文档框架复制章节
 */
async function copyFrameworkChapters(schemeId: number, frameworkId: number) {
  const frameworkChapters = await db
    .select()
    .from(docFrameworkChapters)
    .where(eq(docFrameworkChapters.frameworkId, frameworkId))
    .orderBy(asc(docFrameworkChapters.sequence));

  for (const chapter of frameworkChapters) {
    await db.insert(schemeChapters).values({
      schemeId,
      parentId: null, // 简化处理，不复制层级结构
      serialNumber: chapter.chapterCode || '',
      title: chapter.title,
      content: '',
      level: chapter.level,
      sortOrder: chapter.sequence,
      isRequired: chapter.required || true,
    });
  }

  // 更新章节统计
  await db
    .update(schemes)
    .set({
      totalChapters: frameworkChapters.length,
    })
    .where(eq(schemes.id, schemeId));
}

/**
 * 更新方案
 */
export async function updateScheme(schemeId: number, data: UpdateSchemeParams) {
  const [existing] = await db
    .select()
    .from(schemes)
    .where(eq(schemes.id, schemeId))
    .limit(1);

  if (!existing) {
    throw new Error('方案不存在');
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.stage) updateData.stage = data.stage;
  if (data.status) updateData.status = data.status;

  await db.update(schemes).set(updateData).where(eq(schemes.id, schemeId));

  // 更新标签
  if (data.tags) {
    await updateSchemeTags(schemeId, data.tags);
  }

  return true;
}

/**
 * 更新方案标签
 */
async function updateSchemeTags(schemeId: number, tags: string[]) {
  // 删除现有标签关联
  await db.delete(schemeTagRelations).where(eq(schemeTagRelations.schemeId, schemeId));

  // 创建新标签关联
  for (const tagName of tags) {
    // 查找或创建标签
    let [tag] = await db
      .select()
      .from(schemeTags)
      .where(eq(schemeTags.name, tagName))
      .limit(1);

    if (!tag) {
      [tag] = await db
        .insert(schemeTags)
        .values({ name: tagName })
        .returning();
    }

    await db.insert(schemeTagRelations).values({
      schemeId,
      tagId: tag.id,
    });

    // 更新标签使用次数
    await db
      .update(schemeTags)
      .set({ usageCount: sql`${schemeTags.usageCount} + 1` })
      .where(eq(schemeTags.id, tag.id));
  }
}

/**
 * 删除方案
 */
export async function deleteScheme(schemeId: number) {
  const [scheme] = await db
    .select()
    .from(schemes)
    .where(eq(schemes.id, schemeId))
    .limit(1);

  if (!scheme) {
    throw new Error('方案不存在');
  }

  // 更新分类方案数量
  if (scheme.categoryId) {
    await db
      .update(schemeCategories)
      .set({
        schemeCount: sql`${schemeCategories.schemeCount} - 1`,
      })
      .where(eq(schemeCategories.id, scheme.categoryId));
  }

  // 删除方案（级联删除章节、标签等）
  await db.delete(schemes).where(eq(schemes.id, schemeId));

  return true;
}

/**
 * 归档方案
 */
export async function archiveScheme(schemeId: number, userId: number) {
  await db
    .update(schemes)
    .set({
      status: 'archived',
      archivedAt: new Date(),
      archivedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(schemes.id, schemeId));

  return true;
}

// ============================================
// 章节服务
// ============================================

/**
 * 获取方案章节
 */
export async function getSchemeChapters(schemeId: number) {
  const chapters = await db
    .select()
    .from(schemeChapters)
    .where(eq(schemeChapters.schemeId, schemeId))
    .orderBy(asc(schemeChapters.sortOrder));

  return chapters;
}

/**
 * 创建章节
 */
export async function createChapter(params: CreateChapterParams) {
  // 获取最大排序号
  const [maxSort] = await db
    .select({ max: sql<number>`coalesce(max(sort_order), 0)` })
    .from(schemeChapters)
    .where(eq(schemeChapters.schemeId, params.schemeId));

  const sortOrder = Number(maxSort?.max || 0) + 1;

  const [chapter] = await db
    .insert(schemeChapters)
    .values({
      schemeId: params.schemeId,
      title: params.title,
      parentId: params.parentId || null,
      serialNumber: params.serialNumber || '',
      content: params.content || '',
      sortOrder,
    })
    .returning();

  // 更新方案章节总数
  await db
    .update(schemes)
    .set({
      totalChapters: sql`${schemes.totalChapters} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schemes.id, params.schemeId));

  return chapter;
}

/**
 * 删除章节
 */
export async function deleteChapter(chapterId: number) {
  const [chapter] = await db
    .select()
    .from(schemeChapters)
    .where(eq(schemeChapters.id, chapterId))
    .limit(1);

  if (!chapter) {
    throw new Error('章节不存在');
  }

  await db.delete(schemeChapters).where(eq(schemeChapters.id, chapterId));

  // 更新方案统计
  await updateSchemeStats(chapter.schemeId);

  return true;
}

/**
 * 构建章节树
 */
function buildChapterTree(chapters: any[], parentId: number | null = null): any[] {
  return chapters
    .filter((c) => c.parentId === parentId)
    .map((c) => ({
      ...c,
      children: buildChapterTree(chapters, c.id),
    }));
}

/**
 * 更新章节内容
 */
export async function updateChapterContent(
  chapterId: number,
  content: string,
  userId: number
) {
  const [chapter] = await db
    .select()
    .from(schemeChapters)
    .where(eq(schemeChapters.id, chapterId))
    .limit(1);

  if (!chapter) {
    throw new Error('章节不存在');
  }

  const wordCount = content.length;

  await db
    .update(schemeChapters)
    .set({
      content,
      wordCount,
      isCompleted: wordCount > 0,
      completedAt: wordCount > 0 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schemeChapters.id, chapterId));

  // 更新方案统计
  await updateSchemeStats(chapter.schemeId);

  return true;
}

/**
 * 更新方案统计信息
 */
async function updateSchemeStats(schemeId: number) {
  const stats = await db
    .select({
      totalChapters: sql<number>`count(*)`,
      completedChapters: sql<number>`sum(case when is_completed then 1 else 0 end)`,
      wordCount: sql<number>`coalesce(sum(word_count), 0)`,
    })
    .from(schemeChapters)
    .where(eq(schemeChapters.schemeId, schemeId));

  const { totalChapters, completedChapters, wordCount } = stats[0];

  const progress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  await db
    .update(schemes)
    .set({
      totalChapters: Number(totalChapters),
      completedChapters: Number(completedChapters),
      wordCount: Number(wordCount),
      progress,
      updatedAt: new Date(),
    })
    .where(eq(schemes.id, schemeId));
}

// ============================================
// 标签服务
// ============================================

/**
 * 获取热门标签
 */
export async function getPopularTags(limit: number = 20) {
  const tags = await db
    .select()
    .from(schemeTags)
    .orderBy(desc(schemeTags.usageCount))
    .limit(limit);

  return tags;
}

// ============================================
// 导出服务
// ============================================

/**
 * 导出方案为文本
 */
export async function exportSchemeAsText(schemeId: number): Promise<string> {
  const scheme = await getSchemeById(schemeId);
  if (!scheme) {
    throw new Error('方案不存在');
  }

  let content = `# ${scheme.name}\n\n`;
  if (scheme.description) {
    content += `${scheme.description}\n\n`;
  }

  // 遍历章节
  const exportChapter = (chapters: any[], level: number = 1): string => {
    let text = '';
    for (const chapter of chapters) {
      const prefix = '#'.repeat(level + 1);
      text += `${prefix} ${chapter.title}\n\n`;
      if (chapter.content) {
        text += `${chapter.content}\n\n`;
      }
      if (chapter.children && chapter.children.length > 0) {
        text += exportChapter(chapter.children, level + 1);
      }
    }
    return text;
  };

  content += exportChapter(scheme.chapters);

  return content;
}

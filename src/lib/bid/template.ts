/**
 * 标书模板服务
 * 提供模板管理功能
 */

import { db } from '@/db';
import { bidTemplates, bidChapters } from '@/db/schema';
import { eq, like, or, desc } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface TemplateStructure {
  chapters: Array<{
    serialNumber?: string;
    title: string;
    type?: string;
    level: number;
    isRequired: boolean;
    children?: TemplateStructure['chapters'];
  }>;
}

// ============================================
// 模板服务
// ============================================

/**
 * 获取模板列表
 */
export async function getTemplates(params?: {
  category?: string;
  industry?: string;
  isActive?: boolean;
  search?: string;
}): Promise<typeof bidTemplates.$inferSelect[]> {
  const _query = db.select().from(bidTemplates);

  const conditions = [];

  if (params?.isActive !== undefined) {
    conditions.push(eq(bidTemplates.isActive, params.isActive));
  }

  if (params?.category) {
    conditions.push(eq(bidTemplates.category, params.category));
  }

  if (params?.industry) {
    conditions.push(eq(bidTemplates.industry, params.industry));
  }

  if (params?.search) {
    conditions.push(
      or(
        like(bidTemplates.name, `%${params.search}%`),
        like(bidTemplates.description, `%${params.search}%`)
      )
    );
  }

  const templates = await db
    .select()
    .from(bidTemplates)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(bidTemplates.useCount));

  return templates;
}

/**
 * 获取模板详情
 */
export async function getTemplateDetail(
  templateId: number
): Promise<typeof bidTemplates.$inferSelect | null> {
  const templates = await db
    .select()
    .from(bidTemplates)
    .where(eq(bidTemplates.id, templateId))
    .limit(1);

  return templates.length > 0 ? templates[0] : null;
}

/**
 * 根据代码获取模板
 */
export async function getTemplateByCode(
  code: string
): Promise<typeof bidTemplates.$inferSelect | null> {
  const templates = await db
    .select()
    .from(bidTemplates)
    .where(eq(bidTemplates.code, code))
    .limit(1);

  return templates.length > 0 ? templates[0] : null;
}

/**
 * 创建模板
 */
export async function createTemplate(params: {
  name: string;
  code: string;
  category?: string;
  industry?: string;
  description?: string;
  content?: TemplateStructure;
  isSystem?: boolean;
  createdBy: number;
}): Promise<number> {
  const [template] = await db
    .insert(bidTemplates)
    .values({
      name: params.name,
      code: params.code,
      category: params.category || null,
      industry: params.industry || null,
      description: params.description || null,
      content: params.content ? JSON.stringify(params.content) : null,
      isSystem: params.isSystem || false,
      isActive: true,
      useCount: 0,
      createdBy: params.createdBy,
    })
    .returning();

  return template.id;
}

/**
 * 更新模板
 */
export async function updateTemplate(
  templateId: number,
  params: {
    name?: string;
    category?: string;
    industry?: string;
    description?: string;
    content?: TemplateStructure;
    isActive?: boolean;
  }
): Promise<void> {
  const updateData: Record<string, any> = {};

  if (params.name !== undefined) updateData.name = params.name;
  if (params.category !== undefined) updateData.category = params.category;
  if (params.industry !== undefined) updateData.industry = params.industry;
  if (params.description !== undefined) updateData.description = params.description;
  if (params.content !== undefined) updateData.content = JSON.stringify(params.content);
  if (params.isActive !== undefined) updateData.isActive = params.isActive;

  await db.update(bidTemplates).set(updateData).where(eq(bidTemplates.id, templateId));
}

/**
 * 删除模板
 */
export async function deleteTemplate(templateId: number): Promise<void> {
  // 检查是否是系统模板
  const template = await getTemplateDetail(templateId);
  if (template?.isSystem) {
    throw new Error('系统模板不能删除');
  }

  await db.delete(bidTemplates).where(eq(bidTemplates.id, templateId));
}

/**
 * 应用模板到文档
 */
export async function applyTemplateToDocument(
  templateId: number,
  documentId: number
): Promise<void> {
  const template = await getTemplateDetail(templateId);
  if (!template || !template.content) {
    throw new Error('模板不存在或内容为空');
  }

  const structure = JSON.parse(template.content) as TemplateStructure;

  // 递归创建章节
  async function createChapters(
    chapters: TemplateStructure['chapters'],
    parentId?: number
  ): Promise<void> {
    for (let i = 0; i < chapters.length; i++) {
      const chapterData = chapters[i];

      const [chapter] = await db
        .insert(bidChapters)
        .values({
          documentId,
          parentId: parentId || null,
          serialNumber: chapterData.serialNumber || null,
          title: chapterData.title,
          type: (chapterData.type as 'cover' | 'toc' | 'business' | 'technical' | 'qualification' | 'price' | 'appendix') || null,
          level: chapterData.level,
          sortOrder: i + 1,
          isRequired: chapterData.isRequired,
          isCompleted: false,
        })
        .returning();

      // 递归创建子章节
      if (chapterData.children && chapterData.children.length > 0) {
        await createChapters(chapterData.children, chapter.id);
      }
    }
  }

  await createChapters(structure.chapters);

  // 更新模板使用次数
  await db
    .update(bidTemplates)
    .set({
      useCount: template.useCount + 1,
    })
    .where(eq(bidTemplates.id, templateId));
}

/**
 * 从文档创建模板
 */
export async function createTemplateFromDocument(
  documentId: number,
  params: {
    name: string;
    code: string;
    category?: string;
    industry?: string;
    description?: string;
    createdBy: number;
  }
): Promise<number> {
  // 获取文档所有章节
  const chapters = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId))
    .orderBy(bidChapters.sortOrder);

  // 构建章节树结构
  function buildChapterTree(parentId: number | null): TemplateStructure['chapters'] {
    return chapters
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        serialNumber: c.serialNumber || undefined,
        title: c.title,
        type: c.type || undefined,
        level: c.level,
        isRequired: c.isRequired,
        children: buildChapterTree(c.id),
      }));
  }

  const structure: TemplateStructure = {
    chapters: buildChapterTree(null),
  };

  return createTemplate({
    ...params,
    content: structure,
    isSystem: false,
  });
}

/**
 * 获取模板分类列表
 */
export async function getTemplateCategories(): Promise<string[]> {
  const templates = await db
    .select({ category: bidTemplates.category })
    .from(bidTemplates)
    .where(eq(bidTemplates.isActive, true));

  const categories = new Set<string>();
  templates.forEach((t) => {
    if (t.category) categories.add(t.category);
  });

  return Array.from(categories);
}

/**
 * 获取行业列表
 */
export async function getIndustries(): Promise<string[]> {
  const templates = await db
    .select({ industry: bidTemplates.industry })
    .from(bidTemplates)
    .where(eq(bidTemplates.isActive, true));

  const industries = new Set<string>();
  templates.forEach((t) => {
    if (t.industry) industries.add(t.industry);
  });

  return Array.from(industries);
}

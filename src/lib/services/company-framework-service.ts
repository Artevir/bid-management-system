/**
 * 公司文档框架服务层
 * 管理公司的文档框架模板，支持创建、查询、更新、删除
 */

import { db } from '@/db';
import {
  companyDocumentFrameworks,
  companyFrameworkChapters,
  companies,
  files as _files,
  users,
} from '@/db/schema';
import { and, eq, inArray, desc, isNull as _isNull, asc } from 'drizzle-orm';
import type {
  CompanyDocumentFramework,
  NewCompanyDocumentFramework as _NewCompanyDocumentFramework,
  CompanyFrameworkChapter,
  NewCompanyFrameworkChapter as _NewCompanyFrameworkChapter,
} from '@/db/schema';

// ============================================
// 类型定义
// ============================================

export interface FrameworkChapterWithChildren extends CompanyFrameworkChapter {
  children?: FrameworkChapterWithChildren[];
}

export interface FrameworkWithChapters extends CompanyDocumentFramework {
  chapters: FrameworkChapterWithChildren[];
  company?: {
    id: number;
    name: string;
  };
  creator?: {
    id: number;
    name: string;
  };
}

export interface CreateFrameworkData {
  companyId: number;
  name: string;
  description?: string;
  documentType: string;
  sourceType?: 'manual' | 'manual_upload' | 'ai_generated';
  sourceFileId?: number;
  isDefault?: boolean;
  chapters: CreateChapterData[];
}

export interface CreateChapterData {
  title: string;
  titleNumber?: string;
  level: number;
  order: number;
  parentId?: number;
  isRequired?: boolean;
  description?: string;
  contentTemplate?: string;
  children?: CreateChapterData[];
}

// ============================================
// 公司文档框架服务
// ============================================

export const companyFrameworkService = {
  /**
   * 创建公司文档框架
   */
  async createFramework(
    data: CreateFrameworkData,
    userId: number
  ): Promise<FrameworkWithChapters> {
    // 如果设置为默认，先取消该公司同类型其他默认框架
    if (data.isDefault) {
      await db
        .update(companyDocumentFrameworks)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(companyDocumentFrameworks.companyId, data.companyId),
            eq(companyDocumentFrameworks.documentType, data.documentType),
            eq(companyDocumentFrameworks.isDefault, true)
          )
        );
    }

    // 创建框架
    const [framework] = await db
      .insert(companyDocumentFrameworks)
      .values({
        companyId: data.companyId,
        name: data.name,
        description: data.description || null,
        documentType: data.documentType,
        sourceType: data.sourceType || 'manual',
        sourceFileId: data.sourceFileId || null,
        isDefault: data.isDefault || false,
        isActive: true,
        createdBy: userId,
      })
      .returning();

    // 创建章节
    if (data.chapters && data.chapters.length > 0) {
      await this.createChaptersRecursive(framework.id, data.chapters, null);
    }

    // 返回完整框架
    const result = await this.getFrameworkById(framework.id);
    if (!result) {
      throw new Error('创建框架失败');
    }
    return result;
  },

  /**
   * 递归创建章节
   */
  async createChaptersRecursive(
    frameworkId: number,
    chapters: CreateChapterData[],
    parentId: number | null
  ): Promise<void> {
    for (const chapter of chapters) {
      const [created] = await db
        .insert(companyFrameworkChapters)
        .values({
          frameworkId,
          parentId,
          level: chapter.level,
          order: chapter.order,
          title: chapter.title,
          titleNumber: chapter.titleNumber || null,
          isRequired: chapter.isRequired ?? true,
          description: chapter.description || null,
          contentTemplate: chapter.contentTemplate || null,
        })
        .returning();

      // 递归创建子章节
      if (chapter.children && chapter.children.length > 0) {
        await this.createChaptersRecursive(frameworkId, chapter.children, created.id);
      }
    }
  },

  /**
   * 获取框架详情
   */
  async getFrameworkById(id: number): Promise<FrameworkWithChapters | null> {
    const framework = await db
      .select()
      .from(companyDocumentFrameworks)
      .where(eq(companyDocumentFrameworks.id, id))
      .limit(1);

    if (!framework.length) return null;

    // 获取所有章节
    const chapters = await db
      .select()
      .from(companyFrameworkChapters)
      .where(eq(companyFrameworkChapters.frameworkId, id))
      .orderBy(asc(companyFrameworkChapters.level), asc(companyFrameworkChapters.order));

    // 构建树形结构
    const chapterTree = this.buildChapterTree(chapters);

    // 获取关联信息
    const [companyInfo] = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.id, framework[0].companyId))
      .limit(1);

    const [creatorInfo] = await db
      .select({ id: users.id, name: users.realName })
      .from(users)
      .where(eq(users.id, framework[0].createdBy))
      .limit(1);

    return {
      ...framework[0],
      chapters: chapterTree,
      company: companyInfo,
      creator: creatorInfo,
    };
  },

  /**
   * 构建章节树形结构
   */
  buildChapterTree(chapters: CompanyFrameworkChapter[]): FrameworkChapterWithChildren[] {
    const chapterMap = new Map<number, FrameworkChapterWithChildren>();
    const rootChapters: FrameworkChapterWithChildren[] = [];

    // 第一遍：创建所有节点
    chapters.forEach((chapter) => {
      chapterMap.set(chapter.id, { ...chapter, children: [] });
    });

    // 第二遍：构建树形结构
    chapters.forEach((chapter) => {
      const node = chapterMap.get(chapter.id)!;
      if (chapter.parentId === null) {
        rootChapters.push(node);
      } else {
        const parent = chapterMap.get(chapter.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      }
    });

    return rootChapters;
  },

  /**
   * 获取公司的所有文档框架
   */
  async getFrameworksByCompany(
    companyId: number,
    documentType?: string
  ): Promise<CompanyDocumentFramework[]> {
    const conditions = [eq(companyDocumentFrameworks.companyId, companyId)];

    if (documentType) {
      conditions.push(eq(companyDocumentFrameworks.documentType, documentType));
    }

    return await db
      .select()
      .from(companyDocumentFrameworks)
      .where(and(...conditions))
      .orderBy(desc(companyDocumentFrameworks.isDefault), desc(companyDocumentFrameworks.createdAt));
  },

  /**
   * 获取公司的默认框架
   */
  async getDefaultFramework(
    companyId: number,
    documentType: string
  ): Promise<FrameworkWithChapters | null> {
    const framework = await db
      .select()
      .from(companyDocumentFrameworks)
      .where(
        and(
          eq(companyDocumentFrameworks.companyId, companyId),
          eq(companyDocumentFrameworks.documentType, documentType),
          eq(companyDocumentFrameworks.isDefault, true),
          eq(companyDocumentFrameworks.isActive, true)
        )
      )
      .limit(1);

    if (!framework.length) return null;

    return await this.getFrameworkById(framework[0].id);
  },

  /**
   * 更新框架基本信息
   */
  async updateFramework(
    id: number,
    data: Partial<{
      name: string;
      description: string;
      documentType: string;
      isDefault: boolean;
      isActive: boolean;
    }>
  ): Promise<CompanyDocumentFramework> {
    if (data.isDefault) {
      // 获取当前框架信息
      const [current] = await db
        .select()
        .from(companyDocumentFrameworks)
        .where(eq(companyDocumentFrameworks.id, id))
        .limit(1);

      if (current) {
        // 取消同类型其他默认框架
        await db
          .update(companyDocumentFrameworks)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(companyDocumentFrameworks.companyId, current.companyId),
              eq(companyDocumentFrameworks.documentType, current.documentType),
              eq(companyDocumentFrameworks.isDefault, true)
            )
          );
      }
    }

    const [updated] = await db
      .update(companyDocumentFrameworks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(companyDocumentFrameworks.id, id))
      .returning();

    return updated;
  },

  /**
   * 删除框架（级联删除章节）
   */
  async deleteFramework(id: number): Promise<void> {
    // 先删除所有章节
    await db
      .delete(companyFrameworkChapters)
      .where(eq(companyFrameworkChapters.frameworkId, id));

    // 再删除框架
    await db.delete(companyDocumentFrameworks).where(eq(companyDocumentFrameworks.id, id));
  },

  /**
   * 更新框架章节（全量替换）
   */
  async updateChapters(
    frameworkId: number,
    chapters: CreateChapterData[]
  ): Promise<void> {
    // 删除现有章节
    await db
      .delete(companyFrameworkChapters)
      .where(eq(companyFrameworkChapters.frameworkId, frameworkId));

    // 创建新章节
    if (chapters && chapters.length > 0) {
      await this.createChaptersRecursive(frameworkId, chapters, null);
    }
  },

  /**
   * 从招标文件解读结果导入框架
   */
  async importFromTenderInterpretation(
    companyId: number,
    projectName: string,
    interpretationData: {
      documentFramework?: Array<{
        title: string;
        titleNumber?: string;
        children?: Array<{
          title: string;
          titleNumber?: string;
          children?: Array<{
            title: string;
            titleNumber?: string;
          }>;
        }>;
      }>;
    },
    userId: number
  ): Promise<FrameworkWithChapters> {
    // 转换框架数据
    const convertChapters = (
      items: any[],
      level: number,
      startOrder: number = 0
    ): CreateChapterData[] => {
      return items.map((item, index) => ({
        title: item.title,
        titleNumber: item.titleNumber,
        level,
        order: startOrder + index,
        isRequired: true,
        children: item.children ? convertChapters(item.children, level + 1) : undefined,
      }));
    };

    const chapters = interpretationData.documentFramework
      ? convertChapters(interpretationData.documentFramework, 1)
      : [];

    return await this.createFramework(
      {
        companyId,
        name: `${projectName} - 招标文件框架`,
        description: '从招标文件解读结果导入的文档框架',
        documentType: '投标文件',
        sourceType: 'ai_generated',
        isDefault: false,
        chapters,
      },
      userId
    );
  },

  /**
   * 批量获取多个框架（用于合并）
   */
  async getFrameworksByIds(ids: number[]): Promise<FrameworkWithChapters[]> {
    if (!ids.length) return [];

    const frameworks = await db
      .select()
      .from(companyDocumentFrameworks)
      .where(inArray(companyDocumentFrameworks.id, ids));

    const result: FrameworkWithChapters[] = [];

    for (const framework of frameworks) {
      const detail = await this.getFrameworkById(framework.id);
      if (detail) {
        result.push(detail);
      }
    }

    return result;
  },
};

export default companyFrameworkService;

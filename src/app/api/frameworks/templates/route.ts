/**
 * 章节模板API
 * 提供章节模板的动态管理和应用功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { chapterTemplateCategories, chapterTemplates, docFrameworkChapters, docFrameworks } from '@/db/schema';
import { eq, asc, count } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取模板分类或模板列表
// ============================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const templateId = searchParams.get('templateId');

  try {
    // 返回特定模板详情
    if (templateId) {
      const [template] = await db
        .select()
        .from(chapterTemplates)
        .where(eq(chapterTemplates.id, parseInt(templateId)));

      if (!template) {
        return NextResponse.json({ error: '模板不存在' }, { status: 404 });
      }

      // 解析children配置
      let children = null;
      if (template.childrenConfig) {
        try {
          children = JSON.parse(template.childrenConfig);
        } catch (e) {
          // 忽略解析错误
        }
      }

      return NextResponse.json({
        template: {
          ...template,
          placeholders: template.placeholders ? JSON.parse(template.placeholders) : [],
          children,
        },
      });
    }

    // 返回分类模板列表
    if (category) {
      const categoryRecord = await db
        .select()
        .from(chapterTemplateCategories)
        .where(eq(chapterTemplateCategories.code, category));

      if (!categoryRecord[0]) {
        return NextResponse.json({ error: '分类不存在' }, { status: 404 });
      }

      const templates = await db
        .select()
        .from(chapterTemplates)
        .where(eq(chapterTemplates.categoryId, categoryRecord[0].id))
        .orderBy(asc(chapterTemplates.sortOrder));

      return NextResponse.json({
        category: categoryRecord[0],
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          level: t.level,
          contentType: t.contentType || 'text',
          required: t.required || false,
          hasChildren: t.hasChildren || false,
          hasPlaceholders: !!(t.placeholders && t.placeholders.length > 0),
          description: t.description,
        })),
      });
    }

    // 返回所有模板分类
    const categories = await db
      .select({
        id: chapterTemplateCategories.id,
        name: chapterTemplateCategories.name,
        code: chapterTemplateCategories.code,
        description: chapterTemplateCategories.description,
        icon: chapterTemplateCategories.icon,
        color: chapterTemplateCategories.color,
        sortOrder: chapterTemplateCategories.sortOrder,
        isActive: chapterTemplateCategories.isActive,
        templateCount: count(chapterTemplates.id),
      })
      .from(chapterTemplateCategories)
      .leftJoin(chapterTemplates, eq(chapterTemplateCategories.id, chapterTemplates.categoryId))
      .where(eq(chapterTemplateCategories.isActive, true))
      .groupBy(chapterTemplateCategories.id)
      .orderBy(asc(chapterTemplateCategories.sortOrder));

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.code, // 使用code作为前端id
        name: c.name,
        description: c.description,
        icon: c.icon,
        color: c.color,
        count: c.templateCount || 0,
      })),
    });
  } catch (error) {
    console.error('获取模板失败:', error);
    return NextResponse.json({ error: '获取模板失败' }, { status: 500 });
  }
}

// ============================================
// POST: 应用模板到框架
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { frameworkId, templateId, parentId, position } = body;

    if (!frameworkId || !templateId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证框架存在
    const [framework] = await db
      .select()
      .from(docFrameworks)
      .where(eq(docFrameworks.id, frameworkId));

    if (!framework) {
      return NextResponse.json({ error: '框架不存在' }, { status: 404 });
    }

    // 获取模板
    const [template] = await db
      .select()
      .from(chapterTemplates)
      .where(eq(chapterTemplates.id, templateId));

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 获取当前最大序列号
    const existingChapters = await db
      .select()
      .from(docFrameworkChapters)
      .where(eq(docFrameworkChapters.frameworkId, frameworkId))
      .orderBy(asc(docFrameworkChapters.sequence));

    let baseSequence = position !== undefined ? position : existingChapters.length;

    // 创建章节
    const createdChapters: any[] = [];

    // 创建主章节
    const [mainChapter] = await db
      .insert(docFrameworkChapters)
      .values({
        frameworkId,
        title: template.name,
        level: template.level,
        sequence: baseSequence,
        parentId: parentId || null,
        chapterCode: generateChapterCode(template.level, baseSequence + 1),
        contentType: template.contentType || 'text',
        required: template.required || false,
        contentTemplate: template.contentTemplate || '',
        isPlaceholder: !!(template.placeholders && template.placeholders.length > 0),
        placeholderHint: template.placeholders,
      })
      .returning();

    createdChapters.push(mainChapter);

    // 创建子章节
    if (template.childrenConfig) {
      try {
        const children = JSON.parse(template.childrenConfig);
        if (children && children.length > 0) {
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const [childChapter] = await db
              .insert(docFrameworkChapters)
              .values({
                frameworkId,
                title: child.name,
                level: child.level,
                sequence: baseSequence + i + 1,
                parentId: mainChapter.id,
                chapterCode: `${mainChapter.chapterCode}.${i + 1}`,
                contentType: 'text',
                contentTemplate: child.template || '',
              })
              .returning();

            createdChapters.push(childChapter);
          }
        }
      } catch (e) {
        console.error('解析子章节配置失败:', e);
      }
    }

    // 更新模板使用次数
    await db
      .update(chapterTemplates)
      .set({ useCount: (template.useCount || 0) + 1 })
      .where(eq(chapterTemplates.id, templateId));

    return NextResponse.json({
      success: true,
      message: '模板应用成功',
      chapters: createdChapters,
    });
  } catch (error) {
    console.error('应用模板失败:', error);
    return NextResponse.json({ error: '应用模板失败' }, { status: 500 });
  }
}

// ============================================
// PUT: 创建新模板
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const {
      categoryId,
      name,
      code,
      description,
      level = 1,
      contentType = 'text',
      required = false,
      contentTemplate,
      placeholders,
      hasChildren = false,
      childrenConfig,
    } = body;

    if (!categoryId || !name) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 获取分类
    const [category] = await db
      .select()
      .from(chapterTemplateCategories)
      .where(eq(chapterTemplateCategories.id, categoryId));

    if (!category) {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }

    // 创建模板
    const [template] = await db
      .insert(chapterTemplates)
      .values({
        categoryId,
        name,
        code: code || `template-${Date.now()}`,
        description,
        level,
        contentType,
        required,
        contentTemplate,
        placeholders: placeholders ? JSON.stringify(placeholders) : null,
        hasChildren,
        childrenConfig: childrenConfig ? JSON.stringify(childrenConfig) : null,
        createdBy: Number(currentUser.id),
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: '模板创建成功',
      template,
    });
  } catch (error) {
    console.error('创建模板失败:', error);
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 });
  }
}

// ============================================
// 生成章节编码
// ============================================

function generateChapterCode(level: number, index: number): string {
  return index.toString();
}

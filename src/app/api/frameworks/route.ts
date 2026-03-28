/**
 * 文档框架管理API
 * 支持框架的增删改查、配置管理
 * 支持系统框架与公司专属框架
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { docFrameworks, docFrameworkChapters, users, companies } from '@/db/schema';
import { eq, like, desc, asc, and, or, inArray, isNull, sql, isNotNull } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取框架列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId');
    const scope = searchParams.get('scope'); // 'all' | 'system' | 'company'
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const conditions: any[] = [];
    
    if (keyword) {
      conditions.push(
        or(
          like(docFrameworks.name, `%${keyword}%`),
          like(docFrameworks.code, `%${keyword}%`),
          like(docFrameworks.description, `%${keyword}%`)
        )
      );
    }
    
    if (category && category !== 'all') {
      conditions.push(eq(docFrameworks.category, category));
    }
    
    if (status && status !== 'all') {
      conditions.push(eq(docFrameworks.status, status));
    }

    // 作用域筛选
    if (scope === 'system') {
      conditions.push(eq(docFrameworks.isSystem, true));
    } else if (scope === 'company') {
      conditions.push(isNotNull(docFrameworks.companyId));
    }

    // 公司筛选
    if (companyId && companyId !== 'all') {
      conditions.push(eq(docFrameworks.companyId, parseInt(companyId)));
    }

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(docFrameworks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = countResult[0]?.count || 0;

    // 获取框架列表
    const frameworks = await db
      .select({
        id: docFrameworks.id,
        name: docFrameworks.name,
        code: docFrameworks.code,
        description: docFrameworks.description,
        category: docFrameworks.category,
        status: docFrameworks.status,
        version: docFrameworks.version,
        isSystem: docFrameworks.isSystem,
        isDefault: docFrameworks.isDefault,
        companyId: docFrameworks.companyId,
        createdAt: docFrameworks.createdAt,
        updatedAt: docFrameworks.updatedAt,
        createdBy: docFrameworks.createdBy,
        creator: {
          id: users.id,
          username: users.username,
          realName: users.realName,
        },
        company: {
          id: companies.id,
          name: companies.name,
        },
      })
      .from(docFrameworks)
      .leftJoin(users, eq(docFrameworks.createdBy, users.id))
      .leftJoin(companies, eq(docFrameworks.companyId, companies.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(docFrameworks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // 获取每个框架的章节数量
    const frameworksWithCount = await Promise.all(
      frameworks.map(async (framework) => {
        const chapters = await db
          .select({ count: sql<number>`count(*)` })
          .from(docFrameworkChapters)
          .where(eq(docFrameworkChapters.frameworkId, framework.id));
        
        return {
          ...framework,
          chapterCount: chapters[0]?.count || 0,
        };
      })
    );

    return NextResponse.json({ 
      items: frameworksWithCount,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('获取框架列表失败:', error);
    return NextResponse.json(
      { error: '获取框架列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建框架
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
      category,
      companyId,
      isDefault,
      coverConfig,
      titlePageConfig,
      headerConfig,
      footerConfig,
      tocConfig,
      bodyConfig,
      chapters, // 可选：同时创建章节
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
        .from(docFrameworks)
        .where(eq(docFrameworks.code, code));
      
      if (existing.length > 0) {
        return NextResponse.json(
          { error: '框架代码已存在' },
          { status: 400 }
        );
      }
    }

    // 如果设为默认框架，先清除该公司其他默认框架
    if (isDefault && companyId) {
      await db
        .update(docFrameworks)
        .set({ isDefault: false })
        .where(eq(docFrameworks.companyId, parseInt(companyId)));
    }

    // 创建框架
    const [framework] = await db
      .insert(docFrameworks)
      .values({
        name,
        code: code || `fw_${Date.now()}`,
        description,
        category: category || 'general',
        companyId: companyId ? parseInt(companyId) : null,
        isDefault: isDefault || false,
        coverConfig: coverConfig ? JSON.stringify(coverConfig) : '{}',
        titlePageConfig: titlePageConfig ? JSON.stringify(titlePageConfig) : '{}',
        headerConfig: headerConfig ? JSON.stringify(headerConfig) : '{}',
        footerConfig: footerConfig ? JSON.stringify(footerConfig) : '{}',
        tocConfig: tocConfig ? JSON.stringify(tocConfig) : '{}',
        bodyConfig: bodyConfig ? JSON.stringify(bodyConfig) : '{}',
        createdBy: currentUser.userId,
      })
      .returning();

    // 如果提供了章节，批量创建
    if (chapters && Array.isArray(chapters) && chapters.length > 0) {
      await db.insert(docFrameworkChapters).values(
        chapters.map((ch: any) => ({
          frameworkId: framework.id,
          title: ch.title,
          level: ch.level || 1,
          sequence: ch.sequence || 0,
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
      );
    }

    return NextResponse.json({ item: framework });
  } catch (error) {
    console.error('创建框架失败:', error);
    return NextResponse.json(
      { error: '创建框架失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新框架
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
      description, 
      category,
      status,
      companyId,
      isDefault,
      coverConfig,
      titlePageConfig,
      headerConfig,
      footerConfig,
      tocConfig,
      bodyConfig,
      createVersion,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少框架ID' },
        { status: 400 }
      );
    }

    // 检查框架是否存在
    const [existing] = await db
      .select()
      .from(docFrameworks)
      .where(eq(docFrameworks.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: '框架不存在' },
        { status: 404 }
      );
    }

    // 系统框架不可修改
    if (existing.isSystem) {
      return NextResponse.json(
        { error: '系统内置框架不可修改' },
        { status: 400 }
      );
    }

    // 如果设为默认框架，先清除该公司其他默认框架
    if (isDefault && companyId) {
      await db
        .update(docFrameworks)
        .set({ isDefault: false })
        .where(eq(docFrameworks.companyId, parseInt(companyId)));
    }

    // 更新框架
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) updateData.status = status;
    if (companyId !== undefined) updateData.companyId = companyId ? parseInt(companyId) : null;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (coverConfig !== undefined) updateData.coverConfig = JSON.stringify(coverConfig);
    if (titlePageConfig !== undefined) updateData.titlePageConfig = JSON.stringify(titlePageConfig);
    if (headerConfig !== undefined) updateData.headerConfig = JSON.stringify(headerConfig);
    if (footerConfig !== undefined) updateData.footerConfig = JSON.stringify(footerConfig);
    if (tocConfig !== undefined) updateData.tocConfig = JSON.stringify(tocConfig);
    if (bodyConfig !== undefined) updateData.bodyConfig = JSON.stringify(bodyConfig);

    // 如果需要创建新版本
    if (createVersion) {
      updateData.version = (existing.version ?? 0) + 1;
    }

    const [updated] = await db
      .update(docFrameworks)
      .set(updateData)
      .where(eq(docFrameworks.id, id))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('更新框架失败:', error);
    return NextResponse.json(
      { error: '更新框架失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除框架
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
        { error: '缺少框架ID' },
        { status: 400 }
      );
    }

    const frameworkId = parseInt(id);

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

    // 系统框架不可删除
    if (framework.isSystem) {
      return NextResponse.json(
        { error: '系统内置框架不能删除' },
        { status: 400 }
      );
    }

    // 删除框架（级联删除章节）
    await db
      .delete(docFrameworks)
      .where(eq(docFrameworks.id, frameworkId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除框架失败:', error);
    return NextResponse.json(
      { error: '删除框架失败' },
      { status: 500 }
    );
  }
}

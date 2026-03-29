/**
 * 文档框架实例API
 * 基于框架生成具体文档实例
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  docFrameworkInstances, 
  docFrameworkChapters, 
  docFrameworkContents,
  docFrameworks,
  projects,
  bidDocuments,
} from '@/db/schema';
import { eq, and, asc, inArray as _inArray, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取实例列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const frameworkId = searchParams.get('frameworkId');
    const projectId = searchParams.get('projectId');
    const bidDocumentId = searchParams.get('bidDocumentId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const conditions: any[] = [];
    
    if (frameworkId) {
      conditions.push(eq(docFrameworkInstances.frameworkId, parseInt(frameworkId)));
    }
    
    if (projectId) {
      conditions.push(eq(docFrameworkInstances.projectId, parseInt(projectId)));
    }
    
    if (bidDocumentId) {
      conditions.push(eq(docFrameworkInstances.bidDocumentId, parseInt(bidDocumentId)));
    }
    
    if (status && status !== 'all') {
      conditions.push(eq(docFrameworkInstances.status, status));
    }

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(docFrameworkInstances)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = countResult[0]?.count || 0;

    // 获取实例列表
    const instances = await db
      .select({
        id: docFrameworkInstances.id,
        name: docFrameworkInstances.name,
        status: docFrameworkInstances.status,
        totalChapters: docFrameworkInstances.totalChapters,
        completedChapters: docFrameworkInstances.completedChapters,
        totalWords: docFrameworkInstances.totalWords,
        createdAt: docFrameworkInstances.createdAt,
        updatedAt: docFrameworkInstances.updatedAt,
        framework: {
          id: docFrameworks.id,
          name: docFrameworks.name,
          code: docFrameworks.code,
        },
        project: {
          id: projects.id,
          name: projects.name,
        },
        bidDocument: {
          id: bidDocuments.id,
          name: bidDocuments.name,
        },
      })
      .from(docFrameworkInstances)
      .leftJoin(docFrameworks, eq(docFrameworkInstances.frameworkId, docFrameworks.id))
      .leftJoin(projects, eq(docFrameworkInstances.projectId, projects.id))
      .leftJoin(bidDocuments, eq(docFrameworkInstances.bidDocumentId, bidDocuments.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(docFrameworkInstances.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return NextResponse.json({ 
      items: instances,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('获取实例列表失败:', error);
    return NextResponse.json(
      { error: '获取实例列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建实例
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      frameworkId,
      projectId,
      bidDocumentId,
      name,
      generateContents = false,
    } = body;

    if (!frameworkId || !name) {
      return NextResponse.json(
        { error: '缺少必填字段：frameworkId, name' },
        { status: 400 }
      );
    }

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

    // 获取框架的所有章节
    const chapters = await db
      .select()
      .from(docFrameworkChapters)
      .where(eq(docFrameworkChapters.frameworkId, frameworkId))
      .orderBy(asc(docFrameworkChapters.sequence));

    // 创建实例
    const [instance] = await db
      .insert(docFrameworkInstances)
      .values({
        frameworkId,
        projectId: projectId || null,
        bidDocumentId: bidDocumentId || null,
        name,
        status: 'draft',
        totalChapters: chapters.length,
        completedChapters: 0,
        totalWords: 0,
        createdBy: currentUser.userId,
      })
      .returning();

    // 创建章节内容记录
    if (chapters.length > 0) {
      await db.insert(docFrameworkContents).values(
        chapters.map(ch => ({
          instanceId: instance.id,
          chapterId: ch.id,
          content: null,
          wordCount: 0,
          status: 'pending',
          generatedByAI: false,
          generationPrompt: null,
        }))
      );
    }

    // 如果需要生成内容，触发AI生成流程
    if (generateContents && chapters.length > 0) {
      // TODO: 触发异步AI生成任务
      // 这里可以调用AI服务来生成章节内容
    }

    return NextResponse.json({ item: instance });
  } catch (error) {
    console.error('创建实例失败:', error);
    return NextResponse.json(
      { error: '创建实例失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新实例
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少实例ID' },
        { status: 400 }
      );
    }

    // 检查实例是否存在
    const [existing] = await db
      .select()
      .from(docFrameworkInstances)
      .where(eq(docFrameworkInstances.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: '实例不存在' },
        { status: 404 }
      );
    }

    // 更新实例
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (status !== undefined) updateData.status = status;

    const [updated] = await db
      .update(docFrameworkInstances)
      .set(updateData)
      .where(eq(docFrameworkInstances.id, id))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('更新实例失败:', error);
    return NextResponse.json(
      { error: '更新实例失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除实例
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
        { error: '缺少实例ID' },
        { status: 400 }
      );
    }

    const instanceId = parseInt(id);

    // 检查实例是否存在
    const [instance] = await db
      .select()
      .from(docFrameworkInstances)
      .where(eq(docFrameworkInstances.id, instanceId));

    if (!instance) {
      return NextResponse.json(
        { error: '实例不存在' },
        { status: 404 }
      );
    }

    // 删除实例（级联删除章节内容）
    await db
      .delete(docFrameworkInstances)
      .where(eq(docFrameworkInstances.id, instanceId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除实例失败:', error);
    return NextResponse.json(
      { error: '删除实例失败' },
      { status: 500 }
    );
  }
}

/**
 * 标书归档管理API
 * 支持归档的增删改查、自动归档等功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  bidArchives, 
  bidArchiveDocuments, 
  bidArchiveFiles,
  projects, 
  bidDocuments, 
  companies, 
  users 
} from '@/db/schema';
import { 
  eq, 
  like, 
  desc, 
  asc, 
  and, 
  or, 
  inArray, 
  isNull, 
  sql,
  count,
} from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取归档列表（按公司-项目层级组织）
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const projectId = searchParams.get('projectId');
    const bidResult = searchParams.get('bidResult');
    const keyword = searchParams.get('keyword');
    const view = searchParams.get('view') || 'tree'; // tree | list
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 树形视图：按公司-项目层级组织
    if (view === 'tree') {
      return await getArchiveTree(companyId, keyword);
    }

    // 列表视图：分页查询
    return await getArchiveList({
      companyId,
      projectId,
      bidResult,
      keyword,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('获取归档列表失败:', error);
    return NextResponse.json(
      { error: '获取归档列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建归档（手动归档）
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      projectId, 
      companyId,
      bidResult,
      summary,
      notes,
      documentIds, // 要归档的文档ID列表
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: '缺少必填字段：projectId' },
        { status: 400 }
      );
    }

    // 获取项目信息
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 }
      );
    }

    // 检查是否已归档
    const [existingArchive] = await db
      .select()
      .from(bidArchives)
      .where(eq(bidArchives.projectId, projectId));

    if (existingArchive) {
      return NextResponse.json(
        { error: '该项目已归档' },
        { status: 400 }
      );
    }

    // 获取公司信息
    let companyName = null;
    if (companyId) {
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId));
      companyName = company?.name || null;
    }

    // 创建归档记录
    const [archive] = await db
      .insert(bidArchives)
      .values({
        companyId: companyId || null,
        companyName,
        projectId,
        projectName: project.name,
        projectCode: project.code,
        tenderCode: project.tenderCode,
        tenderOrganization: project.tenderOrganization,
        tenderAgent: project.tenderAgent,
        budget: project.budget,
        archiveType: 'manual',
        bidResult: bidResult || 'pending',
        summary,
        notes,
        archivedBy: currentUser.userId,
      })
      .returning();

    // 归档文档
    if (documentIds && documentIds.length > 0) {
      const docs = await db
        .select()
        .from(bidDocuments)
        .where(inArray(bidDocuments.id, documentIds));

      for (const doc of docs) {
        await db.insert(bidArchiveDocuments).values({
          archiveId: archive.id,
          documentId: doc.id,
          documentName: doc.name,
          documentVersion: doc.version,
          documentStatus: doc.status,
          chapterCount: doc.totalChapters,
          wordCount: doc.wordCount,
        });
      }

      // 更新归档文档数量
      await db
        .update(bidArchives)
        .set({ documentCount: docs.length })
        .where(eq(bidArchives.id, archive.id));
    } else {
      // 默认归档项目下所有文档
      const docs = await db
        .select()
        .from(bidDocuments)
        .where(eq(bidDocuments.projectId, projectId));

      for (const doc of docs) {
        await db.insert(bidArchiveDocuments).values({
          archiveId: archive.id,
          documentId: doc.id,
          documentName: doc.name,
          documentVersion: doc.version,
          documentStatus: doc.status,
          chapterCount: doc.totalChapters,
          wordCount: doc.wordCount,
        });
      }

      // 更新归档文档数量
      await db
        .update(bidArchives)
        .set({ documentCount: docs.length })
        .where(eq(bidArchives.id, archive.id));
    }

    // 更新项目状态为已归档
    await db
      .update(projects)
      .set({ 
        status: 'archived',
        updatedAt: new Date() 
      })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ item: archive });
  } catch (error) {
    console.error('创建归档失败:', error);
    return NextResponse.json(
      { error: '创建归档失败' },
      { status: 500 }
    );
  }
}

// ============================================
// 辅助函数
// ============================================

async function getArchiveTree(companyId: string | null, keyword: string | null) {
  // 1. 获取所有公司
  const companyList = await db
    .select()
    .from(companies)
    .orderBy(asc(companies.name));

  // 2. 获取归档数据（按公司分组）
  const archivesQuery = db
    .select({
      id: bidArchives.id,
      projectId: bidArchives.projectId,
      projectName: bidArchives.projectName,
      projectCode: bidArchives.projectCode,
      tenderCode: bidArchives.tenderCode,
      tenderOrganization: bidArchives.tenderOrganization,
      archiveDate: bidArchives.archiveDate,
      bidResult: bidArchives.bidResult,
      documentCount: bidArchives.documentCount,
      companyId: bidArchives.companyId,
      companyName: bidArchives.companyName,
    })
    .from(bidArchives)
    .where(eq(bidArchives.archiveStatus, 'active'))
    .orderBy(desc(bidArchives.archiveDate));

  const archives = await archivesQuery;

  // 3. 按公司分组
  const tree: any[] = [];
  const companyMap = new Map<number, any>();

  // 先处理有公司的归档
  for (const company of companyList) {
    const companyArchives = archives.filter(a => a.companyId === company.id);
    if (companyArchives.length > 0) {
      const node = {
        type: 'company',
        id: company.id,
        name: company.name,
        shortName: company.shortName,
        archiveCount: companyArchives.length,
        children: groupByProject(companyArchives),
      };
      tree.push(node);
      companyMap.set(company.id, node);
    }
  }

  // 处理无公司的归档
  const noCompanyArchives = archives.filter(a => !a.companyId);
  if (noCompanyArchives.length > 0) {
    tree.push({
      type: 'company',
      id: 0,
      name: '未分配公司',
      shortName: '未分配',
      archiveCount: noCompanyArchives.length,
      children: groupByProject(noCompanyArchives),
    });
  }

  return NextResponse.json({ 
    tree,
    total: archives.length,
  });
}

function groupByProject(archives: any[]) {
  const projectMap = new Map<number, any>();

  for (const archive of archives) {
    if (!projectMap.has(archive.projectId)) {
      projectMap.set(archive.projectId, {
        type: 'project',
        id: archive.projectId,
        name: archive.projectName,
        code: archive.projectCode,
        tenderCode: archive.tenderCode,
        tenderOrganization: archive.tenderOrganization,
        archiveCount: 0,
        children: [],
      });
    }

    const project = projectMap.get(archive.projectId);
    project.archiveCount++;
    project.children.push({
      type: 'archive',
      id: archive.id,
      name: archive.projectName,
      archiveDate: archive.archiveDate,
      bidResult: archive.bidResult,
      documentCount: archive.documentCount,
    });
  }

  return Array.from(projectMap.values());
}

async function getArchiveList(params: {
  companyId: string | null;
  projectId: string | null;
  bidResult: string | null;
  keyword: string | null;
  page: number;
  pageSize: number;
}) {
  const { companyId, projectId, bidResult, keyword, page, pageSize } = params;

  const conditions: any[] = [eq(bidArchives.archiveStatus, 'active')];

  if (companyId && companyId !== 'all') {
    conditions.push(eq(bidArchives.companyId, parseInt(companyId)));
  }

  if (projectId) {
    conditions.push(eq(bidArchives.projectId, parseInt(projectId)));
  }

  if (bidResult && bidResult !== 'all') {
    conditions.push(eq(bidArchives.bidResult, bidResult as any));
  }

  if (keyword) {
    conditions.push(
      or(
        like(bidArchives.projectName, `%${keyword}%`),
        like(bidArchives.projectCode, `%${keyword}%`),
        like(bidArchives.tenderOrganization, `%${keyword}%`)
      )
    );
  }

  // 获取总数
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(bidArchives)
    .where(and(...conditions));

  const total = countResult[0]?.count || 0;

  // 获取列表
  const list = await db
    .select({
      id: bidArchives.id,
      projectId: bidArchives.projectId,
      projectName: bidArchives.projectName,
      projectCode: bidArchives.projectCode,
      tenderCode: bidArchives.tenderCode,
      tenderOrganization: bidArchives.tenderOrganization,
      tenderAgent: bidArchives.tenderAgent,
      budget: bidArchives.budget,
      archiveType: bidArchives.archiveType,
      archiveDate: bidArchives.archiveDate,
      bidResult: bidArchives.bidResult,
      documentCount: bidArchives.documentCount,
      fileCount: bidArchives.fileCount,
      summary: bidArchives.summary,
      companyId: bidArchives.companyId,
      companyName: bidArchives.companyName,
      archivedBy: bidArchives.archivedBy,
      createdAt: bidArchives.createdAt,
    })
    .from(bidArchives)
    .where(and(...conditions))
    .orderBy(desc(bidArchives.archiveDate))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return NextResponse.json({
    items: list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

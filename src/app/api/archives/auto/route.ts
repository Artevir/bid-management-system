/**
 * 自动归档API
 * 当项目状态变更为中标/未中标时自动触发归档
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  bidArchives, 
  bidArchiveDocuments,
  projects, 
  bidDocuments, 
  companies 
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// POST: 自动归档（项目完结时调用）
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, bidResult } = body;

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

    // 检查项目状态是否可以归档（已投标、中标、未中标）
    const archivableStatuses = ['submitted', 'awarded', 'lost'];
    if (!archivableStatuses.includes(project.status)) {
      return NextResponse.json(
        { error: '项目状态不允许归档' },
        { status: 400 }
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

    // 确定投标结果
    let archiveBidResult = bidResult || 'pending';
    if (project.status === 'awarded') {
      archiveBidResult = 'awarded';
    } else if (project.status === 'lost') {
      archiveBidResult = 'lost';
    }

    // 获取公司信息（从项目关联的公司获取，这里假设项目可能有关联公司）
    // 注：根据现有数据模型，项目通过 department 关联公司，这里简化处理
    let companyId = null;
    let companyName = null;

    // 创建归档记录
    const [archive] = await db
      .insert(bidArchives)
      .values({
        companyId,
        companyName,
        projectId,
        projectName: project.name,
        projectCode: project.code,
        tenderCode: project.tenderCode,
        tenderOrganization: project.tenderOrganization,
        tenderAgent: project.tenderAgent,
        budget: project.budget,
        archiveType: 'auto',
        bidResult: archiveBidResult,
        archivedBy: currentUser.userId,
      })
      .returning();

    // 归档项目下所有文档
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

    // 更新项目状态为已归档
    await db
      .update(projects)
      .set({ 
        status: 'archived',
        updatedAt: new Date() 
      })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ 
      item: archive,
      message: '自动归档成功' 
    });
  } catch (error) {
    console.error('自动归档失败:', error);
    return NextResponse.json(
      { error: '自动归档失败' },
      { status: 500 }
    );
  }
}

// ============================================
// GET: 检查项目是否需要归档
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: '缺少projectId参数' },
        { status: 400 }
      );
    }

    // 获取项目信息
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, parseInt(projectId)));

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
      .where(eq(bidArchives.projectId, parseInt(projectId)));

    // 检查是否需要归档
    const archivableStatuses = ['submitted', 'awarded', 'lost'];
    const needsArchive = archivableStatuses.includes(project.status) && !existingArchive;

    return NextResponse.json({
      needsArchive,
      projectStatus: project.status,
      alreadyArchived: !!existingArchive,
      archive: existingArchive || null,
    });
  } catch (error) {
    console.error('检查归档状态失败:', error);
    return NextResponse.json(
      { error: '检查归档状态失败' },
      { status: 500 }
    );
  }
}

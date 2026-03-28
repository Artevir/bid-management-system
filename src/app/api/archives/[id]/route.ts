/**
 * 单个归档操作API
 * 支持归档详情获取、更新、删除
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  bidArchives, 
  bidArchiveDocuments, 
  bidArchiveFiles,
  users 
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取归档详情
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const archiveId = parseInt(id);

    // 获取归档基本信息
    const [archive] = await db
      .select()
      .from(bidArchives)
      .where(eq(bidArchives.id, archiveId));

    if (!archive) {
      return NextResponse.json(
        { error: '归档不存在' },
        { status: 404 }
      );
    }

    // 获取归档文档
    const documents = await db
      .select()
      .from(bidArchiveDocuments)
      .where(eq(bidArchiveDocuments.archiveId, archiveId))
      .orderBy(desc(bidArchiveDocuments.createdAt));

    // 获取归档附件
    const files = await db
      .select({
        id: bidArchiveFiles.id,
        fileName: bidArchiveFiles.fileName,
        filePath: bidArchiveFiles.filePath,
        fileSize: bidArchiveFiles.fileSize,
        fileType: bidArchiveFiles.fileType,
        category: bidArchiveFiles.category,
        description: bidArchiveFiles.description,
        uploadedBy: bidArchiveFiles.uploadedBy,
        createdAt: bidArchiveFiles.createdAt,
        uploader: {
          id: users.id,
          realName: users.realName,
        },
      })
      .from(bidArchiveFiles)
      .leftJoin(users, eq(bidArchiveFiles.uploadedBy, users.id))
      .where(eq(bidArchiveFiles.archiveId, archiveId))
      .orderBy(desc(bidArchiveFiles.createdAt));

    return NextResponse.json({
      archive: {
        ...archive,
        documents,
        files,
      },
    });
  } catch (error) {
    console.error('获取归档详情失败:', error);
    return NextResponse.json(
      { error: '获取归档详情失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新归档信息
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const archiveId = parseInt(id);
    const body = await request.json();

    const { bidResult, summary, notes, companyId } = body;

    // 检查归档是否存在
    const [existing] = await db
      .select()
      .from(bidArchives)
      .where(eq(bidArchives.id, archiveId));

    if (!existing) {
      return NextResponse.json(
        { error: '归档不存在' },
        { status: 404 }
      );
    }

    // 更新归档
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (bidResult !== undefined) updateData.bidResult = bidResult;
    if (summary !== undefined) updateData.summary = summary;
    if (notes !== undefined) updateData.notes = notes;
    if (companyId !== undefined) updateData.companyId = companyId || null;

    const [updated] = await db
      .update(bidArchives)
      .set(updateData)
      .where(eq(bidArchives.id, archiveId))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('更新归档失败:', error);
    return NextResponse.json(
      { error: '更新归档失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除归档（软删除）
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const archiveId = parseInt(id);

    // 检查归档是否存在
    const [existing] = await db
      .select()
      .from(bidArchives)
      .where(eq(bidArchives.id, archiveId));

    if (!existing) {
      return NextResponse.json(
        { error: '归档不存在' },
        { status: 404 }
      );
    }

    // 软删除
    await db
      .update(bidArchives)
      .set({ 
        archiveStatus: 'deleted',
        updatedAt: new Date() 
      })
      .where(eq(bidArchives.id, archiveId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除归档失败:', error);
    return NextResponse.json(
      { error: '删除归档失败' },
      { status: 500 }
    );
  }
}

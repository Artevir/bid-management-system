/**
 * 归档附件管理API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bidArchiveFiles, bidArchives } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取归档附件列表
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const archiveId = parseInt(id);

    const files = await db
      .select()
      .from(bidArchiveFiles)
      .where(eq(bidArchiveFiles.archiveId, archiveId))
      .orderBy(desc(bidArchiveFiles.createdAt));

    return NextResponse.json({ items: files });
  } catch (error) {
    console.error('获取归档附件失败:', error);
    return NextResponse.json(
      { error: '获取归档附件失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 上传归档附件
// ============================================

export async function POST(
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

    const { fileName, filePath, fileSize, fileType, category, description } = body;

    if (!fileName || !filePath) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 创建附件记录
    const [file] = await db
      .insert(bidArchiveFiles)
      .values({
        archiveId,
        fileName,
        filePath,
        fileSize,
        fileType,
        category,
        description,
        uploadedBy: currentUser.userId,
      })
      .returning();

    // 更新归档文件数量
    const countResult = await db
      .select({ count: bidArchiveFiles.id })
      .from(bidArchiveFiles)
      .where(eq(bidArchiveFiles.archiveId, archiveId));

    await db
      .update(bidArchives)
      .set({ fileCount: countResult.length })
      .where(eq(bidArchives.id, archiveId));

    return NextResponse.json({ item: file });
  } catch (error) {
    console.error('上传归档附件失败:', error);
    return NextResponse.json(
      { error: '上传归档附件失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除归档附件
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
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: '缺少fileId参数' },
        { status: 400 }
      );
    }

    // 删除附件
    await db
      .delete(bidArchiveFiles)
      .where(eq(bidArchiveFiles.id, parseInt(fileId)));

    // 更新归档文件数量
    const countResult = await db
      .select({ count: bidArchiveFiles.id })
      .from(bidArchiveFiles)
      .where(eq(bidArchiveFiles.archiveId, archiveId));

    await db
      .update(bidArchives)
      .set({ fileCount: countResult.length })
      .where(eq(bidArchives.id, archiveId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除归档附件失败:', error);
    return NextResponse.json(
      { error: '删除归档附件失败' },
      { status: 500 }
    );
  }
}

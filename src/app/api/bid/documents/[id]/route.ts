/**
 * 标书文档详情API
 * GET: 获取文档详情
 * PUT: 更新文档信息
 * DELETE: 删除文档（默认移至回收站，permanent=true时物理删除）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { checkDocumentPermission } from '@/lib/auth/resource-permission';
import { moveToRecycleBin, permanentDelete } from '@/lib/recycle-bin/service';
import { db } from '@/db';
import { bidDocuments, bidChapters, recycleBin } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  getDocumentDetail,
  updateDocumentStatus,
} from '@/lib/bid/service';

// 获取文档详情
async function getDocument(
  request: NextRequest,
  userId: number,
  documentId: number
): Promise<NextResponse> {
  try {
    // 权限检查：读取文档
    const permissionResult = await checkDocumentPermission(userId, documentId, 'read');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权访问此文档' },
        { status: 403 }
      );
    }

    const document = await getDocumentDetail(documentId);

    if (!document) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    // 获取章节统计
    const chapters = await db
      .select()
      .from(bidChapters)
      .where(eq(bidChapters.documentId, documentId));

    const statistics = {
      totalChapters: chapters.length,
      completedChapters: chapters.filter((c) => c.isCompleted).length,
      byType: {} as Record<string, number>,
      byStatus: {
        completed: chapters.filter((c) => c.isCompleted).length,
        pending: chapters.filter((c) => !c.isCompleted).length,
      },
    };

    chapters.forEach((chapter) => {
      if (chapter.type) {
        statistics.byType[chapter.type] = (statistics.byType[chapter.type] || 0) + 1;
      }
    });

    return NextResponse.json({
      document,
      statistics,
    });
  } catch (error) {
    console.error('Get document detail error:', error);
    return NextResponse.json({ error: '获取文档详情失败' }, { status: 500 });
  }
}

// 更新文档
async function updateDocument(
  request: NextRequest,
  userId: number,
  documentId: number
): Promise<NextResponse> {
  try {
    // 权限检查：编辑文档
    const permissionResult = await checkDocumentPermission(userId, documentId, 'edit');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权编辑此文档' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, status, deadline } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name) updateData.name = name;
    if (status) updateData.status = status;
    if (deadline) updateData.deadline = new Date(deadline);

    await db
      .update(bidDocuments)
      .set(updateData)
      .where(eq(bidDocuments.id, documentId));

    return NextResponse.json({
      success: true,
      message: '文档更新成功',
    });
  } catch (error) {
    console.error('Update document error:', error);
    return NextResponse.json({ error: '更新文档失败' }, { status: 500 });
  }
}

// 删除文档
async function deleteDocument(
  request: NextRequest,
  userId: number,
  documentId: number
): Promise<NextResponse> {
  try {
    // 权限检查：删除文档
    const permissionResult = await checkDocumentPermission(userId, documentId, 'delete');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权删除此文档' },
        { status: 403 }
      );
    }

    // 检查文档状态
    const doc = await getDocumentDetail(documentId);
    if (!doc) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    if (doc.status === 'published') {
      return NextResponse.json({ error: '已发布的文档不能删除' }, { status: 400 });
    }

    // 检查是否请求物理删除
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';
    const confirmed = searchParams.get('confirmed') === 'true';

    if (permanent) {
      // 物理删除需要确认
      if (!confirmed) {
        return NextResponse.json({
          error: '请确认永久删除操作',
          requireConfirm: true,
          message: '永久删除后数据无法恢复，请添加 confirmed=true 参数确认删除',
        }, { status: 400 });
      }

      // 查找回收站记录
      const [recycleBinItem] = await db
        .select()
        .from(recycleBin)
        .where(
          and(
            eq(recycleBin.resourceType, 'document'),
            eq(recycleBin.resourceId, documentId),
            isNull(recycleBin.restoredAt)
          )
        )
        .limit(1);

      if (recycleBinItem) {
        // 从回收站永久删除
        const result = await permanentDelete(recycleBinItem.id, userId);
        if (!result.success) {
          return NextResponse.json({ error: result.message }, { status: 400 });
        }
      } else {
        // 直接物理删除（未在回收站的情况）
        await db.delete(bidChapters).where(eq(bidChapters.documentId, documentId));
        await db.delete(bidDocuments).where(eq(bidDocuments.id, documentId));
      }

      return NextResponse.json({
        success: true,
        message: '文档已永久删除',
      });
    }

    // 默认：移至回收站
    const result = await moveToRecycleBin({
      resourceType: 'document',
      resourceId: documentId,
      deletedBy: userId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '文档已移至回收站',
      data: { recycleBinId: result.recycleBinId },
    });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: '删除文档失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getDocument(req, userId, parseInt(id)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => updateDocument(req, userId, parseInt(id)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => deleteDocument(req, userId, parseInt(id)));
}

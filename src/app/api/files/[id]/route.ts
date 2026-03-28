/**
 * 文件信息API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { checkFilePermission } from '@/lib/auth/resource-permission';
import { moveToRecycleBin } from '@/lib/recycle-bin/service';
import { db } from '@/db';
import { files, projectFiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function getFileInfo(
  request: NextRequest,
  userId: number,
  fileId: number
): Promise<NextResponse> {
  try {
    // 权限检查：读取文件
    const permissionResult = await checkFilePermission(userId, fileId, 'read');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权访问此文件' },
        { status: 403 }
      );
    }

    // 查询文件信息
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // 构建文件URL（这里假设文件存储在对象存储中）
    const fileUrl = `/api/files/${file.id}/download`;

    return NextResponse.json({
      id: file.id,
      name: file.originalName,
      type: file.extension || 'unknown',
      size: file.size,
      mimeType: file.mimeType,
      url: fileUrl,
      categoryId: file.categoryId,
      securityLevel: file.securityLevel,
      currentVersion: file.currentVersion,
      status: file.status,
      createdAt: file.createdAt,
    });
  } catch (error) {
    console.error('Get file info error:', error);
    return NextResponse.json({ error: '获取文件信息失败' }, { status: 500 });
  }
}

async function deleteFile(
  request: NextRequest,
  userId: number,
  fileId: number
): Promise<NextResponse> {
  try {
    // 权限检查：删除文件
    const permissionResult = await checkFilePermission(userId, fileId, 'delete');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权删除此文件' },
        { status: 403 }
      );
    }

    // 查询文件信息
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // 检查是否请求物理删除
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';
    const confirmed = searchParams.get('confirmed') === 'true';

    if (permanent && confirmed) {
      // 物理删除
      await db.delete(projectFiles).where(eq(projectFiles.fileId, fileId));
      await db.delete(files).where(eq(files.id, fileId));
      return NextResponse.json({
        success: true,
        message: '文件已永久删除',
      });
    }

    // 默认：移至回收站
    const result = await moveToRecycleBin({
      resourceType: 'file',
      resourceId: fileId,
      deletedBy: userId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '文件已移至回收站',
      data: { recycleBinId: result.recycleBinId },
    });
  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json({ error: '删除文件失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getFileInfo(req, userId, parseInt(id)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => deleteFile(req, userId, parseInt(id)));
}

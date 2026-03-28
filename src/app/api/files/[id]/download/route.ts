/**
 * 文件下载API
 * GET: 获取文件下载URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { checkFilePermission } from '@/lib/auth/resource-permission';
import { getFileDownloadUrl } from '@/lib/file/service';

// 获取文件下载URL
async function getDownloadUrl(
  request: NextRequest,
  userId: number,
  fileId: number
): Promise<NextResponse> {
  try {
    // 权限检查：读取文件
    const permissionResult = await checkFilePermission(userId, fileId, 'read');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权下载此文件' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const expireTime = parseInt(searchParams.get('expireTime') || '3600');

    const result = await getFileDownloadUrl(fileId, userId, expireTime);

    if (!result) {
      return NextResponse.json({ error: '文件不存在或已被删除' }, { status: 404 });
    }

    return NextResponse.json({
      downloadUrl: result.url,
      fileName: result.fileName,
      expireTime,
    });
  } catch (error) {
    console.error('Get download URL error:', error);
    return NextResponse.json({ error: '获取下载链接失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getDownloadUrl(req, userId, parseInt(id)));
}

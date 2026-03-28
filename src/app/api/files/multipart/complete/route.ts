/**
 * 分片上传API - 完成上传
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { files } from '@/db/schema';

interface CompleteUploadRequest {
  uploadId: string;
  fileName: string;
}

async function completeUpload(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body: CompleteUploadRequest = await request.json();
    const { uploadId, fileName } = body;

    if (!uploadId || !fileName) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 在实际实现中，这里应该调用对象存储的完成分片上传API
    // 例如 MinIO: client.completeMultipartUpload()
    // 或 AWS S3: s3.completeMultipartUpload()

    // 创建文件记录
    const [file] = await db
      .insert(files)
      .values({
        name: fileName,
        originalName: fileName,
        path: `uploads/${uploadId}/${fileName}`,
        size: 0, // 实际大小需要从上传过程中获取
        mimeType: 'application/octet-stream',
        extension: fileName.split('.').pop() || '',
        uploaderId: userId,
        status: 'active',
      })
      .returning();

    return NextResponse.json({
      success: true,
      fileId: file.id,
      url: `/api/files/${file.id}/download`,
    });
  } catch (error) {
    console.error('Complete upload error:', error);
    return NextResponse.json({ error: '完成上传失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => completeUpload(req, userId));
}

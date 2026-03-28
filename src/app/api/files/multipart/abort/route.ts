/**
 * 分片上传API - 取消上传
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';

interface AbortUploadRequest {
  uploadId: string;
}

async function abortUpload(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body: AbortUploadRequest = await request.json();
    const { uploadId } = body;

    if (!uploadId) {
      return NextResponse.json({ error: '缺少上传ID' }, { status: 400 });
    }

    // 在实际实现中，这里应该调用对象存储的取消分片上传API
    // 例如 MinIO: client.abortMultipartUpload()
    // 或 AWS S3: s3.abortMultipartUpload()

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Abort upload error:', error);
    return NextResponse.json({ error: '取消上传失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => abortUpload(req, userId));
}

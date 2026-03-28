/**
 * 分片上传API - 获取预签名URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';

interface PresignRequest {
  uploadId: string;
  chunkIndex: number;
}

async function getPresignUrl(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body: PresignRequest = await request.json();
    const { uploadId, chunkIndex } = body;

    if (!uploadId || chunkIndex === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 在实际实现中，这里应该生成预签名URL
    // 例如 MinIO: client.presignedUrl('PUT', bucket, objectName, expires)
    // 或 AWS S3: s3.getSignedUrl('uploadPart', ...)

    // 模拟预签名URL（实际项目中需要替换为真实的对象存储SDK调用）
    const uploadUrl = `/api/files/multipart/upload/${uploadId}/${chunkIndex}`;

    return NextResponse.json({
      uploadUrl,
      expiresIn: 3600, // 1小时
    });
  } catch (error) {
    console.error('Presign URL error:', error);
    return NextResponse.json({ error: '获取上传地址失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => getPresignUrl(req, userId));
}

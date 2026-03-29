/**
 * 文件上传API
 * POST: 上传文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth as _withAuth, withPermission } from '@/lib/auth/middleware';
import { uploadFile, FileUploadParams } from '@/lib/file/service';
import { DocumentSecurityLevel } from '@/types/document';

// 上传文件
async function upload(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 });
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(arrayBuffer);

    // 获取参数
    const params: FileUploadParams = {
      fileContent,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      categoryId: formData.get('categoryId') ? parseInt(formData.get('categoryId') as string) : undefined,
      securityLevel: (formData.get('securityLevel') as DocumentSecurityLevel) || 'internal',
      projectId: formData.get('projectId') ? parseInt(formData.get('projectId') as string) : undefined,
      fileType: formData.get('fileType') as string || undefined,
      description: formData.get('description') as string || undefined,
    };

    const fileId = await uploadFile(params, userId);

    return NextResponse.json(
      {
        success: true,
        message: '文件上传成功',
        fileId,
        fileName: file.name,
        size: file.size,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload file error:', error);
    const message = error instanceof Error ? error.message : '文件上传失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'file:upload', upload);
}

/**
 * 分片上传API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  uploadChunk,
  mergeChunks,
  verifyFileIntegrity,
  getUploadSession as _getUploadSession,
} from '@/lib/upload/chunked-upload';

// ============================================
// POST - 上传分片
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  return withAuth(request, async (req) => {
    try {
      const { sessionId } = await params;
      const formData = await req.formData();

      const chunkNumber = parseInt(formData.get('chunkNumber') as string);
      const chunkData = formData.get('chunk') as Blob;
      const chunkHash = formData.get('chunkHash') as string;

      if (!chunkNumber || !chunkData || !chunkHash) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      const buffer = Buffer.from(await chunkData.arrayBuffer());
      const result = await uploadChunk(sessionId, chunkNumber, buffer, chunkHash);

      return NextResponse.json(result);
    } catch (error: any) {
      console.error('Chunk upload error:', error);
      return NextResponse.json({ error: error.message || '分片上传失败' }, { status: 500 });
    }
  });
}

// ============================================
// PUT - 合并分片
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  return withAuth(request, async (req) => {
    try {
      const { sessionId } = await params;
      const body = await req.json();
      const { fileHash, targetPath } = body;

      if (!fileHash) {
        return NextResponse.json({ error: '缺少fileHash参数' }, { status: 400 });
      }

      // 验证文件完整性
      const isValid = await verifyFileIntegrity(sessionId, fileHash);
      if (!isValid) {
        return NextResponse.json({ error: '文件完整性验证失败' }, { status: 400 });
      }

      // 合并分片（目标路径会在服务端做白名单限制）
      await mergeChunks(sessionId, targetPath || '');

      return NextResponse.json({
        success: true,
        message: '文件合并成功',
      });
    } catch (error: any) {
      console.error('Merge chunks error:', error);
      return NextResponse.json({ error: error.message || '分片合并失败' }, { status: 500 });
    }
  });
}

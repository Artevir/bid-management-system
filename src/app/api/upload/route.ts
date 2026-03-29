/**
 * 大文件分片上传API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createUploadSession,
  getUploadSession as _getUploadSession,
  uploadChunk as _uploadChunk,
  mergeChunks as _mergeChunks,
  verifyFileIntegrity as _verifyFileIntegrity,
  getUploadedChunks,
  getUploadProgress,
} from '@/lib/upload/chunked-upload';

// ============================================
// POST - 初始化上传
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, fileSize, mimeType } = body;

    if (!filename || !fileSize || !mimeType) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const session = await createUploadSession(filename, fileSize, mimeType);

    return NextResponse.json({
      sessionId: session.sessionId,
      fileId: session.fileId,
      totalChunks: session.totalChunks,
      chunkSize: process.env.CHUNK_SIZE || 5 * 1024 * 1024,
    });
  } catch (error) {
    console.error('Upload initialization error:', error);
    return NextResponse.json(
      { error: '上传初始化失败' },
      { status: 500 }
    );
  }
}

// ============================================
// GET - 获取上传状态
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: '缺少sessionId参数' },
      { status: 400 }
    );
  }

  try {
    const progress = getUploadProgress(sessionId);

    if (!progress) {
      return NextResponse.json(
        { error: '上传会话不存在' },
        { status: 404 }
      );
    }

    const uploadedChunks = getUploadedChunks(sessionId);

    return NextResponse.json({
      ...progress,
      uploadedChunks,
    });
  } catch (error) {
    console.error('Get upload progress error:', error);
    return NextResponse.json(
      { error: '获取上传状态失败' },
      { status: 500 }
    );
  }
}

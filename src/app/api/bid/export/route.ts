/**
 * 文档导出API
 * POST: 导出文档
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { exportDocument, ExportOptions } from '@/lib/bid/export';

// 导出文档
async function handleExport(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { documentId, format, includeToc } = body;

    if (!documentId || !format) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const options: ExportOptions = {
      format,
      includeToc: includeToc !== false,
      includePageNumbers: true,
    };

    const result = await exportDocument(documentId, options);

    // 返回文件内容
    // 处理 Buffer 类型 - 转换为 Uint8Array 以兼容 Response
    const responseContent = Buffer.isBuffer(result.content)
      ? new Uint8Array(result.content)
      : result.content;

    return new NextResponse(responseContent, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
      },
    });
  } catch (error) {
    console.error('Export document error:', error);
    const message = error instanceof Error ? error.message : '导出失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 获取导出预览
async function handlePreview(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const format = searchParams.get('format') || 'html';

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    const options: ExportOptions = {
      format: format as 'html' | 'markdown' | 'docx' | 'pdf',
      includeToc: true,
      includePageNumbers: true,
    };

    const result = await exportDocument(parseInt(documentId), options);

    // 对于预览，PDF 返回 base64
    const previewContent = Buffer.isBuffer(result.content)
      ? result.content.toString('base64')
      : result.content;

    return NextResponse.json({
      content: previewContent,
      filename: result.filename,
      mimeType: result.mimeType,
      isBase64: Buffer.isBuffer(result.content),
    });
  } catch (error) {
    console.error('Preview export error:', error);
    return NextResponse.json({ error: '预览失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'preview') {
    return withAuth(request, (req, userId) => handlePreview(req, userId));
  }

  return withAuth(request, (req, userId) => handleExport(req, userId));
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => handlePreview(req, userId));
}

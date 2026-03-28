import { NextRequest, NextResponse } from 'next/server';
import { resumeGenerateService } from '@/lib/services/resume-generate-service';
import { generationProgressServiceV2 } from '@/lib/services/generation-progress-service-v2';

/**
 * GET /api/bid/documents/[id]/resume
 * 检查是否可以恢复生成
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json({ error: '无效的文档ID' }, { status: 400 });
    }

    const result = await resumeGenerateService.checkResumable(documentId);

    return NextResponse.json({
      canResume: result.canResume,
      checkpoint: result.checkpoint,
      progress: result.progress,
    });
  } catch (error: any) {
    console.error('Check resume error:', error);
    return NextResponse.json(
      { error: error.message || '检查恢复状态失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bid/documents/[id]/resume
 * 恢复生成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json({ error: '无效的文档ID' }, { status: 400 });
    }

    // 获取用户ID（从请求头或session）
    const userId = parseInt(request.headers.get('x-user-id') || '1');

    const result = await resumeGenerateService.resumeGeneration(documentId, userId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Resume generation error:', error);
    return NextResponse.json(
      { error: error.message || '恢复生成失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bid/documents/[id]/resume
 * 取消生成
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json({ error: '无效的文档ID' }, { status: 400 });
    }

    const result = await resumeGenerateService.cancelGeneration(documentId);

    return NextResponse.json({ success: result });
  } catch (error: any) {
    console.error('Cancel generation error:', error);
    return NextResponse.json(
      { error: error.message || '取消生成失败' },
      { status: 500 }
    );
  }
}

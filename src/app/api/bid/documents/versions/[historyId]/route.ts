import { NextRequest, NextResponse } from 'next/server';
import { versionCompareService } from '@/lib/services/version-compare-service';

/**
 * GET /api/bid/documents/versions/[historyId]
 * 获取版本详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ historyId: string }> }
) {
  try {
    const { historyId } = await params;
    const id = parseInt(historyId);

    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的版本ID' }, { status: 400 });
    }

    const version = await versionCompareService.getVersionDetail(id);

    if (!version) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }

    return NextResponse.json(version);
  } catch (error: any) {
    console.error('Get version detail error:', error);
    return NextResponse.json(
      { error: error.message || '获取版本详情失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bid/documents/versions/[historyId]/restore
 * 恢复到指定版本
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ historyId: string }> }
) {
  try {
    const { historyId } = await params;
    const id = parseInt(historyId);

    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的版本ID' }, { status: 400 });
    }

    const version = await versionCompareService.getVersionDetail(id);
    if (!version) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }

    const userId = parseInt(request.headers.get('x-user-id') || '1');

    const result = await versionCompareService.restoreToVersion(
      version.documentId,
      id,
      userId
    );

    return NextResponse.json({
      success: result,
      message: '已恢复到指定版本',
    });
  } catch (error: any) {
    console.error('Restore version error:', error);
    return NextResponse.json(
      { error: error.message || '恢复版本失败' },
      { status: 500 }
    );
  }
}

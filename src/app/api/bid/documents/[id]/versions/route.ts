import { NextRequest, NextResponse } from 'next/server';
import { versionCompareService } from '@/lib/services/version-compare-service';

/**
 * GET /api/bid/documents/[id]/versions
 * 获取文档所有版本
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

    const versions = await versionCompareService.getDocumentVersions(documentId);

    return NextResponse.json({
      versions,
      total: versions.length,
    });
  } catch (error: any) {
    console.error('Get versions error:', error);
    return NextResponse.json(
      { error: error.message || '获取版本列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bid/documents/[id]/versions
 * 创建版本快照
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

    const body = await request.json();
    const { name, description } = body;

    // 获取用户ID
    const userId = parseInt(request.headers.get('x-user-id') || '1');

    const historyId = await versionCompareService.createVersionSnapshot(
      documentId,
      userId.toString(),
      name || `版本快照`,
      description
    );

    return NextResponse.json({
      success: true,
      historyId,
      message: '版本快照创建成功',
    });
  } catch (error: any) {
    console.error('Create version error:', error);
    return NextResponse.json(
      { error: error.message || '创建版本快照失败' },
      { status: 500 }
    );
  }
}

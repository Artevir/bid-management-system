import { NextRequest, NextResponse } from 'next/server';
import { versionCompareService } from '@/lib/services/version-compare-service';

/**
 * GET /api/bid/documents/versions/compare?version1=X&version2=Y
 * 对比两个版本
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const version1Id = parseInt(searchParams.get('version1') || '');
    const version2Id = parseInt(searchParams.get('version2') || '');

    if (!version1Id || !version2Id) {
      return NextResponse.json({ error: '请提供要对比的版本ID' }, { status: 400 });
    }

    if (version1Id === version2Id) {
      return NextResponse.json({ error: '不能对比同一个版本' }, { status: 400 });
    }

    const result = await versionCompareService.compareVersions(version1Id, version2Id);

    // 生成对比报告
    const report = versionCompareService.generateCompareReport(result);

    return NextResponse.json({
      ...result,
      report,
    });
  } catch (error: any) {
    console.error('Compare versions error:', error);
    return NextResponse.json(
      { error: error.message || '版本对比失败' },
      { status: 500 }
    );
  }
}

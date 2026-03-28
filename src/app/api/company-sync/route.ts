/**
 * 公司信息联动API路由
 * 
 * GET /api/company-sync - 获取公司完整信息或搜索
 * GET /api/company-sync/seal-info - 获取盖章场景所需信息
 * GET /api/company-sync/bid-info - 获取投标场景所需信息
 * GET /api/company-sync/authorization-info - 获取授权场景所需信息
 * GET /api/company-sync/expiring-files - 获取即将到期的资质文件
 * POST /api/company-sync/sync-project - 同步公司信息到项目
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getCompanyFullInfo,
  getCompanyInfoForSeal,
  getCompanyInfoForBid,
  getCompanyInfoForAuthorization,
  getCompanyPrimaryContact,
  getCompanyFilesByType,
  getCompanyDefaultFramework,
  getExpiringFiles,
  searchCompanies,
  syncCompanyToArchive,
  getCompanyListSimple,
  getDefaultCompany,
  getCompanyUsageStats,
} from '@/lib/company-sync/service';

// GET - 获取公司信息
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const companyId = searchParams.get('companyId');
    const keyword = searchParams.get('keyword');

    // 获取公司完整信息
    if (action === 'full-info' && companyId) {
      const info = await getCompanyFullInfo(parseInt(companyId));
      if (!info) {
        return NextResponse.json({ error: '公司不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: info });
    }

    // 获取盖章场景信息
    if (action === 'seal-info' && companyId) {
      const info = await getCompanyInfoForSeal(parseInt(companyId));
      if (!info) {
        return NextResponse.json({ error: '公司不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: info });
    }

    // 获取投标场景信息
    if (action === 'bid-info' && companyId) {
      const info = await getCompanyInfoForBid(parseInt(companyId));
      if (!info) {
        return NextResponse.json({ error: '公司不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: info });
    }

    // 获取授权场景信息
    if (action === 'authorization-info' && companyId) {
      const info = await getCompanyInfoForAuthorization(parseInt(companyId));
      if (!info) {
        return NextResponse.json({ error: '公司不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: info });
    }

    // 获取主要对接人
    if (action === 'primary-contact' && companyId) {
      const contact = await getCompanyPrimaryContact(parseInt(companyId));
      return NextResponse.json({ success: true, data: contact });
    }

    // 获取资质文件
    if (action === 'files' && companyId) {
      const fileType = searchParams.get('fileType') || undefined;
      const files = await getCompanyFilesByType(parseInt(companyId), fileType);
      return NextResponse.json({ success: true, data: files });
    }

    // 获取默认文档框架
    if (action === 'default-framework' && companyId) {
      const documentType = searchParams.get('documentType') || undefined;
      const framework = await getCompanyDefaultFramework(parseInt(companyId), documentType);
      return NextResponse.json({ success: true, data: framework });
    }

    // 获取即将到期的资质文件
    if (action === 'expiring-files') {
      const daysThreshold = parseInt(searchParams.get('days') || '30');
      const files = await getExpiringFiles(daysThreshold);
      return NextResponse.json({ success: true, data: files });
    }

    // 搜索公司
    if (action === 'search' && keyword) {
      const limit = parseInt(searchParams.get('limit') || '10');
      const companies = await searchCompanies(keyword, limit);
      return NextResponse.json({ success: true, data: companies });
    }

    // 获取公司列表（简化版）
    if (action === 'list') {
      const isActive = searchParams.get('isActive');
      const filters: { isActive?: boolean; keyword?: string } = {};
      
      if (isActive !== null) {
        filters.isActive = isActive === 'true';
      }
      if (keyword) {
        filters.keyword = keyword;
      }
      
      const companies = await getCompanyListSimple(filters);
      return NextResponse.json({ success: true, data: companies });
    }

    // 获取默认公司
    if (action === 'default') {
      const company = await getDefaultCompany();
      return NextResponse.json({ success: true, data: company });
    }

    // 获取使用统计
    if (action === 'usage-stats' && companyId) {
      const stats = await getCompanyUsageStats(parseInt(companyId));
      return NextResponse.json({ success: true, data: stats });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('公司联动API错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}

// POST - 同步操作
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { action, archiveId, companyId } = body;

    // 同步公司信息到归档
    if (action === 'sync-archive') {
      if (!archiveId || !companyId) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      const result = await syncCompanyToArchive(archiveId, companyId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('公司联动API错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}

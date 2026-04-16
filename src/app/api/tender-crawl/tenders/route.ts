/**
 * 招标信息API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getTenderInfos,
  createTenderInfo,
  getTenderInfoById as _getTenderInfoById,
  updateTenderInfo as _updateTenderInfo,
  deleteTenderInfo as _deleteTenderInfo,
  followTenderInfo as _followTenderInfo,
  unfollowTenderInfo as _unfollowTenderInfo,
  ignoreTenderInfo as _ignoreTenderInfo,
  getTenderInfoStatistics,
  smartSearchTenderInfo,
  crawlTenderInfoFromWeb,
} from '@/lib/tender-crawl/service';

// GET /api/tender-crawl/tenders - 获取招标信息列表
export async function GET(req: NextRequest) {
  return withAuth(req, async (request) => {
    try {
      const searchParams = request.nextUrl.searchParams;

      // 特殊路由处理
      const path = request.nextUrl.pathname;
      if (path.endsWith('/statistics')) {
        const sourceId = searchParams.get('sourceId')
          ? parseInt(searchParams.get('sourceId')!)
          : undefined;
        const stats = await getTenderInfoStatistics({ sourceId });
        return NextResponse.json(stats);
      }

      const filters = {
        sourceId: searchParams.get('sourceId')
          ? parseInt(searchParams.get('sourceId')!)
          : undefined,
        status: searchParams.get('status') || undefined,
        projectId: searchParams.get('projectId')
          ? parseInt(searchParams.get('projectId')!)
          : undefined,
        industry: searchParams.get('industry') || undefined,
        region: searchParams.get('region') || undefined,
        keyword: searchParams.get('keyword') || undefined,
        followedBy: searchParams.get('followedBy')
          ? parseInt(searchParams.get('followedBy')!)
          : undefined,
        publishDateFrom: searchParams.get('publishDateFrom')
          ? new Date(searchParams.get('publishDateFrom')!)
          : undefined,
        publishDateTo: searchParams.get('publishDateTo')
          ? new Date(searchParams.get('publishDateTo')!)
          : undefined,
        submissionDeadlineFrom: searchParams.get('submissionDeadlineFrom')
          ? new Date(searchParams.get('submissionDeadlineFrom')!)
          : undefined,
        page: parseInt(searchParams.get('page') || '1'),
        pageSize: parseInt(searchParams.get('pageSize') || '20'),
      };

      const result = await getTenderInfos(filters);

      return NextResponse.json(result);
    } catch (error) {
      console.error('获取招标信息列表失败:', error);
      return NextResponse.json({ error: '获取招标信息列表失败' }, { status: 500 });
    }
  });
}

// POST /api/tender-crawl/tenders - 创建招标信息或执行搜索
export async function POST(req: NextRequest) {
  return withAuth(req, async (_request, userId) => {
    try {
      const body = await req.json();

      if (body.action === 'search') {
        const results = await smartSearchTenderInfo({
          keywords: body.keywords,
          industry: body.industry,
          region: body.region,
          maxResults: body.maxResults || 20,
        });
        return NextResponse.json({ data: results, total: results.length });
      }

      if (body.action === 'crawl') {
        const results = await crawlTenderInfoFromWeb(body.query, {
          maxResults: body.maxResults,
          sourceId: body.sourceId,
        });
        return NextResponse.json({ data: results, total: results.length });
      }

      const tender = await createTenderInfo({
        title: body.title,
        sourceUrl: body.sourceUrl,
        sourceId: body.sourceId,
        tenderCode: body.tenderCode,
        tenderType: body.tenderType,
        tenderOrganization: body.tenderOrganization,
        tenderAgent: body.tenderAgent,
        contactPerson: body.contactPerson,
        contactPhone: body.contactPhone,
        projectType: body.projectType,
        industry: body.industry,
        region: body.region,
        address: body.address,
        budget: body.budget,
        estimatedAmount: body.estimatedAmount,
        publishDate: body.publishDate ? new Date(body.publishDate) : null,
        registerStartDate: body.registerStartDate ? new Date(body.registerStartDate) : null,
        registerEndDate: body.registerEndDate ? new Date(body.registerEndDate) : null,
        questionDeadline: body.questionDeadline ? new Date(body.questionDeadline) : null,
        submissionDeadline: body.submissionDeadline ? new Date(body.submissionDeadline) : null,
        openBidDate: body.openBidDate ? new Date(body.openBidDate) : null,
        openBidLocation: body.openBidLocation,
        summary: body.summary,
        content: body.content,
        requirements: body.requirements,
        scope: body.scope,
        status: body.status || 'new',
        tags: body.tags,
        attachments: body.attachments,
        externalId: body.externalId,
        contentHash: body.contentHash,
        rawData: body.rawData,
        createdBy: userId,
      });

      return NextResponse.json(tender);
    } catch (error) {
      console.error('创建招标信息失败:', error);
      return NextResponse.json({ error: '创建招标信息失败' }, { status: 500 });
    }
  });
}

/**
 * 统计报表 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getBidStatistics,
  getMonthlyBidTrend,
  getIndustryDistribution,
  getRegionalDistribution,
  getCostStatistics,
  getEfficiencyMetrics,
  getUserPerformance,
  getProjectProgressStats,
  getDocumentStatistics,
  getComprehensiveReport,
} from '@/lib/report/service';

// 解析日期参数
function parseDateParams(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const dateRange = searchParams.get('dateRange'); // last7days, last30days, last3months, lastyear, custom
  
  if (dateRange) {
    const now = new Date();
    switch (dateRange) {
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'lastyear':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }
  } else {
    if (startDateStr) {
      startDate = new Date(startDateStr);
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
    }
  }

  const departmentId = searchParams.get('departmentId')
    ? parseInt(searchParams.get('departmentId')!)
    : undefined;

  return { startDate, endDate, departmentId };
}

// 投标统计
async function getBidStats(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const params = parseDateParams(request);
    const stats = await getBidStatistics(params.startDate, params.endDate, params.departmentId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取投标统计失败:', error);
    return NextResponse.json({ error: '获取投标统计失败' }, { status: 500 });
  }
}

// 月度趋势
async function getTrend(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '12');
    const departmentId = searchParams.get('departmentId')
      ? parseInt(searchParams.get('departmentId')!)
      : undefined;
    
    const trend = await getMonthlyBidTrend(months, departmentId);
    return NextResponse.json({ trend });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    return NextResponse.json({ error: '获取趋势数据失败' }, { status: 500 });
  }
}

// 行业分布
async function getIndustry(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const params = parseDateParams(request);
    const distribution = await getIndustryDistribution(params.startDate, params.endDate);
    return NextResponse.json({ distribution });
  } catch (error) {
    console.error('获取行业分布失败:', error);
    return NextResponse.json({ error: '获取行业分布失败' }, { status: 500 });
  }
}

// 地区分布
async function getRegion(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const params = parseDateParams(request);
    const distribution = await getRegionalDistribution(params.startDate, params.endDate);
    return NextResponse.json({ distribution });
  } catch (error) {
    console.error('获取地区分布失败:', error);
    return NextResponse.json({ error: '获取地区分布失败' }, { status: 500 });
  }
}

// 成本统计
async function getCost(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const params = parseDateParams(request);
    const stats = await getCostStatistics(params.startDate, params.endDate, params.departmentId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取成本统计失败:', error);
    return NextResponse.json({ error: '获取成本统计失败' }, { status: 500 });
  }
}

// 效率指标
async function getEfficiency(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const params = parseDateParams(request);
    const metrics = await getEfficiencyMetrics(params.startDate, params.endDate, params.departmentId);
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('获取效率指标失败:', error);
    return NextResponse.json({ error: '获取效率指标失败' }, { status: 500 });
  }
}

// 用户绩效
async function getPerformance(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const params = parseDateParams(request);
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const performance = await getUserPerformance(
      params.startDate,
      params.endDate,
      params.departmentId,
      limit
    );
    return NextResponse.json({ performance });
  } catch (error) {
    console.error('获取用户绩效失败:', error);
    return NextResponse.json({ error: '获取用户绩效失败' }, { status: 500 });
  }
}

// 项目进度统计
async function getProgress(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId')
      ? parseInt(searchParams.get('departmentId')!)
      : undefined;
    
    const stats = await getProjectProgressStats(departmentId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取项目进度统计失败:', error);
    return NextResponse.json({ error: '获取项目进度统计失败' }, { status: 500 });
  }
}

// 文档统计
async function getDocs(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId')
      ? parseInt(searchParams.get('projectId')!)
      : undefined;
    
    const stats = await getDocumentStatistics(projectId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取文档统计失败:', error);
    return NextResponse.json({ error: '获取文档统计失败' }, { status: 500 });
  }
}

// 综合报表
async function getComprehensive(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const params = parseDateParams(request);
    const report = await getComprehensiveReport(params);
    return NextResponse.json(report);
  } catch (error) {
    console.error('获取综合报表失败:', error);
    return NextResponse.json({ error: '获取综合报表失败' }, { status: 500 });
  }
}

// 路由分发
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'bid':
      return withAuth(request, getBidStats);
    case 'trend':
      return withAuth(request, getTrend);
    case 'industry':
      return withAuth(request, getIndustry);
    case 'region':
      return withAuth(request, getRegion);
    case 'cost':
      return withAuth(request, getCost);
    case 'efficiency':
      return withAuth(request, getEfficiency);
    case 'performance':
      return withAuth(request, getPerformance);
    case 'progress':
      return withAuth(request, getProgress);
    case 'documents':
      return withAuth(request, getDocs);
    case 'comprehensive':
      return withAuth(request, getComprehensive);
    default:
      return withAuth(request, getComprehensive);
  }
}

/**
 * 项目看板API
 * 提供统计数据、趋势分析、实时监控等接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getDashboardOverview,
  getProjectTrend,
  getDepartmentStats,
  getRecentActivities,
  getMilestoneStatus,
  getDocumentStats,
  getReviewStats,
  getUserProjects,
  getUpcomingMilestones,
} from '@/lib/dashboard/service';

// ============================================
// 概览数据
// ============================================

async function getOverview(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const overview = await getDashboardOverview(userId);

    return NextResponse.json({ overview });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    return NextResponse.json({ error: '获取概览数据失败' }, { status: 500 });
  }
}

// ============================================
// 项目趋势
// ============================================

async function getTrend(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '6');

    const trend = await getProjectTrend(months);

    return NextResponse.json({ trend });
  } catch (error) {
    console.error('Get project trend error:', error);
    return NextResponse.json({ error: '获取趋势数据失败' }, { status: 500 });
  }
}

// ============================================
// 部门统计
// ============================================

async function getDeptStats(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const stats = await getDepartmentStats();

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Get department stats error:', error);
    return NextResponse.json({ error: '获取部门统计失败' }, { status: 500 });
  }
}

// ============================================
// 最近活动
// ============================================

async function getActivities(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const activities = await getRecentActivities(userId, limit);

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Get recent activities error:', error);
    return NextResponse.json({ error: '获取活动记录失败' }, { status: 500 });
  }
}

// ============================================
// 里程碑统计
// ============================================

async function getMilestones(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId')
      ? parseInt(searchParams.get('projectId')!)
      : undefined;

    const status = await getMilestoneStatus(projectId);

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Get milestone status error:', error);
    return NextResponse.json({ error: '获取里程碑统计失败' }, { status: 500 });
  }
}

// ============================================
// 文档统计
// ============================================

async function getDocs(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId')
      ? parseInt(searchParams.get('projectId')!)
      : undefined;

    const stats = await getDocumentStats(projectId);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Get document stats error:', error);
    return NextResponse.json({ error: '获取文档统计失败' }, { status: 500 });
  }
}

// ============================================
// 审校统计
// ============================================

async function getReviews(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId')
      ? parseInt(searchParams.get('projectId')!)
      : undefined;

    const stats = await getReviewStats(projectId);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Get review stats error:', error);
    return NextResponse.json({ error: '获取审校统计失败' }, { status: 500 });
  }
}

// ============================================
// 我的项目
// ============================================

async function getMyProjects(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const role = searchParams.get('role') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');

    const projects = await getUserProjects(userId, { status, role, limit });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Get user projects error:', error);
    return NextResponse.json({ error: '获取项目列表失败' }, { status: 500 });
  }
}

// ============================================
// 即将到期的里程碑
// ============================================

async function getUpcoming(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const milestones = await getUpcomingMilestones(userId, days);

    return NextResponse.json({ milestones });
  } catch (error) {
    console.error('Get upcoming milestones error:', error);
    return NextResponse.json({ error: '获取即将到期里程碑失败' }, { status: 500 });
  }
}

// ============================================
// 路由分发
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'overview':
      return withAuth(request, getOverview);
    case 'trend':
      return withAuth(request, getTrend);
    case 'departments':
      return withAuth(request, getDeptStats);
    case 'activities':
      return withAuth(request, getActivities);
    case 'milestones':
      return withAuth(request, getMilestones);
    case 'documents':
      return withAuth(request, getDocs);
    case 'reviews':
      return withAuth(request, getReviews);
    case 'my-projects':
      return withAuth(request, getMyProjects);
    case 'upcoming':
      return withAuth(request, getUpcoming);
    default:
      return withAuth(request, getOverview);
  }
}

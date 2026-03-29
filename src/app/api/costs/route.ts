/**
 * 成本管理API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  createBudget,
  getBudgetsByProject,
  updateBudget,
  deleteBudget,
  createCostRecord,
  getCostRecords,
  updateCostRecord,
  approveCostRecord,
  markAsPaid,
  deleteCostRecord,
  getCostSummary,
  getCostTrend,
  generateCostReport,
  getCostReports,
} from '@/lib/cost/service';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq as _eq } from 'drizzle-orm';

// 获取成本数据
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const projectId = searchParams.get('projectId');
    const budgetId = searchParams.get('budgetId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 根据action返回不同数据
    switch (action) {
      case 'summary': {
        if (!projectId) {
          return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
        }
        const summary = await getCostSummary(parseInt(projectId));
        return NextResponse.json(summary);
      }

      case 'trend': {
        if (!projectId) {
          return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
        }
        const trend = await getCostTrend(
          parseInt(projectId),
          startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate ? new Date(endDate) : new Date()
        );
        return NextResponse.json(trend);
      }

      case 'budgets': {
        if (!projectId) {
          return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
        }
        const budgets = await getBudgetsByProject(parseInt(projectId));
        return NextResponse.json(budgets);
      }

      case 'records': {
        const result = await getCostRecords(
          projectId ? parseInt(projectId) : undefined,
          {
            type: type || undefined,
            status: status || undefined,
            budgetId: budgetId ? parseInt(budgetId) : undefined,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            page,
            pageSize,
          }
        );
        return NextResponse.json(result);
      }

      case 'reports': {
        if (!projectId) {
          return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
        }
        const reports = await getCostReports(parseInt(projectId));
        return NextResponse.json(reports);
      }

      case 'projects': {
        // 获取有成本数据的项目列表
        const projectList = await db
          .select({
            id: projects.id,
            name: projects.name,
            status: projects.status,
            createdAt: projects.createdAt,
          })
          .from(projects)
          .orderBy(projects.createdAt);
        return NextResponse.json(projectList);
      }

      default:
        // 默认返回成本记录列表
        const result = await getCostRecords(
          projectId ? parseInt(projectId) : undefined,
          {
            type: type || undefined,
            status: status || undefined,
            budgetId: budgetId ? parseInt(budgetId) : undefined,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            page,
            pageSize,
          }
        );
        return NextResponse.json(result);
    }
  } catch (error) {
    console.error('获取成本数据失败:', error);
    return NextResponse.json({ error: '获取成本数据失败' }, { status: 500 });
  }
}

// 创建成本数据
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'budget': {
        const budget = await createBudget({
          ...data,
          createdBy: currentUser.userId,
        });
        return NextResponse.json(budget);
      }

      case 'record': {
        const record = await createCostRecord({
          ...data,
          createdBy: currentUser.userId,
        });
        return NextResponse.json(record);
      }

      case 'report': {
        const report = await generateCostReport(data.projectId, currentUser.userId);
        return NextResponse.json(report);
      }

      default:
        return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('创建成本数据失败:', error);
    return NextResponse.json({ error: '创建成本数据失败' }, { status: 500 });
  }
}

// 更新成本数据
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { action, id, data, approved, note } = body;

    switch (action) {
      case 'budget': {
        const budget = await updateBudget(id, data);
        return NextResponse.json(budget);
      }

      case 'record': {
        const record = await updateCostRecord(id, data);
        return NextResponse.json(record);
      }

      case 'approve': {
        const record = await approveCostRecord(id, currentUser.userId, approved, note);
        return NextResponse.json(record);
      }

      case 'pay': {
        const record = await markAsPaid(id);
        return NextResponse.json(record);
      }

      default:
        return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('更新成本数据失败:', error);
    return NextResponse.json({ error: '更新成本数据失败' }, { status: 500 });
  }
}

// 删除成本数据
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json({ error: '缺少ID' }, { status: 400 });
    }

    switch (action) {
      case 'budget': {
        await deleteBudget(id);
        return NextResponse.json({ success: true });
      }

      case 'record': {
        await deleteCostRecord(id);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('删除成本数据失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除成本数据失败' },
      { status: 500 }
    );
  }
}

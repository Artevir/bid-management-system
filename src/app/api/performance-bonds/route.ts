/**
 * 履约保证金API路由
 * GET /api/performance-bonds - 获取履约保证金列表
 * POST /api/performance-bonds - 创建履约保证金
 * PUT /api/performance-bonds - 更新履约保证金
 * DELETE /api/performance-bonds - 删除履约保证金
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getPerformanceBonds,
  getPerformanceBondById,
  createPerformanceBond,
  updatePerformanceBond,
  deletePerformanceBond,
  getPerformanceBondStats,
  getUsersForSelect,
  getProjectsForSelect,
} from '@/lib/performance-bond/service';

// GET - 获取履约保证金列表或统计数据
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    
    // 如果请求统计数据
    if (searchParams.get('stats') === 'true') {
      const stats = await getPerformanceBondStats();
      return NextResponse.json({ success: true, stats });
    }
    
    // 如果请求用户列表
    if (searchParams.get('users') === 'true') {
      const users = await getUsersForSelect();
      return NextResponse.json({ success: true, users });
    }
    
    // 如果请求项目列表
    if (searchParams.get('projects') === 'true') {
      const projects = await getProjectsForSelect();
      return NextResponse.json({ success: true, projects });
    }
    
    // 如果请求单个详情
    const id = searchParams.get('id');
    if (id) {
      const bond = await getPerformanceBondById(parseInt(id));
      if (!bond) {
        return NextResponse.json({ error: '履约保证金记录不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: bond });
    }

    // 获取筛选参数
    const status = searchParams.get('status') || undefined;
    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const keyword = searchParams.get('keyword') || undefined;

    const bonds = await getPerformanceBonds({
      status,
      projectId,
      keyword,
    });

    return NextResponse.json({ success: true, data: bonds });
  } catch (error) {
    console.error('获取履约保证金失败:', error);
    return NextResponse.json({ error: '获取履约保证金失败' }, { status: 500 });
  }
}

// POST - 创建履约保证金
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    // 验证必填字段
    if (!body.projectName) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
    }
    if (!body.bondAmount) {
      return NextResponse.json({ error: '履约保证金金额不能为空' }, { status: 400 });
    }

    const bond = await createPerformanceBond({
      ...body,
      createdBy: session.user.id,
    });

    return NextResponse.json({ success: true, data: bond });
  } catch (error) {
    console.error('创建履约保证金失败:', error);
    return NextResponse.json({ error: '创建履约保证金失败' }, { status: 500 });
  }
}

// PUT - 更新履约保证金
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...bondData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少ID参数' }, { status: 400 });
    }

    const bond = await updatePerformanceBond(id, bondData);

    return NextResponse.json({ success: true, data: bond });
  } catch (error) {
    console.error('更新履约保证金失败:', error);
    return NextResponse.json({ error: '更新履约保证金失败' }, { status: 500 });
  }
}

// DELETE - 删除履约保证金
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少ID参数' }, { status: 400 });
    }

    await deletePerformanceBond(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除履约保证金失败:', error);
    return NextResponse.json({ error: '删除履约保证金失败' }, { status: 500 });
  }
}

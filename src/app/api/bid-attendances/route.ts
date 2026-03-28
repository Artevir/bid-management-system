/**
 * 去投标API路由
 * GET /api/bid-attendances - 获取去投标安排列表
 * POST /api/bid-attendances - 创建去投标安排
 * PUT /api/bid-attendances - 更新去投标安排
 * DELETE /api/bid-attendances - 删除去投标安排
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getBidAttendances,
  getBidAttendanceById,
  createBidAttendance,
  updateBidAttendance,
  deleteBidAttendance,
  getBidAttendanceStats,
  updateBidAttendees,
  getUsersForSelect,
  getProjectsForSelect,
} from '@/lib/bid-attendance/service';

// GET - 获取去投标安排列表或统计数据
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    
    // 如果请求统计数据
    if (searchParams.get('stats') === 'true') {
      const stats = await getBidAttendanceStats();
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
      const attendance = await getBidAttendanceById(parseInt(id));
      if (!attendance) {
        return NextResponse.json({ error: '去投标安排不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: attendance });
    }

    // 获取筛选参数
    const status = searchParams.get('status') || undefined;
    const travelMode = searchParams.get('travelMode') || undefined;
    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const keyword = searchParams.get('keyword') || undefined;

    const attendances = await getBidAttendances({
      status,
      travelMode,
      projectId,
      keyword,
    });

    return NextResponse.json({ success: true, data: attendances });
  } catch (error) {
    console.error('获取去投标安排失败:', error);
    return NextResponse.json({ error: '获取去投标安排失败' }, { status: 500 });
  }
}

// POST - 创建去投标安排
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { attendees, ...attendanceData } = body;

    // 验证必填字段
    if (!attendanceData.projectName) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
    }

    const attendance = await createBidAttendance(
      {
        ...attendanceData,
        createdBy: session.user.id,
      },
      attendees
    );

    return NextResponse.json({ success: true, data: attendance });
  } catch (error) {
    console.error('创建去投标安排失败:', error);
    return NextResponse.json({ error: '创建去投标安排失败' }, { status: 500 });
  }
}

// PUT - 更新去投标安排
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { id, attendees, ...attendanceData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少ID参数' }, { status: 400 });
    }

    // 更新主记录
    const attendance = await updateBidAttendance(id, attendanceData);

    // 如果提供了人员列表，更新人员
    if (attendees !== undefined) {
      await updateBidAttendees(id, attendees);
    }

    return NextResponse.json({ success: true, data: attendance });
  } catch (error) {
    console.error('更新去投标安排失败:', error);
    return NextResponse.json({ error: '更新去投标安排失败' }, { status: 500 });
  }
}

// DELETE - 删除去投标安排
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

    await deleteBidAttendance(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除去投标安排失败:', error);
    return NextResponse.json({ error: '删除去投标安排失败' }, { status: 500 });
  }
}

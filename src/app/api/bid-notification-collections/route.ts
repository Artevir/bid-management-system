/**
 * 领取中标通知书API路由
 * GET /api/bid-notification-collections - 获取领取安排列表
 * POST /api/bid-notification-collections - 创建领取安排
 * PUT /api/bid-notification-collections - 更新领取安排
 * DELETE /api/bid-notification-collections - 删除领取安排
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getNotificationCollections,
  getNotificationCollectionById,
  createNotificationCollection,
  updateNotificationCollection,
  deleteNotificationCollection,
  getNotificationCollectionStats,
  getUsersForSelect,
  getProjectsForSelect,
} from '@/lib/bid-notification-collection/service';

// GET - 获取领取安排列表或统计数据
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    
    // 如果请求统计数据
    if (searchParams.get('stats') === 'true') {
      const stats = await getNotificationCollectionStats();
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
      const collection = await getNotificationCollectionById(parseInt(id));
      if (!collection) {
        return NextResponse.json({ error: '领取安排不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: collection });
    }

    // 获取筛选参数
    const status = searchParams.get('status') || undefined;
    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const keyword = searchParams.get('keyword') || undefined;

    const collections = await getNotificationCollections({
      status,
      projectId,
      keyword,
    });

    return NextResponse.json({ success: true, data: collections });
  } catch (error) {
    console.error('获取领取安排失败:', error);
    return NextResponse.json({ error: '获取领取安排失败' }, { status: 500 });
  }
}

// POST - 创建领取安排
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

    const collection = await createNotificationCollection({
      ...body,
      createdBy: session.user.id,
    });

    return NextResponse.json({ success: true, data: collection });
  } catch (error) {
    console.error('创建领取安排失败:', error);
    return NextResponse.json({ error: '创建领取安排失败' }, { status: 500 });
  }
}

// PUT - 更新领取安排
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...collectionData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少ID参数' }, { status: 400 });
    }

    const collection = await updateNotificationCollection(id, collectionData);

    return NextResponse.json({ success: true, data: collection });
  } catch (error) {
    console.error('更新领取安排失败:', error);
    return NextResponse.json({ error: '更新领取安排失败' }, { status: 500 });
  }
}

// DELETE - 删除领取安排
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

    await deleteNotificationCollection(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除领取安排失败:', error);
    return NextResponse.json({ error: '删除领取安排失败' }, { status: 500 });
  }
}

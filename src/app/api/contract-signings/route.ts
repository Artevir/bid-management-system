/**
 * 签订书面合同API路由
 * GET /api/contract-signings - 获取合同签订列表
 * POST /api/contract-signings - 创建合同签订
 * PUT /api/contract-signings - 更新合同签订
 * DELETE /api/contract-signings - 删除合同签订
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getContractSignings,
  getContractSigningById,
  createContractSigning,
  updateContractSigning,
  deleteContractSigning,
  getContractSigningStats,
  getUsersForSelect,
  getProjectsForSelect,
} from '@/lib/contract-signing/service';

// GET - 获取合同签订列表或统计数据
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    
    // 如果请求统计数据
    if (searchParams.get('stats') === 'true') {
      const stats = await getContractSigningStats();
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
      const contract = await getContractSigningById(parseInt(id));
      if (!contract) {
        return NextResponse.json({ error: '合同签订记录不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: contract });
    }

    // 获取筛选参数
    const status = searchParams.get('status') || undefined;
    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const keyword = searchParams.get('keyword') || undefined;

    const contracts = await getContractSignings({
      status,
      projectId,
      keyword,
    });

    return NextResponse.json({ success: true, data: contracts });
  } catch (error) {
    console.error('获取合同签订失败:', error);
    return NextResponse.json({ error: '获取合同签订失败' }, { status: 500 });
  }
}

// POST - 创建合同签订
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
    if (!body.contractName) {
      return NextResponse.json({ error: '合同名称不能为空' }, { status: 400 });
    }

    const contract = await createContractSigning({
      ...body,
      createdBy: session.user.id,
    });

    return NextResponse.json({ success: true, data: contract });
  } catch (error) {
    console.error('创建合同签订失败:', error);
    return NextResponse.json({ error: '创建合同签订失败' }, { status: 500 });
  }
}

// PUT - 更新合同签订
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...contractData } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少ID参数' }, { status: 400 });
    }

    const contract = await updateContractSigning(id, contractData);

    return NextResponse.json({ success: true, data: contract });
  } catch (error) {
    console.error('更新合同签订失败:', error);
    return NextResponse.json({ error: '更新合同签订失败' }, { status: 500 });
  }
}

// DELETE - 删除合同签订
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

    await deleteContractSigning(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除合同签订失败:', error);
    return NextResponse.json({ error: '删除合同签订失败' }, { status: 500 });
  }
}

/**
 * 签署任务API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  createSignTask,
  getSignTasks,
  getSignTaskById,
  updateSignTask,
  cancelSignTask,
  initiateSignTask,
  getSignStatistics,
  createSigner,
  getSignersByTaskId,
} from '@/lib/e-sign/service';

// GET /api/e-sign/tasks - 获取签署任务列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    
    // 特殊路由：统计信息
    const path = req.nextUrl.pathname;
    if (path.endsWith('/statistics')) {
      const companyId = searchParams.get('companyId') ? parseInt(searchParams.get('companyId')!) : undefined;
      const stats = await getSignStatistics(companyId);
      return NextResponse.json(stats);
    }

    const filters = {
      projectId: searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined,
      configId: searchParams.get('configId') ? parseInt(searchParams.get('configId')!) : undefined,
      status: searchParams.get('status') || undefined,
      createdBy: searchParams.get('createdBy') ? parseInt(searchParams.get('createdBy')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    };

    const result = await getSignTasks(filters);

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取签署任务列表失败:', error);
    return NextResponse.json({ error: '获取签署任务列表失败' }, { status: 500 });
  }
}

// POST /api/e-sign/tasks - 创建签署任务
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const task = await createSignTask({
      title: body.title,
      description: body.description || null,
      projectId: body.projectId || null,
      documentId: body.documentId || null,
      fileId: body.fileId || null,
      configId: body.configId,
      documentUrl: body.documentUrl || null,
      status: 'draft',
      expireAt: body.expireAt ? new Date(body.expireAt) : null,
      callbackUrl: body.callbackUrl || null,
      createdBy: session.user.id,
    });

    // 如果提供了签署者列表，创建签署者
    if (body.signers && Array.isArray(body.signers)) {
      for (let i = 0; i < body.signers.length; i++) {
        const signer = body.signers[i];
        await createSigner({
          taskId: task.id,
          signerType: signer.signerType,
          signerName: signer.signerName,
          companyId: signer.companyId || null,
          creditCode: signer.creditCode || null,
          userId: signer.userId || null,
          idCard: signer.idCard || null,
          mobile: signer.mobile || null,
          email: signer.email || null,
          sealId: signer.sealId || null,
          signPosition: signer.signPosition || null,
          sortOrder: i,
        });
      }
    }

    // 如果需要立即发起签署
    if (body.initiate) {
      const initiatedTask = await initiateSignTask(task.id);
      return NextResponse.json(initiatedTask);
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('创建签署任务失败:', error);
    return NextResponse.json({ error: '创建签署任务失败' }, { status: 500 });
  }
}

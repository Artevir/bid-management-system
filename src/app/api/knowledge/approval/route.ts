/**
 * 知识入库审批API
 * GET: 获取待审批列表或审批详情
 * POST: 提交审批、处理审批
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  submitApprovalRequest,
  processApprovalStep,
  getApprovalRequest,
  getPendingApprovals,
  getMyApprovalRequests,
  getApprovalConfig,
  setApprovalConfig,
} from '@/lib/knowledge/approval';

// ============================================
// 获取待审批列表
// ============================================

async function getPendingList(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const approvals = await getPendingApprovals(userId);

    return NextResponse.json({
      approvals,
      total: approvals.length,
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    return NextResponse.json({ error: '获取待审批列表失败' }, { status: 500 });
  }
}

// ============================================
// 获取审批详情
// ============================================

async function getDetail(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = parseInt(searchParams.get('requestId') || '0');

    if (!requestId) {
      return NextResponse.json({ error: '缺少审批请求ID' }, { status: 400 });
    }

    const detail = await getApprovalRequest(requestId);

    if (!detail) {
      return NextResponse.json({ error: '审批请求不存在' }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (error) {
    console.error('Get approval detail error:', error);
    return NextResponse.json({ error: '获取审批详情失败' }, { status: 500 });
  }
}

// ============================================
// 获取我提交的审批
// ============================================

async function getMyRequests(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const requests = await getMyApprovalRequests(userId);

    return NextResponse.json({
      requests,
      total: requests.length,
    });
  } catch (error) {
    console.error('Get my approval requests error:', error);
    return NextResponse.json({ error: '获取审批列表失败' }, { status: 500 });
  }
}

// ============================================
// 获取审批配置
// ============================================

async function getConfig(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = parseInt(searchParams.get('categoryId') || '0');

    if (!categoryId) {
      return NextResponse.json({ error: '缺少分类ID' }, { status: 400 });
    }

    const config = await getApprovalConfig(categoryId);

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Get approval config error:', error);
    return NextResponse.json({ error: '获取审批配置失败' }, { status: 500 });
  }
}

// ============================================
// 提交审批申请
// ============================================

async function submitRequest(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { itemId, reason } = body;

    if (!itemId) {
      return NextResponse.json({ error: '缺少知识条目ID' }, { status: 400 });
    }

    const requestId = await submitApprovalRequest({
      itemId,
      requesterId: userId,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: requestId ? '审批申请已提交' : '自动审批通过',
      requestId,
    });
  } catch (error) {
    console.error('Submit approval request error:', error);
    const message = error instanceof Error ? error.message : '提交审批失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================
// 处理审批
// ============================================

async function processApproval(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { requestId, action, comment } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    if (!['approve', 'reject', 'return'].includes(action)) {
      return NextResponse.json({ error: '无效的审批动作' }, { status: 400 });
    }

    const result = await processApprovalStep({
      requestId,
      reviewerId: userId,
      action,
      comment,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Process approval error:', error);
    const message = error instanceof Error ? error.message : '处理审批失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================
// 设置审批配置
// ============================================

async function updateConfig(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { categoryId, reviewers, requireAllApprove, minApprovals } = body;

    if (!categoryId || !reviewers || reviewers.length === 0) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    await setApprovalConfig(categoryId, {
      categoryId,
      reviewers,
      requireAllApprove: requireAllApprove ?? false,
      minApprovals: minApprovals ?? 1,
    });

    return NextResponse.json({
      success: true,
      message: '审批配置已更新',
    });
  } catch (error) {
    console.error('Update approval config error:', error);
    return NextResponse.json({ error: '更新审批配置失败' }, { status: 500 });
  }
}

// ============================================
// 路由分发
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'detail') {
    return withAuth(request, getDetail);
  }

  if (action === 'my') {
    return withAuth(request, getMyRequests);
  }

  if (action === 'config') {
    return withAuth(request, getConfig);
  }

  return withAuth(request, getPendingList);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'submit') {
    return withAuth(request, submitRequest);
  }

  if (action === 'process') {
    return withAuth(request, processApproval);
  }

  if (action === 'config') {
    return withAuth(request, updateConfig);
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

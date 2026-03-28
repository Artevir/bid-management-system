/**
 * 审核流程API
 * POST: 提交审核/执行审批操作
 * GET: 获取待审批列表/审核流程详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  submitForApproval,
  executeApproval,
  getPendingApprovals,
  getApprovalFlowDetail,
  withdrawApproval,
  ApprovalLevel,
} from '@/lib/bid/approval';

// 提交审核
async function submitApproval(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    await submitForApproval(documentId, userId);

    return NextResponse.json({
      success: true,
      message: '已提交审核',
    });
  } catch (error) {
    console.error('Submit approval error:', error);
    const message = error instanceof Error ? error.message : '提交审核失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 执行审批操作
async function executeApprovalAction(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { documentId, level, action, comment } = body;

    if (!documentId || !level || !action) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    await executeApproval(
      documentId,
      userId,
      level as ApprovalLevel,
      action,
      comment
    );

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? '已通过' : '已驳回',
    });
  } catch (error) {
    console.error('Execute approval error:', error);
    const message = error instanceof Error ? error.message : '执行审批失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 撤回审核
async function withdrawApprovalAction(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    await withdrawApproval(documentId, userId);

    return NextResponse.json({
      success: true,
      message: '已撤回审核',
    });
  } catch (error) {
    console.error('Withdraw approval error:', error);
    const message = error instanceof Error ? error.message : '撤回审核失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 获取待审批列表
async function getApprovalList(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const approvals = await getPendingApprovals(userId);

    return NextResponse.json({
      approvals,
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    return NextResponse.json({ error: '获取待审批列表失败' }, { status: 500 });
  }
}

// 获取审核流程详情
async function getFlowDetail(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    const detail = await getApprovalFlowDetail(parseInt(documentId));
    return NextResponse.json(detail);
  } catch (error) {
    console.error('Get flow detail error:', error);
    return NextResponse.json({ error: '获取审核流程详情失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'execute':
      return withAuth(request, (req, userId) => executeApprovalAction(req, userId));
    case 'withdraw':
      return withAuth(request, (req, userId) => withdrawApprovalAction(req, userId));
    default:
      return withAuth(request, (req, userId) => submitApproval(req, userId));
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'detail':
      return withAuth(request, (req, userId) => getFlowDetail(req, userId));
    default:
      return withAuth(request, (req, userId) => getApprovalList(req, userId));
  }
}

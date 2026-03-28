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
} from '@/lib/bid/approval';
import { success, AppError, handleError } from '@/lib/api/error-handler';
import { ApprovalLevel } from '@/types/bid';

// 提交审核
async function submitApproval(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { documentId } = body;

  if (!documentId) {
    throw AppError.badRequest('缺少文档ID');
  }

  await submitForApproval(documentId, userId);

  return success(null, '已提交审核');
}

// 执行审批操作
async function executeApprovalAction(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { documentId, level, action, comment } = body;

  if (!documentId || !level || !action) {
    throw AppError.badRequest('缺少必填参数: documentId, level, action');
  }

  await executeApproval(
    documentId,
    userId,
    level as ApprovalLevel,
    action,
    comment
  );

  return success(null, action === 'approve' ? '已通过' : '已驳回');
}

// 撤回审核
async function withdrawApprovalAction(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { documentId } = body;

  if (!documentId) {
    throw AppError.badRequest('缺少文档ID');
  }

  await withdrawApproval(documentId, userId);

  return success(null, '已撤回审核');
}

// 获取待审批列表或流程详情
async function getApprovals(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  if (documentId) {
    const detail = await getApprovalFlowDetail(parseInt(documentId, 10));
    return success(detail);
  }

  const pending = await getPendingApprovals(userId);
  return success({ pending });
}

export async function GET(request: NextRequest) {
  return withAuth(request, getApprovals);
}

export async function POST(request: NextRequest) {
  const body = await request.clone().json().catch(() => ({}));
  if (body.action === 'withdraw') {
    return withAuth(request, withdrawApprovalAction);
  }
  if (body.level && body.action) {
    return withAuth(request, executeApprovalAction);
  }
  return withAuth(request, submitApproval);
}

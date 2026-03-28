/**
 * 审核流程查询API
 * GET: 获取待审批列表/审核流程详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getPendingApprovals,
  getApprovalFlowDetail,
} from '@/lib/bid/approval';
import { success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

// 获取待审批列表或流程详情
async function getApprovals(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const documentIdStr = searchParams.get('documentId');

  if (documentIdStr) {
    const documentId = parseResourceId(documentIdStr, '文档');
    const detail = await getApprovalFlowDetail(documentId);
    return success(detail);
  }

  const pending = await getPendingApprovals(userId);
  return success(pending);
}

export async function GET(request: NextRequest) {
  return withAuth(request, getApprovals);
}

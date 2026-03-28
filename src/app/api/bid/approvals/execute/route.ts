/**
 * 执行审批API
 * POST: 审批通过或驳回
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { executeApproval } from '@/lib/bid/approval';
import { success, AppError } from '@/lib/api/error-handler';
import { ApprovalLevel } from '@/types/bid';
import { parseResourceId } from '@/lib/api/validators';

async function execute(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { level, action, comment } = body;
  const documentId = parseResourceId(body.documentId?.toString(), '文档');

  if (!level || !action) {
    throw AppError.badRequest('缺少必填参数: level, action');
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

export async function POST(request: NextRequest) {
  return withAuth(request, execute);
}

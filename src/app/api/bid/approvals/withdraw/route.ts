/**
 * 撤回审核API
 * POST: 撤回已提交的审核申请
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { withdrawApproval } from '@/lib/bid/approval';
import { success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

async function withdraw(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const documentId = parseResourceId(body.documentId?.toString(), '文档');

  await withdrawApproval(documentId, userId);

  return success(null, '已撤回审核');
}

export async function POST(request: NextRequest) {
  return withAuth(request, withdraw);
}

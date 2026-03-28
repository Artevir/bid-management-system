/**
 * 提交审核API
 * POST: 提交文档进入审核流程
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { submitForApproval } from '@/lib/bid/approval';
import { success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

async function submit(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const documentId = parseResourceId(body.documentId?.toString(), '文档');

  await submitForApproval(documentId, userId);

  return success(null, '已提交审核');
}

export async function POST(request: NextRequest) {
  return withAuth(request, submit);
}

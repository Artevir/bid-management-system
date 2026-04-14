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
import { db } from '@/db';
import { approvalFlows, bidDocuments } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

async function resolveApprovalLevel(
  documentId: number,
  userId: number,
  inputLevel?: ApprovalLevel
): Promise<ApprovalLevel> {
  if (inputLevel) return inputLevel;

  const [document] = await db
    .select({
      currentApprovalLevel: bidDocuments.currentApprovalLevel,
    })
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  const currentLevel = document?.currentApprovalLevel as ApprovalLevel | null;
  if (currentLevel) {
    const [flow] = await db
      .select({ id: approvalFlows.id })
      .from(approvalFlows)
      .where(
        and(
          eq(approvalFlows.documentId, documentId),
          eq(approvalFlows.level, currentLevel),
          eq(approvalFlows.status, 'pending'),
          eq(approvalFlows.assigneeId, userId)
        )
      )
      .limit(1);
    if (flow) return currentLevel;
  }

  const [fallbackFlow] = await db
    .select({ level: approvalFlows.level })
    .from(approvalFlows)
    .where(
      and(
        eq(approvalFlows.documentId, documentId),
        eq(approvalFlows.status, 'pending'),
        eq(approvalFlows.assigneeId, userId)
      )
    )
    .limit(1);

  if (!fallbackFlow) {
    throw AppError.badRequest('缺少必填参数: level');
  }
  return fallbackFlow.level as ApprovalLevel;
}

async function execute(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { level, action, comment } = body;
  const documentId = parseResourceId(body.documentId?.toString(), '文档');

  if (!action) {
    throw AppError.badRequest('缺少必填参数: action');
  }

  const approvalLevel = await resolveApprovalLevel(documentId, userId, level as ApprovalLevel | undefined);

  await executeApproval(
    documentId,
    userId,
    approvalLevel,
    action,
    comment
  );

  return success(null, action === 'approve' ? '已通过' : '已驳回');
}

export async function POST(request: NextRequest) {
  return withAuth(request, execute);
}

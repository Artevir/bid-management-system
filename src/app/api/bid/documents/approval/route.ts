/**
 * 投标文档审批流程管理API
 * 提供文档审批流程的CRUD功能
 *
 * GET: 获取文档的审批流程列表
 * POST: 创建审批流程
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { approvalFlows, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { success, created, AppError, handleError } from '@/lib/api/error-handler';

// ============================================
// GET - 获取文档的审批流程列表
// ============================================

async function getDocumentApprovalFlows(
  request: NextRequest,
  userId: number
) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const status = searchParams.get('status');

    if (!documentId) {
      throw AppError.badRequest('缺少文档ID');
    }

    // 构建查询条件
    const conditions = [eq(approvalFlows.documentId, parseInt(documentId))];

    if (status) {
      conditions.push(eq(approvalFlows.status, status as any));
    }

    // 查询审批流程
    const whereClause = and(...conditions);

    const flows = await db
      .select({
        id: approvalFlows.id,
        level: approvalFlows.level,
        status: approvalFlows.status,
        assigneeId: approvalFlows.assigneeId,
        assigneeName: users.realName,
        assignedAt: approvalFlows.assignedAt,
        dueDate: approvalFlows.dueDate,
        completedAt: approvalFlows.completedAt,
        comment: approvalFlows.comment,
      })
      .from(approvalFlows)
      .leftJoin(users, eq(approvalFlows.assigneeId, users.id))
      .where(whereClause)
      .orderBy(approvalFlows.level);

    return success({ flows });
  } catch (err) {
    throw err;
  }
}

// ============================================
// POST - 创建审批流程
// ============================================

async function createApprovalFlow(
  request: NextRequest,
  userId: number
) {
  try {
    const body = await request.json();
    const {
      documentId,
      level,
      assigneeId,
      dueDate,
      comment,
    } = body;

    if (!documentId || !level || !assigneeId) {
      throw AppError.badRequest('缺少必填字段：documentId, level, assigneeId');
    }

    // 创建审批流程
    const [flow] = await db
      .insert(approvalFlows)
      .values({
        documentId: parseInt(documentId),
        level,
        status: 'pending',
        assigneeId: parseInt(assigneeId),
        assignedAt: new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        comment,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: approvalFlows.id });

    return created(
      { flowId: flow.id },
      '审批流程创建成功'
    );
  } catch (err) {
    throw err;
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      return await getDocumentApprovalFlows(req, userId);
    } catch (error) {
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      return await createApprovalFlow(req, userId);
    } catch (error) {
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

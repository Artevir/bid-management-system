/**
 * 标书文档API
 * GET: 获取项目的标书文档列表
 * POST: 创建标书文档
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  createDocument,
  getProjectDocuments,
} from '@/lib/bid/service';
import { success, created, AppError } from '@/lib/api/error-handler';
import { hasProjectPermission } from '@/lib/project/member';

async function validateProjectAccess(projectId: number, userId: number) {
  const hasAccess = await hasProjectPermission(projectId, userId, 'view');
  if (!hasAccess) {
    throw AppError.forbidden('无权访问该项目');
  }
}

// 获取项目的标书文档列表
async function getDocuments(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    throw AppError.badRequest('缺少项目ID');
  }

  if (!/^\d+$/.test(projectId)) {
    throw AppError.badRequest('项目ID格式错误');
  }

  await validateProjectAccess(parseInt(projectId, 10), userId);

  const documents = await getProjectDocuments(parseInt(projectId, 10));

  return success({ documents });
}

// 创建标书文档
async function createNewDocument(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { projectId, name, templateId } = body;

  if (!projectId || !name) {
    throw AppError.badRequest('缺少必填字段：projectId, name');
  }

  await validateProjectAccess(projectId, userId);

  const documentId = await createDocument({
    projectId,
    name,
    templateId,
    userId,
  });

  return created(
    { documentId },
    '标书文档创建成功'
  );
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getDocuments(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createNewDocument(req, userId));
}

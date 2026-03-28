/**
 * 标书文档API
 * GET: 获取项目的标书文档列表
 * POST: 创建标书文档
 */

import { NextRequest, NextResponse } from 'next/server';
import { withProjectPermission } from '@/lib/auth/project-middleware';
import {
  createDocument,
  getProjectDocuments,
} from '@/lib/bid/documents-service';
import { success, created, AppError } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

// 获取项目的标书文档列表
async function getDocuments(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const projectIdStr = searchParams.get('projectId');
  const projectId = parseResourceId(projectIdStr, '项目');

  const documents = await getProjectDocuments(projectId);

  return success({ documents });
}

// 创建标书文档
async function createNewDocument(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { projectId: projectIdRaw, name, templateId } = body;

  if (!name) {
    throw AppError.badRequest('缺少项目名称');
  }

  const projectId = parseResourceId(projectIdRaw?.toString(), '项目');

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
  const { searchParams } = new URL(request.url);
  const projectId = parseResourceId(searchParams.get('projectId'), '项目');
  return withProjectPermission(request, projectId, 'view', getDocuments);
}

export async function POST(request: NextRequest) {
  const body = await request.clone().json().catch(() => ({}));
  const projectId = parseResourceId(body.projectId?.toString(), '项目');
  return withProjectPermission(request, projectId, 'edit', createNewDocument);
}

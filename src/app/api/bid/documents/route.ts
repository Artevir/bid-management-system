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

// 获取项目的标书文档列表
async function getDocuments(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      throw AppError.badRequest('缺少项目ID');
    }

    const documents = await getProjectDocuments(parseInt(projectId));

    return success({ documents });
  } catch (err) {
    throw err;
  }
}

// 创建标书文档
async function createNewDocument(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { projectId, name, templateId } = body;

    if (!projectId || !name) {
      throw AppError.badRequest('缺少必填字段：projectId, name');
    }

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
  } catch (err) {
    throw err;
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getDocuments(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createNewDocument(req, userId));
}

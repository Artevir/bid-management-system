/**
 * 投标文档统计和概览API
 * 提供文档相关的统计数据和概览信息
 *
 * GET: 获取文档统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getFullDocumentStatistics,
  getProjectDocumentStatistics,
} from '@/lib/bid/documents-service';
import { success, AppError, handleError } from '@/lib/api/error-handler';

// ============================================
// GET - 获取文档统计信息
// ============================================

async function getStats(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  const projectId = searchParams.get('projectId');

  // 如果提供了文档ID，获取单个文档的详细统计
  if (documentId) {
    const stats = await getFullDocumentStatistics(parseInt(documentId, 10));
    return success(stats);
  }

  // 如果提供了项目ID，获取项目的文档统计
  if (projectId) {
    const stats = await getProjectDocumentStatistics(parseInt(projectId, 10));
    return success(stats);
  }

  throw AppError.badRequest('缺少参数: documentId 或 projectId');
}

export async function GET(request: NextRequest) {
  return withAuth(request, getStats);
}

/**
 * 投标文档统计和概览API
 * 提供文档相关的统计数据和概览信息
 *
 * GET: 获取文档统计信息
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  bidDocuments,
  bidChapters,
  documentGenerationHistories,
  documentReviews,
} from '@/db/schema';
import { eq, and, count, sum, sql } from 'drizzle-orm';
import { success, AppError, handleError } from '@/lib/api/error-handler';

// ============================================
// GET - 获取文档统计信息
// ============================================

async function getDocumentStatistics(
  request: NextRequest,
  userId: number
) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const projectId = searchParams.get('projectId');

    // 如果提供了文档ID，获取单个文档的详细统计
    if (documentId) {
      return getSingleDocumentStatistics(parseInt(documentId));
    }

    // 如果提供了项目ID，获取项目的文档统计
    if (projectId) {
      return getProjectDocumentStatistics(parseInt(projectId));
    }

    throw AppError.badRequest('缺少文档ID或项目ID');
  } catch (err) {
    throw err;
  }

  // ============================================
  // 单个文档统计
  // ============================================

  async function getSingleDocumentStatistics(docId: number) {
    // 获取文档基本信息
    const docs = await db
      .select()
      .from(bidDocuments)
      .where(eq(bidDocuments.id, docId))
      .limit(1);

    if (docs.length === 0) {
      throw AppError.notFound('文档');
    }

    const doc = docs[0];

    // 获取章节统计
    const chapterStats = await db
      .select({
        total: count(),
        completed: count(sql`CASE WHEN is_completed = true THEN 1 END`),
        totalWords: sum(bidChapters.wordCount),
      })
      .from(bidChapters)
      .where(eq(bidChapters.documentId, docId));

    // 获取生成历史统计
    const generationStats = await db
      .select({
        count: count(),
      })
      .from(documentGenerationHistories)
      .where(eq(documentGenerationHistories.documentId, docId));

    // 获取审查统计
    const reviewStats = await db
      .select({
        count: count(),
        pending: count(sql`CASE WHEN status = 'pending' THEN 1 END`),
        completed: count(sql`CASE WHEN status = 'completed' THEN 1 END`),
      })
      .from(documentReviews)
      .where(eq(documentReviews.documentId, docId));

    return success({
      document: {
        id: doc.id,
        name: doc.name,
        status: doc.status,
        version: doc.version,
        progress: doc.progress,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
      chapters: {
        total: chapterStats[0]?.total || 0,
        completed: chapterStats[0]?.completed || 0,
        totalWords: chapterStats[0]?.totalWords || 0,
      },
      generations: {
        count: generationStats[0]?.count || 0,
      },
      reviews: {
        total: reviewStats[0]?.count || 0,
        pending: reviewStats[0]?.pending || 0,
        completed: reviewStats[0]?.completed || 0,
      },
    });
  }

  // ============================================
  // 项目文档统计
  // ============================================

  async function getProjectDocumentStatistics(projId: number) {
    // 获取项目文档统计
    const docStats = await db
      .select({
        total: count(),
        draft: count(sql`CASE WHEN status = 'draft' THEN 1 END`),
        editing: count(sql`CASE WHEN status = 'editing' THEN 1 END`),
        reviewing: count(sql`CASE WHEN status = 'reviewing' THEN 1 END`),
        approved: count(sql`CASE WHEN status = 'approved' THEN 1 END`),
        published: count(sql`CASE WHEN status = 'published' THEN 1 END`),
      })
      .from(bidDocuments)
      .where(eq(bidDocuments.projectId, projId));

    // 获取项目总字数
    const totalWords = await db
      .select({
        sum: sum(bidChapters.wordCount),
      })
      .from(bidChapters)
      .innerJoin(
        bidDocuments,
        eq(bidChapters.documentId, bidDocuments.id)
      )
      .where(eq(bidDocuments.projectId, projId));

    return success({
      documents: {
        total: docStats[0]?.total || 0,
        draft: docStats[0]?.draft || 0,
        editing: docStats[0]?.editing || 0,
        reviewing: docStats[0]?.reviewing || 0,
        approved: docStats[0]?.approved || 0,
        published: docStats[0]?.published || 0,
      },
      chapters: {
        totalWords: totalWords[0]?.sum || 0,
      },
    });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      return await getDocumentStatistics(req, userId);
    } catch (error) {
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

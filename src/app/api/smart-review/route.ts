import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { smartReviewDocuments } from '@/db/smart-review-schema';
import { eq, desc, asc, like, or, and, sql, SQL } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

const allowedDocumentStatuses = [
  'uploading',
  'parsing',
  'parsed',
  'reviewing',
  'approved',
  'rejected',
  'archived',
] as const;

const allowedReviewStatuses = [
  'pending',
  'in_progress',
  'approved',
  'rejected',
  'needs_revision',
] as const;

type DocumentStatus = (typeof allowedDocumentStatuses)[number];
type ReviewStatus = (typeof allowedReviewStatuses)[number];

function toDocumentStatus(value: string | null): DocumentStatus | null {
  if (!value || value === 'all') return null;
  return (allowedDocumentStatuses as readonly string[]).includes(value)
    ? (value as DocumentStatus)
    : null;
}

function toReviewStatus(value: string | null): ReviewStatus | null {
  if (!value || value === 'all') return null;
  return (allowedReviewStatuses as readonly string[]).includes(value)
    ? (value as ReviewStatus)
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get('status');
    const rawReviewStatus = searchParams.get('reviewStatus');
    const status = toDocumentStatus(rawStatus);
    const reviewStatus = toReviewStatus(rawReviewStatus);
    if (rawStatus && rawStatus !== 'all' && !status) {
      return NextResponse.json({ error: '无效的status参数' }, { status: 400 });
    }
    if (rawReviewStatus && rawReviewStatus !== 'all' && !reviewStatus) {
      return NextResponse.json({ error: '无效的reviewStatus参数' }, { status: 400 });
    }
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20)
    );
    const keyword = searchParams.get('keyword');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const conditions: SQL<unknown>[] = [];

    if (status) {
      conditions.push(eq(smartReviewDocuments.status, status));
    }

    if (reviewStatus) {
      conditions.push(eq(smartReviewDocuments.reviewStatus, reviewStatus));
    }

    if (keyword) {
      const keywordCondition = or(
        like(smartReviewDocuments.fileName, `%${keyword}%`),
        like(smartReviewDocuments.projectName, `%${keyword}%`),
        like(smartReviewDocuments.projectCode, `%${keyword}%`)
      );
      if (keywordCondition) {
        conditions.push(keywordCondition);
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (page - 1) * pageSize;
    const orderColumn =
      sortBy === 'projectName'
        ? smartReviewDocuments.projectName
        : sortBy === 'fileName'
          ? smartReviewDocuments.fileName
          : smartReviewDocuments.createdAt;
    const orderFn = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    const [documents, totalCount, statsRows] = await Promise.all([
      db
        .select()
        .from(smartReviewDocuments)
        .where(whereClause)
        .orderBy(orderFn)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(smartReviewDocuments)
        .where(whereClause),
      db
        .select({
          total: sql<number>`count(*)::int`,
          pendingReviewCount: sql<number>`sum(case when ${smartReviewDocuments.reviewStatus} = 'pending' then 1 else 0 end)::int`,
          parsedCount: sql<number>`sum(case when ${smartReviewDocuments.status} = 'parsed' then 1 else 0 end)::int`,
          approvedCount: sql<number>`sum(case when ${smartReviewDocuments.reviewStatus} = 'approved' then 1 else 0 end)::int`,
        })
        .from(smartReviewDocuments)
        .where(whereClause),
    ]);
    const stats = statsRows[0] || {
      total: 0,
      pendingReviewCount: 0,
      parsedCount: 0,
      approvedCount: 0,
    };

    return NextResponse.json({
      documents,
      total: totalCount[0]?.count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((totalCount[0]?.count || 0) / pageSize),
      stats: {
        total: stats.total ?? 0,
        pendingReviewCount: stats.pendingReviewCount ?? 0,
        parsedCount: stats.parsedCount ?? 0,
        approvedCount: stats.approvedCount ?? 0,
      },
    });
  } catch (error) {
    console.error('Get smart review documents error:', error);
    return NextResponse.json({ error: '获取文档列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const {
      fileName,
      fileUrl,
      fileExt,
      fileSize,
      filePageCount,
      fileMd5,
      projectName,
      projectCode,
      tenderOrganization,
      tenderAgent,
      projectBudget,
      tenderMethod,
      tenderScope,
      projectLocation,
      projectOverview,
      fundSource,
    } = body;

    if (!fileName || !fileUrl || !fileExt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查是否已存在相同MD5的文件
    if (fileMd5) {
      const existing = await db
        .select({ id: smartReviewDocuments.id })
        .from(smartReviewDocuments)
        .where(eq(smartReviewDocuments.fileMd5, fileMd5))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: '文件已存在', existingId: existing[0].id },
          { status: 409 }
        );
      }
    }

    const [document] = await db
      .insert(smartReviewDocuments)
      .values({
        fileName,
        fileUrl,
        fileExt,
        fileSize,
        filePageCount,
        fileMd5,
        projectName,
        projectCode,
        tenderOrganization,
        tenderAgent,
        projectBudget,
        tenderMethod,
        tenderScope,
        projectLocation,
        projectOverview,
        fundSource,
        uploaderId: currentUser.userId,
        status: 'uploading',
        reviewStatus: 'pending',
      })
      .returning();

    return NextResponse.json({
      message: '文档创建成功',
      document,
    });
  } catch (error) {
    console.error('Create smart review document error:', error);
    return NextResponse.json({ error: '创建文档失败' }, { status: 500 });
  }
}

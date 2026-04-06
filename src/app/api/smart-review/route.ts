import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { smartReviewDocuments } from '@/db/smart-review-schema';
import { eq, desc, asc, like, or, and, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const reviewStatus = searchParams.get('reviewStatus');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const keyword = searchParams.get('keyword');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const conditions: any[] = [];

    if (status && status !== 'all') {
      conditions.push(eq(smartReviewDocuments.status, status));
    }

    if (reviewStatus && reviewStatus !== 'all') {
      conditions.push(eq(smartReviewDocuments.reviewStatus, reviewStatus));
    }

    if (keyword) {
      conditions.push(
        or(
          like(smartReviewDocuments.fileName, `%${keyword}%`),
          like(smartReviewDocuments.projectName, `%${keyword}%`),
          like(smartReviewDocuments.projectCode, `%${keyword}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (page - 1) * pageSize;
    const orderColumn = sortBy === 'projectName' ? smartReviewDocuments.projectName :
                       sortBy === 'fileName' ? smartReviewDocuments.fileName :
                       smartReviewDocuments.createdAt;
    const orderFn = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    const [documents, totalCount] = await Promise.all([
      db.select()
        .from(smartReviewDocuments)
        .where(whereClause)
        .orderBy(orderFn)
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(smartReviewDocuments)
        .where(whereClause),
    ]);

    return NextResponse.json({
      documents,
      total: totalCount[0]?.count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((totalCount[0]?.count || 0) / pageSize),
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
        uploaderId: currentUser.id,
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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { smartReviewDocuments, smartReviewRecords } from '@/db/smart-review-schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const documentId = parseInt(id);
    
    if (isNaN(documentId)) {
      return NextResponse.json({ error: '无效的文档ID' }, { status: 400 });
    }

    const [document] = await db
      .select()
      .from(smartReviewDocuments)
      .where(eq(smartReviewDocuments.id, documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    const body = await request.json();
    const { status, comment, accuracy, issuesFound, suggestions } = body;

    if (!status) {
      return NextResponse.json({ error: '缺少审核状态' }, { status: 400 });
    }

    if (!['approved', 'rejected', 'needs_revision', 'in_progress'].includes(status)) {
      return NextResponse.json({ error: '无效的审核状态' }, { status: 400 });
    }

    // 创建审核记录
    const approvalLevel = document.currentApprovalLevel || 1;
    
    const [record] = await db
      .insert(smartReviewRecords)
      .values({
        documentId,
        reviewerId: currentUser.id,
        approvalLevel,
        status,
        comment,
        accuracy,
        issuesFound: issuesFound || [],
        suggestions: suggestions || [],
      })
      .returning();

    // 更新文档审核状态
    let newApprovalLevel = approvalLevel;
    let newReviewStatus = document.reviewStatus;

    if (status === 'approved') {
      newApprovalLevel = approvalLevel + 1;
      if (newApprovalLevel >= (document.approvalLevelRequired || 1)) {
        newReviewStatus = 'approved';
      } else {
        newReviewStatus = 'in_progress';
      }
    } else if (status === 'rejected') {
      newReviewStatus = 'rejected';
    } else if (status === 'needs_revision') {
      newReviewStatus = 'needs_revision';
    } else {
      newReviewStatus = 'in_progress';
    }

    await db
      .update(smartReviewDocuments)
      .set({
        reviewStatus: newReviewStatus,
        currentApprovalLevel: newApprovalLevel,
        reviewerId: currentUser.id,
        reviewComment: comment,
        reviewAccuracy: accuracy,
        reviewCompletedAt: new Date(),
        approvalHistory: [
          ...(document.approvalHistory || []),
          {
            level: approvalLevel,
            reviewerId: currentUser.id,
            status,
            comment,
            timestamp: new Date().toISOString(),
          },
        ],
        updatedAt: new Date(),
      })
      .where(eq(smartReviewDocuments.id, documentId));

    return NextResponse.json({
      message: '审核提交成功',
      record,
    });
  } catch (error) {
    console.error('Submit smart review error:', error);
    return NextResponse.json({ error: '提交审核失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentId = parseInt(id);
    
    if (isNaN(documentId)) {
      return NextResponse.json({ error: '无效的文档ID' }, { status: 400 });
    }

    // 获取审核历史
    const records = await db
      .select()
      .from(smartReviewRecords)
      .where(eq(smartReviewRecords.documentId, documentId))
      .orderBy(desc(smartReviewRecords.createdAt));

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Get smart review history error:', error);
    return NextResponse.json({ error: '获取审核历史失败' }, { status: 500 });
  }
}

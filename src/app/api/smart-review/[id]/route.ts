import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { smartReviewDocuments } from '@/db/smart-review-schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

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

    const [document] = await db
      .select()
      .from(smartReviewDocuments)
      .where(eq(smartReviewDocuments.id, documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Get smart review document error:', error);
    return NextResponse.json({ error: '获取文档失败' }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = await request.json();
    const {
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
      basicInfo,
      feeInfo,
      timeNodes,
      submissionRequirements,
      technicalSpecs,
      scoringItems,
      qualificationRequirements,
      framework,
      status,
      reviewStatus,
      reviewComment,
      confidentialityLevel,
    } = body;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (projectName !== undefined) updateData.projectName = projectName;
    if (projectCode !== undefined) updateData.projectCode = projectCode;
    if (tenderOrganization !== undefined) updateData.tenderOrganization = tenderOrganization;
    if (tenderAgent !== undefined) updateData.tenderAgent = tenderAgent;
    if (projectBudget !== undefined) updateData.projectBudget = projectBudget;
    if (tenderMethod !== undefined) updateData.tenderMethod = tenderMethod;
    if (tenderScope !== undefined) updateData.tenderScope = tenderScope;
    if (projectLocation !== undefined) updateData.projectLocation = projectLocation;
    if (projectOverview !== undefined) updateData.projectOverview = projectOverview;
    if (fundSource !== undefined) updateData.fundSource = fundSource;
    if (basicInfo !== undefined) updateData.basicInfo = basicInfo;
    if (feeInfo !== undefined) updateData.feeInfo = feeInfo;
    if (timeNodes !== undefined) updateData.timeNodes = timeNodes;
    if (submissionRequirements !== undefined) updateData.submissionRequirements = submissionRequirements;
    if (technicalSpecs !== undefined) updateData.technicalSpecs = technicalSpecs;
    if (scoringItems !== undefined) updateData.scoringItems = scoringItems;
    if (qualificationRequirements !== undefined) updateData.qualificationRequirements = qualificationRequirements;
    if (framework !== undefined) updateData.framework = framework;
    if (status !== undefined) updateData.status = status;
    if (reviewStatus !== undefined) updateData.reviewStatus = reviewStatus;
    if (reviewComment !== undefined) updateData.reviewComment = reviewComment;
    if (confidentialityLevel !== undefined) updateData.confidentialityLevel = confidentialityLevel;

    const [updated] = await db
      .update(smartReviewDocuments)
      .set(updateData)
      .where(eq(smartReviewDocuments.id, documentId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    return NextResponse.json({
      message: '文档更新成功',
      document: updated,
    });
  } catch (error) {
    console.error('Update smart review document error:', error);
    return NextResponse.json({ error: '更新文档失败' }, { status: 500 });
  }
}

export async function DELETE(
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

    const [deleted] = await db
      .delete(smartReviewDocuments)
      .where(eq(smartReviewDocuments.id, documentId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    return NextResponse.json({ message: '文档删除成功' });
  } catch (error) {
    console.error('Delete smart review document error:', error);
    return NextResponse.json({ error: '删除文档失败' }, { status: 500 });
  }
}

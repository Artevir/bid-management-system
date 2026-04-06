import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { smartReviewDocuments, smartResponseMatrix, smartResponseItems } from '@/db/smart-review-schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

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

    if (document.status !== 'parsed' && document.status !== 'approved') {
      return NextResponse.json({ error: '文档未解析完成，无法生成响应矩阵' }, { status: 400 });
    }

    // 获取文档中的技术规格和评分细则
    const technicalSpecs = (document.technicalSpecs || []) as any[];
    const scoringItems = (document.scoringItems || []) as any[];
    const qualificationRequirements = (document.qualificationRequirements || []) as any[];

    // 合并所有要求项
    const allRequirements = [
      ...(technicalSpecs.map((spec: any) => ({
        category: spec.category || '技术规格',
        item: spec.name || spec.specName || '',
        requirement: spec.requirement || spec.specRequirement || '',
        source: 'technical_spec',
      }))),
      ...(scoringItems.map((item: any) => ({
        category: item.category || '评分细则',
        item: item.itemName || '',
        requirement: item.criteria || '',
        source: 'scoring_item',
      }))),
      ...(qualificationRequirements.map((req: any) => ({
        category: req.category || '资质要求',
        item: req.requirement || req.name || '',
        requirement: req.description || '',
        source: 'qualification',
      }))),
    ];

    // 创建响应矩阵
    const [matrix] = await db
      .insert(smartResponseMatrix)
      .values({
        documentId,
        matrixName: `${document.projectName || document.fileName}_响应矩阵`,
        totalItems: allRequirements.length,
        respondedItems: 0,
        matchRate: 0,
        status: 'generating',
        generatedBy: currentUser.username,
        generatedAt: new Date(),
      })
      .returning();

    // 创建响应矩阵项
    if (allRequirements.length > 0) {
      const items = allRequirements.map((req: any) => ({
        matrixId: matrix.id,
        documentId,
        requirementCategory: req.category,
        requirementItem: req.item,
        requirementSource: req.source,
        isMatched: false,
        matchType: null,
        status: 'pending',
      }));

      await db.insert(smartResponseItems).values(items);
    }

    // 更新矩阵统计
    const [updatedMatrix] = await db
      .update(smartResponseMatrix)
      .set({
        status: 'completed',
        totalItems: allRequirements.length,
        respondedItems: 0,
        matchRate: 0,
        updatedAt: new Date(),
      })
      .where(eq(smartResponseMatrix.id, matrix.id))
      .returning();

    return NextResponse.json({
      message: '响应矩阵生成成功',
      matrix: updatedMatrix,
      itemCount: allRequirements.length,
    });
  } catch (error) {
    console.error('Generate response matrix error:', error);
    return NextResponse.json({ error: '生成响应矩阵失败' }, { status: 500 });
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

    // 获取响应矩阵
    const matrices = await db
      .select()
      .from(smartResponseMatrix)
      .where(eq(smartResponseMatrix.documentId, documentId))
      .orderBy(desc(smartResponseMatrix.createdAt));

    if (matrices.length === 0) {
      return NextResponse.json({ matrix: null, items: [] });
    }

    const matrix = matrices[0];

    // 获取响应矩阵项
    const items = await db
      .select()
      .from(smartResponseItems)
      .where(eq(smartResponseItems.matrixId, matrix.id));

    return NextResponse.json({ matrix, items });
  } catch (error) {
    console.error('Get response matrix error:', error);
    return NextResponse.json({ error: '获取响应矩阵失败' }, { status: 500 });
  }
}

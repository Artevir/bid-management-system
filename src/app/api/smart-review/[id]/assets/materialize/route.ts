import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  smartReviewDocuments,
  smartResponseItems,
  smartResponseMatrix,
} from '@/db/smart-review-schema';
import { getCurrentUser } from '@/lib/auth/jwt';
import { deriveSegmentsAndRequirements } from '@/lib/smart-review/assets';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const documentId = Number(id);
    if (!Number.isInteger(documentId) || documentId <= 0) {
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

    const { requirements } = deriveSegmentsAndRequirements(document);
    if (requirements.length === 0) {
      return NextResponse.json({
        success: true,
        message: '未提取到可入库要求资产',
        data: { documentId, matrixId: null, requirementCount: 0 },
      });
    }

    const [existingMatrix] = await db
      .select()
      .from(smartResponseMatrix)
      .where(
        and(
          eq(smartResponseMatrix.documentId, documentId),
          eq(smartResponseMatrix.matrixName, '要求资产主链路')
        )
      )
      .limit(1);

    const matrix =
      existingMatrix ??
      (
        await db
          .insert(smartResponseMatrix)
          .values({
            documentId,
            matrixName: '要求资产主链路',
            totalItems: 0,
            respondedItems: 0,
            matchRate: 0,
            status: 'completed',
            generatedBy: currentUser.username,
            generatedAt: new Date(),
          })
          .returning()
      )[0];

    await db.delete(smartResponseItems).where(eq(smartResponseItems.matrixId, matrix.id));

    await db.insert(smartResponseItems).values(
      requirements.map((item) => ({
        matrixId: matrix.id,
        documentId,
        requirementCategory: item.category,
        requirementItem: item.item,
        requirementSource: `${item.source}|segment:${item.segmentId}`,
        responseSource: JSON.stringify({
          segmentId: item.segmentId,
          source: item.source,
          confidence: item.confidence,
          isMandatory: item.isMandatory,
        }),
        responseContent: item.detail,
        confidence: item.confidence,
        status: 'pending',
      }))
    );

    await db
      .update(smartResponseMatrix)
      .set({
        totalItems: requirements.length,
        respondedItems: 0,
        matchRate: 0,
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(smartResponseMatrix.id, matrix.id));

    return NextResponse.json({
      success: true,
      message: '要求资产已写入主链路',
      data: {
        documentId,
        matrixId: matrix.id,
        requirementCount: requirements.length,
      },
    });
  } catch (error) {
    console.error('Materialize smart-review assets error:', error);
    return NextResponse.json({ error: '要求资产入库失败' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  smartReviewDocuments,
  smartResponseItems,
  smartResponseMatrix,
} from '@/db/smart-review-schema';
import { deriveSegmentsAndRequirements, type SmartAssetSegment } from '@/lib/smart-review/assets';

type RequirementRow = {
  requirementId: number;
  category: string;
  item: string;
  detail: string;
  status: string;
  confidence: number;
  segmentId: string;
  isMandatory: boolean;
};

function parseSegmentId(requirementSource: string | null): string {
  if (!requirementSource) return '';
  const parts = requirementSource.split('|');
  const segPart = parts.find((part) => part.startsWith('segment:'));
  return segPart ? segPart.replace('segment:', '') : '';
}

function parseMeta(responseSource: string | null): { isMandatory: boolean } {
  if (!responseSource) return { isMandatory: true };
  try {
    const parsed = JSON.parse(responseSource) as { isMandatory?: boolean };
    return { isMandatory: parsed.isMandatory ?? true };
  } catch {
    return { isMandatory: true };
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    const derived = deriveSegmentsAndRequirements(document);

    const [assetMatrix] = await db
      .select()
      .from(smartResponseMatrix)
      .where(
        and(
          eq(smartResponseMatrix.documentId, documentId),
          eq(smartResponseMatrix.matrixName, '要求资产主链路')
        )
      )
      .orderBy(desc(smartResponseMatrix.createdAt))
      .limit(1);

    const requirementRows = assetMatrix
      ? await db
          .select()
          .from(smartResponseItems)
          .where(eq(smartResponseItems.matrixId, assetMatrix.id))
          .orderBy(desc(smartResponseItems.id))
      : [];

    const requirements: RequirementRow[] =
      requirementRows.length > 0
        ? requirementRows.map((row) => {
            const meta = parseMeta(row.responseSource);
            return {
              requirementId: row.id,
              category: row.requirementCategory || '未分类',
              item: row.requirementItem,
              detail: row.responseContent || '',
              status: row.status,
              confidence: row.confidence || 0,
              segmentId: parseSegmentId(row.requirementSource),
              isMandatory: meta.isMandatory,
            };
          })
        : derived.requirements.map((row, index) => ({
            requirementId: -(index + 1),
            category: row.category,
            item: row.item,
            detail: row.detail,
            status: 'pending',
            confidence: row.confidence,
            segmentId: row.segmentId,
            isMandatory: row.isMandatory,
          }));

    const segmentMap = new Map<string, SmartAssetSegment>();
    derived.segments.forEach((segment) => {
      segmentMap.set(segment.segmentId, segment);
    });
    const activeSegments = derived.segments.filter((segment) =>
      requirements.some((row) => row.segmentId === segment.segmentId)
    );

    return NextResponse.json({
      success: true,
      data: {
        project: {
          projectName: document.projectName || '',
          projectCode: document.projectCode || '',
          tenderOrganization: document.tenderOrganization || '',
        },
        version: {
          versionId: `doc-${document.id}-v1`,
          versionNo: 'v1',
          status: document.status,
          updatedAt: document.updatedAt,
        },
        segments: (activeSegments.length > 0
          ? activeSegments
          : Array.from(segmentMap.values())
        ).sort((a, b) => a.orderNo - b.orderNo),
        requirements,
      },
    });
  } catch (error) {
    console.error('Get smart-review asset chain error:', error);
    return NextResponse.json({ error: '获取资产主链路失败' }, { status: 500 });
  }
}

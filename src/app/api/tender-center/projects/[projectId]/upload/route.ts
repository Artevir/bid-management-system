import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { db } from '@/db';
import {
  sourceDocuments,
  tenderProjectVersions,
  tenderProjects,
  tcHubDocumentCategoryEnum,
} from '@/db/schema';

const DOC_CATEGORIES = tcHubDocumentCategoryEnum.enumValues;

// 040: POST /api/tender-center/projects/{projectId}/upload — 写入 source_document（38 主表链路）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const pid = parseResourceId(projectId, '项目');

  return withAuth(request, async (_req, userId) => {
    const body = await request.json().catch(() => ({}));
    const {
      documentName,
      documentUrl,
      documentExt,
      documentSize,
      documentMd5,
      documentPageCount,
      mimeType,
      versionId: bodyVersionId,
      docCategory: rawDocCategory,
    } = body ?? {};

    if (!documentName || !documentUrl || !documentExt || !documentMd5) {
      throw AppError.badRequest(
        '缺少必要参数：documentName、documentUrl、documentExt、documentMd5'
      );
    }

    const project = await db.query.tenderProjects.findFirst({
      where: and(eq(tenderProjects.id, pid), eq(tenderProjects.isDeleted, false)),
    });
    if (!project) {
      throw AppError.notFound('项目');
    }
    if (project.createdBy && project.createdBy !== userId) {
      throw AppError.forbidden('无权向该项目上传文件');
    }

    let resolvedVersionId = project.currentVersionId ?? null;
    if (bodyVersionId != null && String(bodyVersionId).trim() !== '') {
      resolvedVersionId = parseResourceId(String(bodyVersionId), '版本');
    }
    if (!resolvedVersionId) {
      throw AppError.badRequest('请先创建项目版本，或在请求体中传入 versionId');
    }

    const version = await db.query.tenderProjectVersions.findFirst({
      where: and(
        eq(tenderProjectVersions.id, resolvedVersionId),
        eq(tenderProjectVersions.tenderProjectId, project.id),
        eq(tenderProjectVersions.isDeleted, false)
      ),
    });
    if (!version) {
      throw AppError.notFound('版本');
    }

    const cat = typeof rawDocCategory === 'string' ? rawDocCategory : 'tender_document';
    const docCategory = (DOC_CATEGORIES as readonly string[]).includes(cat)
      ? (cat as (typeof DOC_CATEGORIES)[number])
      : 'tender_document';

    const [row] = await db
      .insert(sourceDocuments)
      .values({
        tenderProjectVersionId: version.id,
        fileName: String(documentName).trim(),
        fileExt: String(documentExt).trim().slice(0, 32),
        mimeType: mimeType ? String(mimeType).slice(0, 128) : null,
        fileSize: documentSize != null ? Number(documentSize) : null,
        storageKey: String(documentUrl).trim(),
        checksum: String(documentMd5).trim().slice(0, 128),
        pageCount: documentPageCount != null ? Number(documentPageCount) : null,
        docCategory,
        parseStatus: 'not_started',
        textExtractStatus: 'pending',
        structureExtractStatus: 'pending',
      })
      .returning({ id: sourceDocuments.id });

    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
        versionId: version.id,
        sourceDocumentId: row.id,
      },
      message: '已登记原始文件（source_document）',
    });
  });
}

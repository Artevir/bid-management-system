import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, created, success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { tenderProjectVersions } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

type TenderCenterVersionSummary = {
  versionId: number;
  projectId: number;
  versionNo: string;
  status: string | null;
  isCurrent: boolean;
  createdAt: string;
};

// 040: GET /api/tender-center/projects/{projectId}/versions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const id = parseResourceId(projectId, '项目');

  return withAuth(request, async (_req, userId) => {
    const { project } = await resolveHubProjectAndVersion({
      projectId: String(id),
      userId,
    });
    const rows = await db.query.tenderProjectVersions.findMany({
      where: and(
        eq(tenderProjectVersions.tenderProjectId, project.id),
        eq(tenderProjectVersions.isDeleted, false)
      ),
      orderBy: [desc(tenderProjectVersions.createdAt)],
    });
    const versions: TenderCenterVersionSummary[] = rows.map((row) => ({
      versionId: row.id,
      projectId: row.tenderProjectId,
      versionNo: row.versionNo,
      status: row.versionLabel,
      isCurrent: row.isCurrent,
      createdAt: String(row.createdAt ?? ''),
    }));
    return success(versions);
  });
}

// 040 扩展: POST /api/tender-center/projects/{projectId}/versions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  return withAuth(request, async (_req, userId) => {
    const { project } = await resolveHubProjectAndVersion({
      projectId,
      userId,
    });
    const body = await request.json();
    if (!body.versionNo || !String(body.versionNo).trim()) {
      throw AppError.badRequest('版本号不能为空');
    }
    const [version] = await db
      .insert(tenderProjectVersions)
      .values({
        tenderProjectId: project.id,
        versionNo: String(body.versionNo).trim(),
        versionType: body.versionType || 'clarification',
        versionLabel: body.versionLabel || null,
        isCurrent: Boolean(body.isCurrent),
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
        sourceNote: body.sourceNote || null,
      })
      .returning({
        id: tenderProjectVersions.id,
        versionNo: tenderProjectVersions.versionNo,
      });
    return created(version, '版本创建成功');
  });
}

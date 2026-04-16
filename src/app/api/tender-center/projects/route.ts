import { and, desc, eq, sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { withAuth, withPermission } from '@/lib/auth/middleware';
import { parsePaginationParams } from '@/lib/api/validators';
import { AppError, created, paginated } from '@/lib/api/error-handler';
import { db } from '@/db';
import { tenderProjects, tenderProjectVersions } from '@/db/schema';

type TenderCenterProjectListItem = {
  projectId: number;
  projectName: string;
  projectCode: string | null;
  status: string;
  currentVersionId: number | null;
  updatedAt: string;
};

// 040: GET /api/tender-center/projects
async function listProjects(request: NextRequest, userId: number): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams(request.url);
  const keyword = searchParams.get('keyword')?.trim();
  const offset = (page - 1) * pageSize;

  const whereClause = and(
    eq(tenderProjects.isDeleted, false),
    eq(tenderProjects.createdBy, userId),
    keyword
      ? sql`(${tenderProjects.projectName} ILIKE ${`%${keyword}%`} OR ${tenderProjects.projectCode} ILIKE ${`%${keyword}%`})`
      : undefined
  );

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(tenderProjects)
      .where(whereClause)
      .orderBy(desc(tenderProjects.updatedAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tenderProjects)
      .where(whereClause),
  ]);

  const mapped: TenderCenterProjectListItem[] = items.map((item) => ({
    projectId: item.id,
    projectName: item.projectName,
    projectCode: item.projectCode,
    status: item.reviewStatus,
    currentVersionId: item.currentVersionId,
    updatedAt: String(item.updatedAt ?? ''),
  }));

  return paginated(mapped, Number(totalRow[0]?.count ?? 0), page, pageSize);
}

// 040: POST /api/tender-center/projects
async function createTenderProject(request: NextRequest, userId: number): Promise<NextResponse> {
  const body = await request.json();

  if (!body.projectName || !String(body.projectName).trim()) {
    throw AppError.badRequest('项目名称不能为空');
  }
  if (!body.projectCode || !String(body.projectCode).trim()) {
    throw AppError.badRequest('项目编码不能为空');
  }

  const [projectId, versionId] = await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(tenderProjects)
      .values({
        projectName: String(body.projectName).trim(),
        projectCode: String(body.projectCode).trim(),
        tenderMethod: body.tenderMethod,
        tendererName: body.tendererName,
        tenderAgentName: body.tenderAgentName,
        projectBudgetAmount: body.projectBudgetAmount,
        maxPriceAmount: body.maxPriceAmount,
        projectLocation: body.projectLocation,
        projectOverview: body.projectOverview,
        fundSource: body.fundSource,
        businessCategory: body.businessCategory,
        industryCategory: body.industryCategory,
        documentLanguage: body.documentLanguage,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: tenderProjects.id });

    const [version] = await tx
      .insert(tenderProjectVersions)
      .values({
        tenderProjectId: project.id,
        versionNo: body.versionNo || 'v1',
        versionType: body.versionType || 'original',
        versionLabel: body.versionLabel || '初始版本',
        isCurrent: true,
      })
      .returning({ id: tenderProjectVersions.id });

    await tx
      .update(tenderProjects)
      .set({
        currentVersionId: version.id,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(tenderProjects.id, project.id));
    return [project.id, version.id] as const;
  });

  return created({ projectId, versionId }, '中枢项目创建成功');
}

export async function GET(request: NextRequest) {
  return withAuth(request, listProjects);
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'project:create', createTenderProject);
}

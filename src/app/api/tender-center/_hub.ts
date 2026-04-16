import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { tenderProjects, tenderProjectVersions } from '@/db/schema';

type ResolveArgs = {
  projectId: string;
  versionId?: string;
  userId: number;
};

export async function resolveHubProjectAndVersion(args: ResolveArgs) {
  const pid = parseResourceId(args.projectId, '项目');
  const project = await db.query.tenderProjects.findFirst({
    where: and(eq(tenderProjects.id, pid), eq(tenderProjects.isDeleted, false)),
  });
  if (!project) {
    throw AppError.notFound('项目');
  }
  if (project.createdBy && project.createdBy !== args.userId) {
    throw AppError.forbidden('无权访问该项目');
  }

  if (!args.versionId) {
    return { project, version: null };
  }

  const vid = parseResourceId(args.versionId, '版本');
  const version = await db.query.tenderProjectVersions.findFirst({
    where: and(
      eq(tenderProjectVersions.id, vid),
      eq(tenderProjectVersions.tenderProjectId, project.id),
      eq(tenderProjectVersions.isDeleted, false)
    ),
  });
  if (!version) {
    throw AppError.notFound('版本');
  }
  return { project, version };
}

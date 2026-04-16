import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documentParseBatches, tenderProjectVersions, tenderProjects } from '@/db/schema';

/** 中枢：复核任务 ID（绑定 review_task 主表） */
export function toHubReviewTaskId(reviewTaskRowId: number): string {
  return `review-hub-${reviewTaskRowId}`;
}

/** 中枢：从 reviewTaskId 解析出 review_task.id */
export function parseHubReviewTaskId(reviewTaskId: string): number | null {
  const m = String(reviewTaskId || '').match(/^review-hub-(\d+)$/);
  if (!m) return null;
  return Number(m[1]);
}

/** 中枢：document_parse_batch 主键 */
export function toHubDocumentParseBatchId(documentParseBatchId: number): string {
  return `hub-batch-${documentParseBatchId}`;
}

export function parseHubDocumentParseBatchId(batchId: string): number | null {
  const m = String(batchId || '').match(/^hub-batch-(\d+)$/);
  if (!m) return null;
  return Number(m[1]);
}

export async function resolveHubDocumentParseBatchContext(batchId: string) {
  const id = parseHubDocumentParseBatchId(batchId);
  if (id === null) return null;
  const batch = await db.query.documentParseBatches.findFirst({
    where: and(eq(documentParseBatches.id, id), eq(documentParseBatches.isDeleted, false)),
  });
  if (!batch) return null;
  const version = await db.query.tenderProjectVersions.findFirst({
    where: and(
      eq(tenderProjectVersions.id, batch.tenderProjectVersionId),
      eq(tenderProjectVersions.isDeleted, false)
    ),
  });
  if (!version) return null;
  const project = await db.query.tenderProjects.findFirst({
    where: and(eq(tenderProjects.id, version.tenderProjectId), eq(tenderProjects.isDeleted, false)),
  });
  if (!project) return null;
  return { batch, version, project };
}

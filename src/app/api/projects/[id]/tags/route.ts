/**
 * 项目标签关联API
 * GET: 获取项目的标签列表
 * POST: 为项目添加标签
 * DELETE: 移除项目的标签
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projectTags, projectTagRelations, projects } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, created, success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function ensureProjectExists(projectId: number): Promise<void> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw AppError.notFound('项目');
  }
}

// GET /api/projects/[id]/tags - 获取项目的标签列表
async function getTags(
  _request: NextRequest,
  _userId: number,
  projectId: number
): Promise<NextResponse> {
  await ensureProjectExists(projectId);

  // 获取项目的标签
  const tagRelations = await db
    .select({
      id: projectTags.id,
      name: projectTags.name,
      color: projectTags.color,
      description: projectTags.description,
      addedAt: projectTagRelations.addedAt,
    })
    .from(projectTagRelations)
    .innerJoin(projectTags, eq(projectTagRelations.tagId, projectTags.id))
    .where(eq(projectTagRelations.projectId, projectId));

  return success({
    projectId,
    tags: tagRelations,
    total: tagRelations.length,
  });
}

// POST /api/projects/[id]/tags - 为项目添加标签
async function addTags(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  await ensureProjectExists(projectId);

  const body = await request.json();
  const { tagIds } = body;

  if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
    throw AppError.badRequest('请选择要添加的标签');
  }

  // 获取已存在的标签关联
  const existingRelations = await db
    .select()
    .from(projectTagRelations)
    .where(
      and(
        eq(projectTagRelations.projectId, projectId),
        inArray(projectTagRelations.tagId, tagIds)
      )
    );

  const existingTagIds = new Set(existingRelations.map((r) => r.tagId));

  // 过滤出需要新添加的标签
  const newTagIds = tagIds.filter((tagId: number) => !existingTagIds.has(tagId));

  if (newTagIds.length === 0) {
    return success({ addedCount: 0 }, '所有标签已存在');
  }

  // 批量添加标签关联
  const values = newTagIds.map((tagId: number) => ({
    projectId,
    tagId,
    addedBy: userId,
  }));

  await db.insert(projectTagRelations).values(values);

  return created({ addedCount: newTagIds.length }, '项目标签添加成功');
}

// DELETE /api/projects/[id]/tags - 移除项目的标签
async function removeTag(
  request: NextRequest,
  _userId: number,
  projectId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { tagId } = body;

  if (!tagId) {
    throw AppError.badRequest('请指定要移除的标签');
  }

  // 删除标签关联
  await db
    .delete(projectTagRelations)
    .where(
      and(
        eq(projectTagRelations.projectId, projectId),
        eq(projectTagRelations.tagId, tagId)
      )
    );

  return success({ tagId }, '项目标签已移除');
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withAuth(request, (req, userId) => getTags(req, userId, projectId));
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withAuth(request, (req, userId) => addTags(req, userId, projectId));
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withAuth(request, (req, userId) => removeTag(req, userId, projectId));
}

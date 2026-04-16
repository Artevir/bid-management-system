/**
 * 招标信息转项目API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { projects, tenderInfos, users, departments as _departments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseIdFromParams } from '@/lib/api/validators';

// POST /api/tender-crawl/tenders/[id]/create-project - 招标信息转项目
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const tenderId = parseIdFromParams(p, 'id', '招标信息');

      const [tenderInfo] = await db
        .select()
        .from(tenderInfos)
        .where(eq(tenderInfos.id, tenderId))
        .limit(1);

      if (!tenderInfo) {
        return NextResponse.json({ error: '招标信息不存在' }, { status: 404 });
      }

      if (tenderInfo.projectId) {
        const [existingProject] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, tenderInfo.projectId))
          .limit(1);

        if (existingProject) {
          return NextResponse.json({
            project: existingProject,
            message: '该招标信息已转换为项目',
          });
        }
      }

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!currentUser) {
        return NextResponse.json({ error: '用户信息不存在' }, { status: 400 });
      }

      const body = await request.json();

      const projectCode = `PRJ-${Date.now()}`;

      const [project] = await db
        .insert(projects)
        .values({
          name: body.name || tenderInfo.title || '未命名项目',
          code: projectCode,
          tenderCode: tenderInfo.tenderCode,
          tenderOrganization: tenderInfo.tenderOrganization,
          tenderAgent: tenderInfo.tenderAgent,
          budget: tenderInfo.budget,
          region: tenderInfo.region,
          industry: tenderInfo.industry,
          registerDeadline: tenderInfo.registerEndDate,
          questionDeadline: tenderInfo.questionDeadline,
          submissionDeadline: tenderInfo.submissionDeadline,
          openBidDate: tenderInfo.openBidDate,
          publishDate: tenderInfo.publishDate,
          status: 'draft',
          ownerId: userId,
          departmentId: currentUser.departmentId,
          description: tenderInfo.summary,
          tags: body.tags ? JSON.stringify(body.tags) : null,
          progress: 0,
        })
        .returning();

      await db
        .update(tenderInfos)
        .set({
          projectId: project.id,
          status: 'following',
          followedBy: userId,
          followedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tenderInfos.id, tenderId));

      return NextResponse.json({
        project,
        message: '项目创建成功',
      });
    } catch (error) {
      console.error('创建项目失败:', error);
      return NextResponse.json({ error: '创建项目失败' }, { status: 500 });
    }
  });
}

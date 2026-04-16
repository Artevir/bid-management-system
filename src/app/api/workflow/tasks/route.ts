/**
 * 工作流任务API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  workflowInstances,
  workflowNodes,
  workflowTasks,
  workflowTaskActions,
  workflowDefinitions,
  users,
} from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

// GET /api/workflow/tasks - 获取待办任务列表
export async function GET(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') || 'pending';

      const conditions = [eq(workflowTasks.assigneeId, userId)];

      if (status === 'pending') {
        conditions.push(eq(workflowTasks.status, 'pending'));
      } else if (status === 'done') {
        conditions.push(inArray(workflowTasks.status, ['completed', 'rejected', 'transferred']));
      }

      const tasks = await db
        .select()
        .from(workflowTasks)
        .where(and(...conditions))
        .orderBy(desc(workflowTasks.createdAt))
        .limit(50);

      const enrichedTasks = await Promise.all(
        tasks.map(async (task) => {
          const [instance] = await db
            .select()
            .from(workflowInstances)
            .where(eq(workflowInstances.id, task.instanceId))
            .limit(1);

          const [node] = await db
            .select()
            .from(workflowNodes)
            .where(eq(workflowNodes.id, task.nodeId))
            .limit(1);

          let definition = null;
          if (instance?.definitionId) {
            [definition] = await db
              .select()
              .from(workflowDefinitions)
              .where(eq(workflowDefinitions.id, instance.definitionId))
              .limit(1);
          }

          let submitter = null;
          if (instance?.createdBy) {
            [submitter] = await db
              .select()
              .from(users)
              .where(eq(users.id, instance.createdBy))
              .limit(1);
          }

          const history = await db
            .select()
            .from(workflowTaskActions)
            .where(eq(workflowTaskActions.instanceId, task.instanceId))
            .orderBy(desc(workflowTaskActions.createdAt));

          const historyWithUsers = await Promise.all(
            history.map(async (h) => {
              let operator = null;
              if (h.operatorId) {
                [operator] = await db
                  .select()
                  .from(users)
                  .where(eq(users.id, h.operatorId))
                  .limit(1);
              }
              return {
                id: h.id,
                nodeName: task.nodeName,
                handlerName: operator?.realName || '未知',
                action: h.action,
                comment: h.comment || '',
                handledAt: h.createdAt,
              };
            })
          );

          return {
            ...task,
            workflowName: definition?.name || '工作流',
            nodeName: task.nodeName || node?.name || '审批节点',
            projectId: instance?.businessId || 0,
            projectName: instance?.businessTitle || '未知项目',
            documentId: instance?.businessId || 0,
            documentName: instance?.businessTitle || '未知文档',
            submitterId: instance?.createdBy || 0,
            submitterName: submitter?.realName || '未知',
            submitterDept: submitter?.departmentId?.toString() || '',
            description: task.description || '',
            dueDate: task.dueTime,
            history: historyWithUsers,
          };
        })
      );

      return NextResponse.json({ tasks: enrichedTasks });
    } catch (error) {
      console.error('获取任务失败:', error);
      return NextResponse.json({ error: '获取任务失败' }, { status: 500 });
    }
  });
}

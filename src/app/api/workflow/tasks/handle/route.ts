/**
 * 工作流任务处理API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/db';
import { 
  workflowInstances, 
  workflowTasks,
  workflowTaskActions,
  workflowNodes as _workflowNodes,
  notifications,
  users,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// 获取当前用户ID
async function getCurrentUserId(): Promise<number | null> {
  const session = await getSession();
  if (!session || !session.user) return null;
  return session.user.id;
}

// POST /api/workflow/tasks/handle - 处理审批任务
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, action, comment, transferTo } = body;
    const taskIdNum = Number(taskId);
    const transferToNum = transferTo !== undefined && transferTo !== null ? Number(transferTo) : null;

    if (!Number.isInteger(taskIdNum) || taskIdNum <= 0 || !action) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const allowedActions = new Set(['approve', 'reject', 'transfer']);
    if (!allowedActions.has(action)) {
      return NextResponse.json({ error: '不支持的任务操作' }, { status: 400 });
    }

    const now = new Date();
    const isTransferAction = action === 'transfer' && Boolean(transferTo);
    if (action === 'transfer' && !transferTo) {
      return NextResponse.json({ error: '转办操作缺少接收人' }, { status: 400 });
    }
    if (isTransferAction && (!Number.isInteger(transferToNum) || (transferToNum as number) <= 0)) {
      return NextResponse.json({ error: '转办目标参数不合法' }, { status: 400 });
    }
    if (isTransferAction && transferToNum === userId) {
      return NextResponse.json({ error: '不能转办给自己' }, { status: 400 });
    }

    const [transferTarget] = isTransferAction
      ? await db
        .select()
        .from(users)
        .where(eq(users.id, transferToNum as number))
        .limit(1)
      : [null];
    if (isTransferAction && !transferTarget) {
      return NextResponse.json({ error: '转办目标用户不存在' }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(workflowTasks)
        .where(
          and(
            eq(workflowTasks.id, taskIdNum),
            eq(workflowTasks.assigneeId, userId),
            eq(workflowTasks.status, 'pending')
          )
        )
        .limit(1);

      if (!task) {
        throw new Error('TASK_NOT_FOUND_OR_PROCESSED');
      }

      const newStatus = action === 'approve' ? 'completed' : action === 'reject' ? 'rejected' : 'pending';
      const updateResult = await tx
        .update(workflowTasks)
        .set({
          status: newStatus,
          result: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null,
          comment: comment || null,
          completedAt: isTransferAction ? null : now,
          updatedAt: now,
          ...(isTransferAction
            ? {
                assigneeId: transferToNum as number,
                transferredFrom: userId,
                transferredAt: now,
              }
            : {}),
        })
        .where(
          and(
            eq(workflowTasks.id, taskIdNum),
            eq(workflowTasks.assigneeId, userId),
            eq(workflowTasks.status, 'pending')
          )
        )
        .returning({ id: workflowTasks.id, instanceId: workflowTasks.instanceId });

      if (updateResult.length === 0) {
        throw new Error('TASK_CONCURRENTLY_UPDATED');
      }

      await tx.insert(workflowTaskActions).values({
        taskId: task.id,
        instanceId: task.instanceId,
        action,
        comment: comment || null,
        operatorId: userId,
        beforeStatus: 'pending',
        afterStatus: newStatus,
      });

      const [instance] = await tx
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, task.instanceId))
        .limit(1);

      if (!instance) {
        throw new Error('WORKFLOW_INSTANCE_NOT_FOUND');
      }

      if (action === 'approve') {
        const pendingTasks = await tx
          .select({ id: workflowTasks.id })
          .from(workflowTasks)
          .where(
            and(
              eq(workflowTasks.instanceId, task.instanceId),
              eq(workflowTasks.status, 'pending')
            )
          );

        if (pendingTasks.length === 0) {
          await tx
            .update(workflowInstances)
            .set({
              status: 'completed',
              result: 'approved',
              completedAt: now,
              updatedAt: now,
            })
            .where(eq(workflowInstances.id, task.instanceId));

          await tx.insert(notifications).values({
            userId: instance.createdBy,
            type: 'approval',
            title: '审批已通过',
            content: `您的申请「${instance.businessTitle || '工作流'}」已审批通过`,
            priority: 'normal',
            link: `/workflow/instances/${instance.id}`,
            senderId: userId,
            relatedType: 'workflow',
            relatedId: instance.id,
            isRead: false,
          });
        }
      } else if (action === 'reject') {
        await tx
          .update(workflowInstances)
          .set({
            status: 'rejected',
            result: 'rejected',
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(workflowInstances.id, task.instanceId));

        await tx
          .update(workflowTasks)
          .set({
            status: 'cancelled',
            updatedAt: now,
          })
          .where(
            and(
              eq(workflowTasks.instanceId, task.instanceId),
              eq(workflowTasks.status, 'pending')
            )
          );

        await tx.insert(notifications).values({
          userId: instance.createdBy,
          type: 'approval',
          title: '审批已驳回',
          content: `您的申请「${instance.businessTitle || '工作流'}」已被驳回${comment ? `：${comment}` : ''}`,
          priority: 'high',
          link: `/workflow/instances/${instance.id}`,
          senderId: userId,
          relatedType: 'workflow',
          relatedId: instance.id,
          isRead: false,
        });
      } else if (isTransferAction) {
        await tx.insert(notifications).values({
          userId: transferToNum as number,
          type: 'approval',
          title: '收到转办任务',
          content: `您收到一个转办的审批任务「${instance.businessTitle || '工作流'}」`,
          priority: 'high',
          link: `/mobile/approval`,
          senderId: userId,
          relatedType: 'workflow_task',
          relatedId: taskIdNum,
          isRead: false,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'TASK_NOT_FOUND_OR_PROCESSED' || error.message === 'TASK_CONCURRENTLY_UPDATED') {
        return NextResponse.json({ error: '任务不存在或已处理' }, { status: 409 });
      }
      if (error.message === 'WORKFLOW_INSTANCE_NOT_FOUND') {
        return NextResponse.json({ error: '工作流实例不存在' }, { status: 404 });
      }
    }
    console.error('处理任务失败:', error);
    return NextResponse.json({ error: '处理任务失败' }, { status: 500 });
  }
}

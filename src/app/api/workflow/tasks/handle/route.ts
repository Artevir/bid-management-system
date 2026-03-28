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
  workflowNodes,
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

    if (!taskId || !action) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    // 获取任务信息
    const [task] = await db
      .select()
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.id, taskId),
          eq(workflowTasks.assigneeId, userId),
          eq(workflowTasks.status, 'pending')
        )
      )
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: '任务不存在或已处理' }, { status: 404 });
    }

    const now = new Date();

    // 更新任务状态
    const newStatus = action === 'approve' ? 'completed' : 
                      action === 'reject' ? 'rejected' : 'transferred';
    
    await db
      .update(workflowTasks)
      .set({
        status: newStatus,
        result: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : undefined,
        comment: comment || null,
        completedAt: now,
        updatedAt: now,
        ...(action === 'transfer' && transferTo ? { 
          assigneeId: transferTo,
          transferredFrom: userId,
          transferredAt: now,
        } : {}),
      })
      .where(eq(workflowTasks.id, taskId));

    // 记录操作历史
    await db.insert(workflowTaskActions).values({
      taskId: task.id,
      instanceId: task.instanceId,
      action,
      comment: comment || null,
      operatorId: userId,
      beforeStatus: 'pending',
      afterStatus: newStatus,
    });

    // 获取工作流实例
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, task.instanceId))
      .limit(1);

    if (!instance) {
      return NextResponse.json({ error: '工作流实例不存在' }, { status: 404 });
    }

    // 根据不同动作处理
    if (action === 'approve') {
      // 通过 - 检查是否还有其他待处理的审批节点
      const pendingTasks = await db
        .select()
        .from(workflowTasks)
        .where(
          and(
            eq(workflowTasks.instanceId, task.instanceId),
            eq(workflowTasks.status, 'pending')
          )
        );

      if (pendingTasks.length === 0) {
        // 所有节点都已审批通过，更新实例状态
        await db
          .update(workflowInstances)
          .set({
            status: 'completed',
            result: 'approved',
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(workflowInstances.id, task.instanceId));

        // 发送通知给发起人
        await db.insert(notifications).values({
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
      // 驳回 - 更新实例状态为已驳回
      await db
        .update(workflowInstances)
        .set({
          status: 'rejected',
          result: 'rejected',
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(workflowInstances.id, task.instanceId));

      // 取消其他待处理任务
      await db
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

      // 发送通知给发起人
      await db.insert(notifications).values({
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
    } else if (action === 'transfer' && transferTo) {
      // 转办 - 发送通知给被转办人
      await db.insert(notifications).values({
        userId: transferTo,
        type: 'approval',
        title: '收到转办任务',
        content: `您收到一个转办的审批任务「${instance.businessTitle || '工作流'}」`,
        priority: 'high',
        link: `/mobile/approval`,
        senderId: userId,
        relatedType: 'workflow_task',
        relatedId: taskId,
        isRead: false,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('处理任务失败:', error);
    return NextResponse.json({ error: '处理任务失败' }, { status: 500 });
  }
}

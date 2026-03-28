/**
 * 推送购买招标文件安排到任务中心
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  bidDocumentPurchases,
  projectTasks,
  users,
} from '@/db/schema';
import { biddingPlatforms } from '@/db/bidding-platform-schema';
import { eq } from 'drizzle-orm';

// ============================================
// POST - 推送到任务中心
// ============================================

async function pushToTask(
  request: NextRequest,
  userId: number,
  purchaseId: number
): Promise<NextResponse> {
  try {
    // 获取购买安排
    const [purchase] = await db
      .select()
      .from(bidDocumentPurchases)
      .where(eq(bidDocumentPurchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      return NextResponse.json(
        { success: false, error: '购买安排不存在' },
        { status: 404 }
      );
    }

    // 检查是否已推送
    if (purchase.pushedToTask && purchase.taskId) {
      return NextResponse.json(
        { success: false, error: '该购买安排已推送到任务中心' },
        { status: 400 }
      );
    }

    // 检查是否有指派人
    if (!purchase.assigneeId) {
      return NextResponse.json(
        { success: false, error: '请先指派负责人后再推送到任务中心' },
        { status: 400 }
      );
    }

    // 检查是否有关联项目（任务中心需要关联项目）
    // 如果没有项目，创建一个虚拟项目或提示用户
    let projectId = purchase.projectId;
    if (!projectId) {
      // 查找或创建一个"独立任务"分类的项目
      // 这里先简单处理：如果项目ID不存在，则不允许推送
      return NextResponse.json(
        { success: false, error: '请先关联项目后再推送到任务中心。购买安排需要关联一个项目才能创建任务。' },
        { status: 400 }
      );
    }

    // 构建任务标题
    const taskTitle = `购买招标文件：${purchase.projectName}`;

    // 构建任务描述
    let taskDescription = `项目编号：${purchase.projectCode || '无'}\n`;
    if (purchase.platformName) {
      taskDescription += `对接单位：${purchase.platformName}\n`;
    }
    if (purchase.purchaseDeadline) {
      taskDescription += `购买截止：${new Date(purchase.purchaseDeadline).toLocaleString('zh-CN')}\n`;
    }
    if (purchase.remarks) {
      taskDescription += `\n备注：${purchase.remarks}`;
    }

    // 创建任务
    const [task] = await db
      .insert(projectTasks)
      .values({
        projectId: projectId, // projectId is guaranteed to be not null here
        phaseId: null,
        title: taskTitle,
        description: taskDescription,
        assigneeId: purchase.assigneeId,
        priority: (purchase.priority as 'high' | 'medium' | 'low') || 'medium',
        status: 'pending',
        dueDate: purchase.purchaseDeadline || null,
        completedAt: null,
        parentId: null,
        sortOrder: 0,
        createdBy: userId,
      })
      .returning();

    // 更新购买安排
    const [updated] = await db
      .update(bidDocumentPurchases)
      .set({
        taskId: task.id,
        pushedToTask: true,
        pushedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentPurchases.id, purchaseId))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        purchase: updated,
        task: task,
      },
      message: '已成功推送到任务中心',
    });
  } catch (error) {
    console.error('Failed to push to task center:', error);
    return NextResponse.json(
      { success: false, error: '推送到任务中心失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 取消推送到任务中心
// ============================================

async function cancelPush(
  request: NextRequest,
  userId: number,
  purchaseId: number
): Promise<NextResponse> {
  try {
    // 获取购买安排
    const [purchase] = await db
      .select()
      .from(bidDocumentPurchases)
      .where(eq(bidDocumentPurchases.id, purchaseId))
      .limit(1);

    if (!purchase) {
      return NextResponse.json(
        { success: false, error: '购买安排不存在' },
        { status: 404 }
      );
    }

    // 检查是否已推送
    if (!purchase.pushedToTask || !purchase.taskId) {
      return NextResponse.json(
        { success: false, error: '该购买安排未推送到任务中心' },
        { status: 400 }
      );
    }

    // 删除任务
    await db
      .delete(projectTasks)
      .where(eq(projectTasks.id, purchase.taskId));

    // 更新购买安排
    const [updated] = await db
      .update(bidDocumentPurchases)
      .set({
        taskId: null,
        pushedToTask: false,
        pushedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentPurchases.id, purchaseId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
      message: '已取消推送到任务中心',
    });
  } catch (error) {
    console.error('Failed to cancel push to task center:', error);
    return NextResponse.json(
      { success: false, error: '取消推送失败' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => pushToTask(req, userId, parseInt(id)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => cancelPush(req, userId, parseInt(id)));
}

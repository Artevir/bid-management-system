/**
 * 项目提醒服务
 * 提供里程碑提醒、截止日期提醒等功能
 */

import { db } from '@/db';
import {
  projects,
  projectMilestones,
  projectMembers,
  users,
  notifications,
} from '@/db/schema';
import { eq, and, lt, gt, isNull, inArray, between } from 'drizzle-orm';
import { addDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';

// ============================================
// 类型定义
// ============================================

export interface MilestoneReminder {
  milestoneId: number;
  projectId: number;
  projectName: string;
  milestoneName: string;
  dueDate: Date;
  daysRemaining: number;
  reminderType: 'advance' | 'due' | 'overdue';
}

export interface ProjectReminderConfig {
  projectId: number;
  advanceDays: number[]; // 提前多少天提醒
  notifyOwner: boolean;
  notifyMembers: boolean;
  enabled: boolean;
}

// ============================================
// 提醒服务
// ============================================

/**
 * 检查并发送里程碑提醒
 */
export async function checkAndSendMilestoneReminders(): Promise<{
  sent: number;
  skipped: number;
}> {
  const now = new Date();
  const today = startOfDay(now);
  const todayEnd = endOfDay(now);

  let sent = 0;
  let skipped = 0;

  // 1. 查找即将到期的里程碑（需要提前提醒的）
  const upcomingMilestones = await db
    .select({
      milestone: projectMilestones,
      project: projects,
    })
    .from(projectMilestones)
    .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
    .where(
      and(
        eq(projectMilestones.status, 'pending'),
        eq(projectMilestones.reminderSent, false),
        gt(projectMilestones.dueDate, now)
      )
    );

  // 处理提前提醒
  for (const { milestone, project } of upcomingMilestones) {
    const daysRemaining = differenceInDays(milestone.dueDate, now);

    if (daysRemaining <= milestone.reminderDays && daysRemaining >= 0) {
      await sendMilestoneReminder({
        milestoneId: milestone.id,
        projectId: project.id,
        projectName: project.name,
        milestoneName: milestone.name,
        dueDate: milestone.dueDate,
        daysRemaining,
        reminderType: 'advance',
      });

      // 标记已发送提醒
      await db
        .update(projectMilestones)
        .set({ reminderSent: true, updatedAt: now })
        .where(eq(projectMilestones.id, milestone.id));

      sent++;
    } else {
      skipped++;
    }
  }

  // 2. 查找当天到期的里程碑
  const dueTodayMilestones = await db
    .select({
      milestone: projectMilestones,
      project: projects,
    })
    .from(projectMilestones)
    .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
    .where(
      and(
        eq(projectMilestones.status, 'pending'),
        between(projectMilestones.dueDate, today, todayEnd)
      )
    );

  for (const { milestone, project } of dueTodayMilestones) {
    await sendMilestoneReminder({
      milestoneId: milestone.id,
      projectId: project.id,
      projectName: project.name,
      milestoneName: milestone.name,
      dueDate: milestone.dueDate,
      daysRemaining: 0,
      reminderType: 'due',
    });
    sent++;
  }

  // 3. 查找已过期的里程碑
  const overdueMilestones = await db
    .select({
      milestone: projectMilestones,
      project: projects,
    })
    .from(projectMilestones)
    .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
    .where(
      and(
        eq(projectMilestones.status, 'pending'),
        lt(projectMilestones.dueDate, today)
      )
    );

  for (const { milestone, project } of overdueMilestones) {
    const daysRemaining = differenceInDays(milestone.dueDate, now);

    await sendMilestoneReminder({
      milestoneId: milestone.id,
      projectId: project.id,
      projectName: project.name,
      milestoneName: milestone.name,
      dueDate: milestone.dueDate,
      daysRemaining: Math.abs(daysRemaining),
      reminderType: 'overdue',
    });

    // 更新状态为过期
    await db
      .update(projectMilestones)
      .set({ status: 'overdue', updatedAt: now })
      .where(eq(projectMilestones.id, milestone.id));

    sent++;
  }

  return { sent, skipped };
}

/**
 * 发送里程碑提醒通知
 */
async function sendMilestoneReminder(reminder: MilestoneReminder): Promise<void> {
  // 获取项目成员
  const members = await db
    .select({
      userId: projectMembers.userId,
    })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, reminder.projectId));

  // 获取项目负责人
  const project = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, reminder.projectId))
    .limit(1);

  const recipientIds = new Set<number>();

  // 添加项目负责人
  if (project.length > 0) {
    recipientIds.add(project[0].ownerId);
  }

  // 添加项目成员
  for (const member of members) {
    recipientIds.add(member.userId);
  }

  // 构建通知内容
  let title: string;
  let content: string;

  switch (reminder.reminderType) {
    case 'advance':
      title = `里程碑即将到期提醒`;
      content = `项目【${reminder.projectName}】的里程碑【${reminder.milestoneName}】将在 ${reminder.daysRemaining} 天后到期，截止日期：${reminder.dueDate.toLocaleDateString('zh-CN')}。请及时处理。`;
      break;
    case 'due':
      title = `里程碑今日到期提醒`;
      content = `项目【${reminder.projectName}】的里程碑【${reminder.milestoneName}】今日到期，截止日期：${reminder.dueDate.toLocaleDateString('zh-CN')}。请尽快完成！`;
      break;
    case 'overdue':
      title = `里程碑已过期警告`;
      content = `项目【${reminder.projectName}】的里程碑【${reminder.milestoneName}】已过期 ${reminder.daysRemaining} 天，截止日期：${reminder.dueDate.toLocaleDateString('zh-CN')}。请立即处理！`;
      break;
  }

  // 为每个接收者创建通知
  for (const userId of recipientIds) {
    await db.insert(notifications).values({
      userId,
      type: 'project_reminder',
      title,
      content,
      relatedType: 'project_milestone',
      relatedId: reminder.milestoneId,
      isRead: false,
    });
  }
}

/**
 * 手动触发里程碑提醒
 */
export async function triggerMilestoneReminder(
  milestoneId: number
): Promise<boolean> {
  const milestone = await db
    .select()
    .from(projectMilestones)
    .where(eq(projectMilestones.id, milestoneId))
    .limit(1);

  if (milestone.length === 0) {
    return false;
  }

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, milestone[0].projectId))
    .limit(1);

  if (project.length === 0) {
    return false;
  }

  const now = new Date();
  const daysRemaining = differenceInDays(milestone[0].dueDate, now);

  let reminderType: 'advance' | 'due' | 'overdue';
  if (daysRemaining > 0) {
    reminderType = 'advance';
  } else if (daysRemaining === 0) {
    reminderType = 'due';
  } else {
    reminderType = 'overdue';
  }

  await sendMilestoneReminder({
    milestoneId: milestone[0].id,
    projectId: project[0].id,
    projectName: project[0].name,
    milestoneName: milestone[0].name,
    dueDate: milestone[0].dueDate,
    daysRemaining: Math.abs(daysRemaining),
    reminderType,
  });

  return true;
}

/**
 * 获取项目的所有提醒配置
 */
export async function getProjectReminderConfig(
  projectId: number
): Promise<ProjectReminderConfig> {
  const milestones = await db
    .select()
    .from(projectMilestones)
    .where(eq(projectMilestones.projectId, projectId));

  const advanceDays = [...new Set(milestones.map((m) => m.reminderDays))];

  return {
    projectId,
    advanceDays: advanceDays.sort((a, b) => a - b),
    notifyOwner: true,
    notifyMembers: true,
    enabled: milestones.length > 0,
  };
}

/**
 * 更新里程碑提醒天数
 */
export async function updateMilestoneReminderDays(
  milestoneId: number,
  reminderDays: number
): Promise<boolean> {
  await db
    .update(projectMilestones)
    .set({
      reminderDays,
      reminderSent: false, // 重置提醒状态
      updatedAt: new Date(),
    })
    .where(eq(projectMilestones.id, milestoneId));

  return true;
}

/**
 * 批量设置项目提醒天数
 */
export async function batchSetProjectReminderDays(
  projectId: number,
  reminderDays: number
): Promise<number> {
  const result = await db
    .update(projectMilestones)
    .set({
      reminderDays,
      reminderSent: false,
      updatedAt: new Date(),
    })
    .where(eq(projectMilestones.projectId, projectId));

  return result.rowCount || 0;
}

/**
 * 获取待发送提醒的里程碑列表
 */
export async function getPendingReminders(): Promise<MilestoneReminder[]> {
  const now = new Date();
  const today = startOfDay(now);
  const threeDaysLater = endOfDay(addDays(now, 3));

  const milestones = await db
    .select({
      milestone: projectMilestones,
      project: projects,
    })
    .from(projectMilestones)
    .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
    .where(
      and(
        eq(projectMilestones.status, 'pending'),
        between(projectMilestones.dueDate, today, threeDaysLater)
      )
    )
    .orderBy(projectMilestones.dueDate);

  return milestones.map(({ milestone, project }) => ({
    milestoneId: milestone.id,
    projectId: project.id,
    projectName: project.name,
    milestoneName: milestone.name,
    dueDate: milestone.dueDate,
    daysRemaining: differenceInDays(milestone.dueDate, now),
    reminderType: differenceInDays(milestone.dueDate, now) <= 0 ? 'due' : 'advance',
  }));
}

/**
 * 过程记录服务
 * 提供会议纪要、客户对接记录、项目任务的管理功能
 */

import { db } from '@/db';
import {
  meetingMinutes,
  contactRecords,
  projectTasks,
  projects,
  users,
} from '@/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

// ============================================
// 会议纪要服务
// ============================================

/**
 * 获取项目的会议纪要列表
 */
export async function getMeetingMinutes(projectId: number) {
  return db
    .select({
      id: meetingMinutes.id,
      projectId: meetingMinutes.projectId,
      title: meetingMinutes.title,
      content: meetingMinutes.content,
      meetingDate: meetingMinutes.meetingDate,
      participants: meetingMinutes.participants,
      location: meetingMinutes.location,
      meetingType: meetingMinutes.meetingType,
      attachments: meetingMinutes.attachments,
      createdBy: meetingMinutes.createdBy,
      createdAt: meetingMinutes.createdAt,
      updatedAt: meetingMinutes.updatedAt,
      creator: {
        id: users.id,
        username: users.username,
      },
    })
    .from(meetingMinutes)
    .leftJoin(users, eq(meetingMinutes.createdBy, users.id))
    .where(eq(meetingMinutes.projectId, projectId))
    .orderBy(desc(meetingMinutes.meetingDate));
}

/**
 * 创建会议纪要
 */
export async function createMeetingMinute(params: {
  projectId: number;
  title: string;
  content: string;
  meetingDate: Date;
  participants?: string[];
  location?: string;
  meetingType?: string;
  attachments?: any[];
  createdBy: number;
}) {
  const [minute] = await db
    .insert(meetingMinutes)
    .values({
      projectId: params.projectId,
      title: params.title,
      content: params.content,
      meetingDate: params.meetingDate,
      participants: params.participants ? JSON.stringify(params.participants) : null,
      location: params.location || null,
      meetingType: params.meetingType || null,
      attachments: params.attachments ? JSON.stringify(params.attachments) : null,
      createdBy: params.createdBy,
    })
    .returning();

  return minute;
}

/**
 * 更新会议纪要
 */
export async function updateMeetingMinute(
  id: number,
  params: Partial<{
    title: string;
    content: string;
    meetingDate: Date;
    participants: string[];
    location: string;
    meetingType: string;
    attachments: any[];
  }>
) {
  const updateData: Record<string, any> = {};

  if (params.title !== undefined) updateData.title = params.title;
  if (params.content !== undefined) updateData.content = params.content;
  if (params.meetingDate !== undefined) updateData.meetingDate = params.meetingDate;
  if (params.participants !== undefined)
    updateData.participants = JSON.stringify(params.participants);
  if (params.location !== undefined) updateData.location = params.location;
  if (params.meetingType !== undefined) updateData.meetingType = params.meetingType;
  if (params.attachments !== undefined)
    updateData.attachments = JSON.stringify(params.attachments);

  await db.update(meetingMinutes).set(updateData).where(eq(meetingMinutes.id, id));
}

/**
 * 删除会议纪要
 */
export async function deleteMeetingMinute(id: number) {
  await db.delete(meetingMinutes).where(eq(meetingMinutes.id, id));
}

// ============================================
// 客户对接记录服务
// ============================================

/**
 * 获取项目的客户对接记录列表
 */
export async function getContactRecords(projectId: number) {
  return db
    .select()
    .from(contactRecords)
    .where(eq(contactRecords.projectId, projectId))
    .orderBy(desc(contactRecords.contactDate));
}

/**
 * 创建客户对接记录
 */
export async function createContactRecord(params: {
  projectId: number;
  contactType: string;
  contactDate: Date;
  contactPerson: string;
  contactOrg?: string;
  ourPerson: string;
  content: string;
  result?: string;
  followUp?: string;
  nextContactDate?: Date;
  createdBy: number;
}) {
  const [record] = await db
    .insert(contactRecords)
    .values({
      projectId: params.projectId,
      contactType: params.contactType,
      contactDate: params.contactDate,
      contactPerson: params.contactPerson,
      contactOrg: params.contactOrg || null,
      ourPerson: params.ourPerson,
      content: params.content,
      result: params.result || null,
      followUp: params.followUp || null,
      nextContactDate: params.nextContactDate || null,
      createdBy: params.createdBy,
    })
    .returning();

  return record;
}

/**
 * 更新客户对接记录
 */
export async function updateContactRecord(
  id: number,
  params: Partial<{
    contactType: string;
    contactDate: Date;
    contactPerson: string;
    contactOrg: string;
    ourPerson: string;
    content: string;
    result: string;
    followUp: string;
    nextContactDate: Date;
  }>
) {
  await db.update(contactRecords).set(params).where(eq(contactRecords.id, id));
}

/**
 * 删除客户对接记录
 */
export async function deleteContactRecord(id: number) {
  await db.delete(contactRecords).where(eq(contactRecords.id, id));
}

// ============================================
// 项目任务服务
// ============================================

/**
 * 获取项目的任务列表
 */
export async function getProjectTasks(projectId: number, parentId?: number | null) {
  const condition = parentId
    ? and(eq(projectTasks.projectId, projectId), eq(projectTasks.parentId, parentId))
    : and(eq(projectTasks.projectId, projectId), isNull(projectTasks.parentId));

  const tasks = await db
    .select({
      id: projectTasks.id,
      projectId: projectTasks.projectId,
      phaseId: projectTasks.phaseId,
      title: projectTasks.title,
      description: projectTasks.description,
      assigneeId: projectTasks.assigneeId,
      priority: projectTasks.priority,
      status: projectTasks.status,
      dueDate: projectTasks.dueDate,
      completedAt: projectTasks.completedAt,
      parentId: projectTasks.parentId,
      sortOrder: projectTasks.sortOrder,
      createdAt: projectTasks.createdAt,
      assignee: {
        id: users.id,
        username: users.username,
      },
    })
    .from(projectTasks)
    .leftJoin(users, eq(projectTasks.assigneeId, users.id))
    .where(condition)
    .orderBy(projectTasks.sortOrder);

  return tasks;
}

/**
 * 创建项目任务
 */
export async function createProjectTask(params: {
  projectId: number;
  phaseId?: number;
  title: string;
  description?: string;
  assigneeId?: number;
  priority?: string;
  dueDate?: Date;
  parentId?: number;
  sortOrder?: number;
  createdBy: number;
}) {
  const [task] = await db
    .insert(projectTasks)
    .values({
      projectId: params.projectId,
      phaseId: params.phaseId || null,
      title: params.title,
      description: params.description || null,
      assigneeId: params.assigneeId || null,
      priority: params.priority || 'medium',
      status: 'pending',
      dueDate: params.dueDate || null,
      parentId: params.parentId || null,
      sortOrder: params.sortOrder || 0,
      createdBy: params.createdBy,
    })
    .returning();

  return task;
}

/**
 * 更新项目任务
 */
export async function updateProjectTask(
  id: number,
  params: Partial<{
    title: string;
    description: string;
    assigneeId: number;
    priority: string;
    status: string;
    dueDate: Date;
    sortOrder: number;
  }>
) {
  const updateData: Record<string, any> = { ...params };

  if (params.status === 'completed') {
    updateData.completedAt = new Date();
  }

  await db.update(projectTasks).set(updateData).where(eq(projectTasks.id, id));
}

/**
 * 删除项目任务
 */
export async function deleteProjectTask(id: number) {
  await db.delete(projectTasks).where(eq(projectTasks.id, id));
}

/**
 * 获取用户的任务列表
 */
export async function getUserTasks(userId: number, status?: string) {
  const condition = status
    ? and(eq(projectTasks.assigneeId, userId), eq(projectTasks.status, status))
    : eq(projectTasks.assigneeId, userId);

  return db
    .select({
      id: projectTasks.id,
      projectId: projectTasks.projectId,
      title: projectTasks.title,
      description: projectTasks.description,
      priority: projectTasks.priority,
      status: projectTasks.status,
      dueDate: projectTasks.dueDate,
      createdAt: projectTasks.createdAt,
      project: {
        id: projects.id,
        name: projects.name,
      },
    })
    .from(projectTasks)
    .leftJoin(projects, eq(projectTasks.projectId, projects.id))
    .where(condition)
    .orderBy(desc(projectTasks.dueDate));
}

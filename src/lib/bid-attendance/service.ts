/**
 * 去投标服务
 * 提供去投标安排的创建、查询、更新、删除以及推送到任务中心等功能
 */

import { db } from '@/db';
import {
  bidAttendances,
  bidAttendees,
  projectTasks,
  users,
  projects,
  type BidAttendance,
  type NewBidAttendance,
  type BidAttendee,
  type NewBidAttendee,
} from '@/db/schema';
import { eq, and, desc, sql, or, like, inArray } from 'drizzle-orm';
import { getProjectsForSelect as getProjectsForSelectCommon } from '@/lib/common/project-select';

// ============================================
// 创建去投标安排
// ============================================

export async function createBidAttendance(
  data: NewBidAttendance,
  attendees?: Omit<NewBidAttendee, 'attendanceId'>[]
): Promise<BidAttendance> {
  const [attendance] = await db.insert(bidAttendances).values(data).returning();
  
  // 如果提供了人员列表，一并创建
  if (attendees && attendees.length > 0) {
    const attendeesWithAttendanceId = attendees.map(a => ({
      ...a,
      attendanceId: attendance.id,
    }));
    await db.insert(bidAttendees).values(attendeesWithAttendanceId);
  }
  
  return attendance;
}

// ============================================
// 查询去投标安排列表
// ============================================

export async function getBidAttendances(filters?: {
  status?: string;
  travelMode?: string;
  projectId?: number;
  keyword?: string;
}): Promise<(BidAttendance & { attendees?: BidAttendee[] })[]> {
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(bidAttendances.status, filters.status as any));
  }
  if (filters?.travelMode) {
    conditions.push(eq(bidAttendances.travelMode, filters.travelMode as any));
  }
  if (filters?.projectId) {
    conditions.push(eq(bidAttendances.projectId, filters.projectId));
  }
  if (filters?.keyword) {
    conditions.push(
      or(
        like(bidAttendances.projectName, `%${filters.keyword}%`),
        like(bidAttendances.projectCode, `%${filters.keyword}%`)
      )
    );
  }

  const attendances = await db
    .select()
    .from(bidAttendances)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bidAttendances.createdAt));
  
  // 获取每个安排的人员列表
  const attendanceIds = attendances.map(a => a.id);
  const allAttendees = attendanceIds.length > 0 
    ? await db.select().from(bidAttendees).where(inArray(bidAttendees.attendanceId, attendanceIds))
    : [];
  
  // 组装数据
  return attendances.map(attendance => ({
    ...attendance,
    attendees: allAttendees.filter(a => a.attendanceId === attendance.id),
  }));
}

// ============================================
// 查询单个去投标安排
// ============================================

export async function getBidAttendanceById(id: number): Promise<(BidAttendance & { attendees: BidAttendee[] }) | null> {
  const [attendance] = await db
    .select()
    .from(bidAttendances)
    .where(eq(bidAttendances.id, id))
    .limit(1);
  
  if (!attendance) return null;
  
  // 获取人员列表
  const attendees = await db
    .select()
    .from(bidAttendees)
    .where(eq(bidAttendees.attendanceId, id));
  
  return {
    ...attendance,
    attendees,
  };
}

// ============================================
// 更新去投标安排
// ============================================

export async function updateBidAttendance(id: number, data: Partial<NewBidAttendance>): Promise<BidAttendance> {
  const [attendance] = await db
    .update(bidAttendances)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(bidAttendances.id, id))
    .returning();
  return attendance;
}

// ============================================
// 删除去投标安排
// ============================================

export async function deleteBidAttendance(id: number): Promise<void> {
  // 先删除关联的人员
  await db.delete(bidAttendees).where(eq(bidAttendees.attendanceId, id));
  // 再删除主记录
  await db.delete(bidAttendances).where(eq(bidAttendances.id, id));
}

// ============================================
// 获取统计数据
// ============================================

export async function getBidAttendanceStats(): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  submitted: number;
  completed: number;
  cancelled: number;
}> {
  const stats = await db
    .select({
      status: bidAttendances.status,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(bidAttendances)
    .groupBy(bidAttendances.status);

  const result = {
    total: 0,
    pending: 0,
    inProgress: 0,
    submitted: 0,
    completed: 0,
    cancelled: 0,
  };

  stats.forEach(stat => {
    result.total += stat.count;
    switch (stat.status) {
      case 'pending':
        result.pending = stat.count;
        break;
      case 'in_progress':
        result.inProgress = stat.count;
        break;
      case 'submitted':
        result.submitted = stat.count;
        break;
      case 'completed':
        result.completed = stat.count;
        break;
      case 'cancelled':
        result.cancelled = stat.count;
        break;
    }
  });

  return result;
}

// ============================================
// 添加投标人员
// ============================================

export async function addBidAttendee(attendanceId: number, attendee: Omit<NewBidAttendee, 'attendanceId'>): Promise<BidAttendee> {
  const [newAttendee] = await db
    .insert(bidAttendees)
    .values({
      ...attendee,
      attendanceId,
    })
    .returning();
  return newAttendee;
}

// ============================================
// 更新投标人员
// ============================================

export async function updateBidAttendee(id: number, data: Partial<NewBidAttendee>): Promise<BidAttendee> {
  const [attendee] = await db
    .update(bidAttendees)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(bidAttendees.id, id))
    .returning();
  return attendee;
}

// ============================================
// 删除投标人员
// ============================================

export async function deleteBidAttendee(id: number): Promise<void> {
  await db.delete(bidAttendees).where(eq(bidAttendees.id, id));
}

// ============================================
// 批量更新投标人员
// ============================================

export async function updateBidAttendees(attendanceId: number, attendees: (Omit<NewBidAttendee, 'attendanceId'> & { id?: number })[]): Promise<BidAttendee[]> {
  // 先删除现有人员
  await db.delete(bidAttendees).where(eq(bidAttendees.attendanceId, attendanceId));
  
  // 再插入新人员
  if (attendees.length > 0) {
    const attendeesWithAttendanceId = attendees.map(a => ({
      ...a,
      attendanceId,
    }));
    return db.insert(bidAttendees).values(attendeesWithAttendanceId).returning();
  }
  
  return [];
}

// ============================================
// 推送到任务中心
// ============================================

export async function pushBidAttendanceToTask(id: number, creatorId: number): Promise<number> {
  const attendance = await getBidAttendanceById(id);
  if (!attendance) {
    throw new Error('去投标安排不存在');
  }

  // 创建任务 - projectId 必填，如果没有项目则使用临时项目ID或抛出错误
  if (!attendance.projectId) {
    throw new Error('请先关联项目');
  }

  const [task] = await db
    .insert(projectTasks)
    .values({
      projectId: attendance.projectId,
      title: `去投标: ${attendance.projectName}`,
      description: `投标日期: ${attendance.bidDate ? new Date(attendance.bidDate).toLocaleDateString('zh-CN') : '待定'}\n投标地点: ${attendance.bidLocation || '待定'}\n出行方式: ${attendance.travelMode === 'together' ? '一起去' : '分开去'}`,
      status: 'pending',
      priority: 'high',
      dueDate: attendance.bidDate,
      assigneeId: creatorId,
      createdBy: creatorId,
    })
    .returning();

  // 更新去投标记录
  await updateBidAttendance(id, { taskId: task.id });

  return task.id;
}

// ============================================
// 获取用户列表（用于下拉选择）
// ============================================

export async function getUsersForSelect(): Promise<{ id: number; name: string }[]> {
  return db
    .select({
      id: users.id,
      name: users.realName,
    })
    .from(users)
    .where(eq(users.status, 'active'))
    .orderBy(users.realName);
}

// ============================================
// 获取项目列表（用于下拉选择）
// ============================================

export async function getProjectsForSelect(): Promise<{ id: number; name: string; code: string | null }[]> {
  return getProjectsForSelectCommon();
}

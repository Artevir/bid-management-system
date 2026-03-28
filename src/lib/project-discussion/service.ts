/**
 * 项目讨论区服务
 * 提供讨论区管理、消息发送、文件管理等功能
 */

import { db } from '@/db';
import {
  projectDiscussions,
  discussionMessages,
  discussionFiles,
  projectOrgs,
  projectOrgMembers,
  users,
  files,
  projects,
  type ProjectDiscussion,
  type NewProjectDiscussion,
  type DiscussionMessage,
  type NewDiscussionMessage,
  type DiscussionFile,
  type NewDiscussionFile,
  type PermissionLevel,
} from '@/db/schema';
import { eq, and, desc, sql, inArray, isNull, isNotNull, or, like } from 'drizzle-orm';

// ============================================
// 讨论区管理
// ============================================

export async function getProjectDiscussion(projectId: number): Promise<ProjectDiscussion | null> {
  const [discussion] = await db
    .select()
    .from(projectDiscussions)
    .where(and(
      eq(projectDiscussions.projectId, projectId),
      eq(projectDiscussions.status, 'active')
    ))
    .limit(1);
  return discussion || null;
}

export async function createProjectDiscussion(data: NewProjectDiscussion): Promise<ProjectDiscussion> {
  const [discussion] = await db.insert(projectDiscussions).values(data).returning();
  return discussion;
}

export async function getOrCreateProjectDiscussion(projectId: number, userId: number): Promise<ProjectDiscussion> {
  let discussion = await getProjectDiscussion(projectId);
  
  if (!discussion) {
    // 获取项目组织
    const [org] = await db
      .select()
      .from(projectOrgs)
      .where(eq(projectOrgs.projectId, projectId))
      .limit(1);

    if (!org) {
      throw new Error('项目组织不存在，请先创建项目组织架构');
    }

    // 创建讨论区
    [discussion] = await db
      .insert(projectDiscussions)
      .values({
        projectId,
        orgId: org.id,
        name: '项目讨论区',
        createdBy: userId,
      })
      .returning();
  }

  return discussion;
}

export async function updateProjectDiscussion(id: number, data: Partial<NewProjectDiscussion>): Promise<ProjectDiscussion> {
  const [discussion] = await db
    .update(projectDiscussions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projectDiscussions.id, id))
    .returning();
  return discussion;
}

export async function archiveProjectDiscussion(projectId: number): Promise<void> {
  await db
    .update(projectDiscussions)
    .set({ status: 'archived', archivedAt: new Date() })
    .where(eq(projectDiscussions.projectId, projectId));
}

// ============================================
// 权限检查
// ============================================

export async function checkDiscussionPermission(
  discussionId: number,
  userId: number
): Promise<{ canAccess: boolean; permissionLevel: PermissionLevel | null }> {
  const [discussion] = await db
    .select()
    .from(projectDiscussions)
    .where(eq(projectDiscussions.id, discussionId))
    .limit(1);

  if (!discussion) {
    return { canAccess: false, permissionLevel: null };
  }

  // 检查用户是否在项目组织中
  const member = await db
    .select()
    .from(projectOrgMembers)
    .where(and(
      eq(projectOrgMembers.orgId, discussion.orgId),
      eq(projectOrgMembers.userId, userId),
      eq(projectOrgMembers.status, 'active')
    ))
    .limit(1);

  if (member.length === 0) {
    return { canAccess: false, permissionLevel: null };
  }

  return { canAccess: true, permissionLevel: member[0].permissionLevel };
}

// ============================================
// 消息管理
// ============================================

export async function getMessages(
  discussionId: number,
  options?: {
    page?: number;
    pageSize?: number;
    includeDeleted?: boolean;
  }
): Promise<{ data: DiscussionMessage[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(discussionMessages.discussionId, discussionId)];
  if (!options?.includeDeleted) {
    conditions.push(eq(discussionMessages.isDeleted, false));
  }

  const whereClause = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(discussionMessages)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select()
    .from(discussionMessages)
    .where(whereClause)
    .orderBy(desc(discussionMessages.isPinned), desc(discussionMessages.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total };
}

export async function getMessageById(id: number): Promise<DiscussionMessage | null> {
  const [message] = await db
    .select()
    .from(discussionMessages)
    .where(eq(discussionMessages.id, id))
    .limit(1);
  return message || null;
}

export async function sendMessage(data: NewDiscussionMessage): Promise<DiscussionMessage> {
  const [message] = await db.insert(discussionMessages).values(data).returning();
  return message;
}

export async function editMessage(id: number, content: string, userId: number): Promise<DiscussionMessage> {
  const [message] = await db
    .update(discussionMessages)
    .set({
      content,
      isEdited: true,
      editedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(discussionMessages.id, id))
    .returning();
  return message;
}

export async function deleteMessage(id: number, userId: number): Promise<void> {
  await db
    .update(discussionMessages)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    })
    .where(eq(discussionMessages.id, id));
}

export async function pinMessage(id: number, userId: number): Promise<DiscussionMessage> {
  const [message] = await db
    .update(discussionMessages)
    .set({
      isPinned: true,
      pinnedAt: new Date(),
      pinnedBy: userId,
    })
    .where(eq(discussionMessages.id, id))
    .returning();
  return message;
}

export async function unpinMessage(id: number): Promise<DiscussionMessage> {
  const [message] = await db
    .update(discussionMessages)
    .set({
      isPinned: false,
      pinnedAt: null,
      pinnedBy: null,
    })
    .where(eq(discussionMessages.id, id))
    .returning();
  return message;
}

export async function searchMessages(
  discussionId: number,
  keyword: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
  }
): Promise<DiscussionMessage[]> {
  const conditions = [
    eq(discussionMessages.discussionId, discussionId),
    eq(discussionMessages.isDeleted, false),
    sql`${discussionMessages.content} ILIKE ${`%${keyword}%`}`,
  ];

  if (options?.startDate) {
    conditions.push(sql`${discussionMessages.createdAt} >= ${options.startDate}`);
  }
  if (options?.endDate) {
    conditions.push(sql`${discussionMessages.createdAt} <= ${options.endDate}`);
  }

  const messages = await db
    .select()
    .from(discussionMessages)
    .where(and(...conditions))
    .orderBy(desc(discussionMessages.createdAt))
    .limit(100);

  return messages;
}

// ============================================
// 文件管理
// ============================================

export async function getDiscussionFiles(
  discussionId: number,
  options?: {
    fileType?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<{ data: (DiscussionFile & { uploader?: any })[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [
    eq(discussionFiles.discussionId, discussionId),
    eq(discussionFiles.isDeleted, false),
  ];

  if (options?.fileType) {
    conditions.push(eq(discussionFiles.fileType, options.fileType));
  }

  const whereClause = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(discussionFiles)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select({
      id: discussionFiles.id,
      discussionId: discussionFiles.discussionId,
      messageId: discussionFiles.messageId,
      fileId: discussionFiles.fileId,
      fileName: discussionFiles.fileName,
      fileSize: discussionFiles.fileSize,
      fileType: discussionFiles.fileType,
      uploadedBy: discussionFiles.uploadedBy,
      uploadedAt: discussionFiles.uploadedAt,
      isDeleted: discussionFiles.isDeleted,
      deletedAt: discussionFiles.deletedAt,
      deletedBy: discussionFiles.deletedBy,
      uploaderName: users.realName,
    })
    .from(discussionFiles)
    .leftJoin(users, eq(discussionFiles.uploadedBy, users.id))
    .where(whereClause)
    .orderBy(desc(discussionFiles.uploadedAt))
    .limit(pageSize)
    .offset(offset);

  return {
    data: data.map(f => ({
      id: f.id,
      discussionId: f.discussionId,
      messageId: f.messageId,
      fileId: f.fileId,
      fileName: f.fileName,
      fileSize: f.fileSize,
      fileType: f.fileType,
      uploadedBy: f.uploadedBy,
      uploadedAt: f.uploadedAt,
      isDeleted: f.isDeleted,
      deletedAt: f.deletedAt,
      deletedBy: f.deletedBy,
      uploader: f.uploadedBy ? { id: f.uploadedBy, name: f.uploaderName } : undefined,
    })),
    total,
  };
}

export async function uploadDiscussionFile(data: NewDiscussionFile): Promise<DiscussionFile> {
  const [file] = await db.insert(discussionFiles).values(data).returning();
  return file;
}

export async function deleteDiscussionFile(id: number, userId: number): Promise<void> {
  await db
    .update(discussionFiles)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    })
    .where(eq(discussionFiles.id, id));
}

// ============================================
// 导出功能
// ============================================

export async function exportDiscussionMessages(
  discussionId: number,
  options?: {
    startDate?: Date;
    endDate?: Date;
  }
): Promise<DiscussionMessage[]> {
  const conditions = [
    eq(discussionMessages.discussionId, discussionId),
    eq(discussionMessages.isDeleted, false),
  ];

  if (options?.startDate) {
    conditions.push(sql`${discussionMessages.createdAt} >= ${options.startDate}`);
  }
  if (options?.endDate) {
    conditions.push(sql`${discussionMessages.createdAt} <= ${options.endDate}`);
  }

  const messages = await db
    .select()
    .from(discussionMessages)
    .where(and(...conditions))
    .orderBy(discussionMessages.createdAt);

  return messages;
}

// ============================================
// 用户项目讨论区列表
// ============================================

export async function getUserDiscussions(userId: number): Promise<(ProjectDiscussion & { project?: any })[]> {
  // 获取用户所在的项目组织
  const orgMembers = await db
    .select({ orgId: projectOrgMembers.orgId })
    .from(projectOrgMembers)
    .where(and(
      eq(projectOrgMembers.userId, userId),
      eq(projectOrgMembers.status, 'active')
    ));

  if (orgMembers.length === 0) {
    return [];
  }

  const orgIds = orgMembers.map(m => m.orgId);

  // 获取这些组织的讨论区
  const discussions = await db
    .select({
      id: projectDiscussions.id,
      projectId: projectDiscussions.projectId,
      orgId: projectDiscussions.orgId,
      name: projectDiscussions.name,
      status: projectDiscussions.status,
      archivedAt: projectDiscussions.archivedAt,
      createdBy: projectDiscussions.createdBy,
      createdAt: projectDiscussions.createdAt,
      updatedAt: projectDiscussions.updatedAt,
      projectName: projects.name,
      projectCode: projects.code,
    })
    .from(projectDiscussions)
    .leftJoin(projects, eq(projectDiscussions.projectId, projects.id))
    .where(and(
      inArray(projectDiscussions.orgId, orgIds),
      eq(projectDiscussions.status, 'active')
    ))
    .orderBy(desc(projectDiscussions.updatedAt));

  return discussions.map(d => ({
    id: d.id,
    projectId: d.projectId,
    orgId: d.orgId,
    name: d.name,
    status: d.status,
    archivedAt: d.archivedAt,
    createdBy: d.createdBy,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    project: d.projectId ? { id: d.projectId, name: d.projectName, code: d.projectCode } : undefined,
  }));
}

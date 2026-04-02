/**
 * 项目组织架构服务
 * 提供组织架构模板、项目组织、岗位管理、成员管理等功能
 */

import { db } from '@/db';
import {
  orgTemplates,
  projectOrgs,
  projectPositions,
  projectOrgMembers,
  archivedOrgTemplates,
  projects,
  users,
  type OrgTemplate,
  type NewOrgTemplate,
  type ProjectOrg,
  type NewProjectOrg,
  type ProjectPosition,
  type NewProjectPosition,
  type ProjectOrgMember,
  type NewProjectOrgMember,
  type ArchivedOrgTemplate,
  type NewArchivedOrgTemplate as _NewArchivedOrgTemplate,
  type PermissionLevel,
} from '@/db/schema';
import { eq, and, desc, sql, inArray as _inArray, isNull, isNotNull as _isNotNull } from 'drizzle-orm';

// ============================================
// 系统预置模板
// ============================================

const SYSTEM_TEMPLATES = [
  {
    name: '标准投标模板',
    type: 'standard' as const,
    description: '常规中小型投标项目',
    positions: [
      { name: '项目负责人', permissionLevel: 'level_1' as PermissionLevel, sortOrder: 1 },
      { name: '投标专员', permissionLevel: 'level_3' as PermissionLevel, sortOrder: 2 },
      { name: '技术支持', permissionLevel: 'level_3' as PermissionLevel, sortOrder: 3 },
      { name: '商务专员', permissionLevel: 'level_3' as PermissionLevel, sortOrder: 4 },
      { name: '法务专员', permissionLevel: 'level_3' as PermissionLevel, sortOrder: 5 },
    ],
  },
  {
    name: '复杂项目模板',
    type: 'complex' as const,
    description: '大型、复杂投标项目（多环节协同）',
    positions: [
      { name: '项目负责人', permissionLevel: 'level_1' as PermissionLevel, sortOrder: 1 },
      { name: '投标总监', permissionLevel: 'level_1' as PermissionLevel, sortOrder: 2 },
      { name: '技术负责人', permissionLevel: 'level_2' as PermissionLevel, sortOrder: 3 },
      { name: '商务负责人', permissionLevel: 'level_2' as PermissionLevel, sortOrder: 4 },
      { name: '资料员', permissionLevel: 'level_3' as PermissionLevel, sortOrder: 5 },
      { name: '法务', permissionLevel: 'level_3' as PermissionLevel, sortOrder: 6 },
      { name: '财务', permissionLevel: 'level_3' as PermissionLevel, sortOrder: 7 },
    ],
  },
];

// ============================================
// 组织架构模板管理
// ============================================

export async function getOrgTemplates(): Promise<OrgTemplate[]> {
  const templates = await db
    .select()
    .from(orgTemplates)
    .where(eq(orgTemplates.isActive, true))
    .orderBy(desc(orgTemplates.isSystem), desc(orgTemplates.createdAt));
  return templates;
}

export async function getOrgTemplateById(id: number): Promise<OrgTemplate | null> {
  const [template] = await db
    .select()
    .from(orgTemplates)
    .where(eq(orgTemplates.id, id))
    .limit(1);
  return template || null;
}

export async function createOrgTemplate(data: NewOrgTemplate): Promise<OrgTemplate> {
  const [template] = await db.insert(orgTemplates).values(data).returning();
  return template;
}

export async function updateOrgTemplate(id: number, data: Partial<NewOrgTemplate>): Promise<OrgTemplate> {
  const [template] = await db
    .update(orgTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orgTemplates.id, id))
    .returning();
  return template;
}

export async function deleteOrgTemplate(id: number): Promise<void> {
  await db.update(orgTemplates).set({ isActive: false }).where(eq(orgTemplates.id, id));
}

// 初始化系统模板
export async function initSystemTemplates(): Promise<void> {
  for (const template of SYSTEM_TEMPLATES) {
    const existing = await db
      .select()
      .from(orgTemplates)
      .where(and(eq(orgTemplates.name, template.name), eq(orgTemplates.isSystem, true)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(orgTemplates).values({
        name: template.name,
        type: template.type,
        description: template.description,
        positions: JSON.stringify(template.positions),
        isSystem: true,
        createdBy: null,
      });
    }
  }
}

// ============================================
// 项目组织架构管理
// ============================================

export async function getProjectOrg(projectId: number): Promise<(ProjectOrg & { positions: ProjectPosition[]; members: (ProjectOrgMember & { user?: any; position?: { id: number; name: string; permissionLevel: string } })[] }) | null> {
  const [org] = await db
    .select()
    .from(projectOrgs)
    .where(eq(projectOrgs.projectId, projectId))
    .limit(1);

  if (!org) return null;

  // 获取岗位
  const positions = await db
    .select()
    .from(projectPositions)
    .where(eq(projectPositions.orgId, org.id))
    .orderBy(sql`${projectPositions.sortOrder}`);

  // 获取成员
  const members = await db
    .select({
      id: projectOrgMembers.id,
      orgId: projectOrgMembers.orgId,
      positionId: projectOrgMembers.positionId,
      userId: projectOrgMembers.userId,
      isExternal: projectOrgMembers.isExternal,
      externalName: projectOrgMembers.externalName,
      externalPhone: projectOrgMembers.externalPhone,
      externalEmail: projectOrgMembers.externalEmail,
      permissionLevel: projectOrgMembers.permissionLevel,
      status: projectOrgMembers.status,
      joinedAt: projectOrgMembers.joinedAt,
      removedAt: projectOrgMembers.removedAt,
      createdBy: projectOrgMembers.createdBy,
      createdAt: projectOrgMembers.createdAt,
      updatedAt: projectOrgMembers.updatedAt,
      // 用户信息
      userName: users.realName,
      userEmail: users.email,
      userPhone: users.phone,
      // 岗位信息
      positionName: projectPositions.name,
      positionPermissionLevel: projectPositions.permissionLevel,
    })
    .from(projectOrgMembers)
    .leftJoin(users, eq(projectOrgMembers.userId, users.id))
    .leftJoin(projectPositions, eq(projectOrgMembers.positionId, projectPositions.id))
    .where(and(eq(projectOrgMembers.orgId, org.id), eq(projectOrgMembers.status, 'active')));

  return {
    ...org,
    positions,
    members: members.map(m => ({
      id: m.id,
      orgId: m.orgId,
      positionId: m.positionId,
      userId: m.userId,
      isExternal: m.isExternal,
      externalName: m.externalName,
      externalPhone: m.externalPhone,
      externalEmail: m.externalEmail,
      permissionLevel: m.permissionLevel,
      status: m.status,
      joinedAt: m.joinedAt,
      removedAt: m.removedAt,
      createdBy: m.createdBy,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: m.userId ? { id: m.userId, name: m.userName, email: m.userEmail, phone: m.userPhone } : undefined,
      position: m.positionId ? {
        id: m.positionId,
        name: m.positionName || '',
        permissionLevel: m.positionPermissionLevel || 'level_3',
      } : undefined,
    })),
  };
}

export async function createProjectOrg(data: NewProjectOrg): Promise<ProjectOrg> {
  const [org] = await db.insert(projectOrgs).values(data).returning();
  return org;
}

export async function createProjectOrgFromTemplate(
  projectId: number,
  templateId: number,
  userId: number
): Promise<ProjectOrg> {
  const template = await getOrgTemplateById(templateId);
  if (!template) throw new Error('模板不存在');

  const positions = JSON.parse(template.positions);

  // 创建组织
  const [org] = await db.insert(projectOrgs).values({
    projectId,
    templateId,
    name: `${template.name} - 项目组织`,
    createdBy: userId,
  }).returning();

  // 创建岗位
  for (const pos of positions) {
    await db.insert(projectPositions).values({
      orgId: org.id,
      name: pos.name,
      permissionLevel: pos.permissionLevel,
      sortOrder: pos.sortOrder,
    });
  }

  return org;
}

export async function updateProjectOrg(id: number, data: Partial<NewProjectOrg>): Promise<ProjectOrg> {
  const [org] = await db
    .update(projectOrgs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projectOrgs.id, id))
    .returning();
  return org;
}

// ============================================
// 项目岗位管理
// ============================================

export async function createProjectPosition(data: NewProjectPosition): Promise<ProjectPosition> {
  const [position] = await db.insert(projectPositions).values(data).returning();
  return position;
}

export async function updateProjectPosition(id: number, data: Partial<NewProjectPosition>): Promise<ProjectPosition> {
  const [position] = await db
    .update(projectPositions)
    .set(data)
    .where(eq(projectPositions.id, id))
    .returning();
  return position;
}

export async function deleteProjectPosition(id: number): Promise<void> {
  // 先将关联成员的positionId设为null
  await db.update(projectOrgMembers).set({ positionId: null }).where(eq(projectOrgMembers.positionId, id));
  await db.delete(projectPositions).where(eq(projectPositions.id, id));
}

// ============================================
// 项目成员管理
// ============================================

export async function addProjectOrgMember(data: NewProjectOrgMember): Promise<ProjectOrgMember> {
  // 检查是否已存在
  const existing = await db
    .select()
    .from(projectOrgMembers)
    .where(and(
      eq(projectOrgMembers.orgId, data.orgId),
      data.userId ? eq(projectOrgMembers.userId, data.userId) : isNull(projectOrgMembers.userId),
      eq(projectOrgMembers.status, 'active')
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('该成员已存在于项目组织中');
  }

  const [member] = await db.insert(projectOrgMembers).values(data).returning();
  return member;
}

export async function updateProjectOrgMember(id: number, data: Partial<NewProjectOrgMember>): Promise<ProjectOrgMember> {
  const [member] = await db
    .update(projectOrgMembers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projectOrgMembers.id, id))
    .returning();
  return member;
}

export async function removeProjectOrgMember(id: number): Promise<void> {
  await db
    .update(projectOrgMembers)
    .set({ status: 'removed', removedAt: new Date() })
    .where(eq(projectOrgMembers.id, id));
}

export async function getProjectOrgMembers(orgId: number): Promise<ProjectOrgMember[]> {
  const members = await db
    .select()
    .from(projectOrgMembers)
    .where(and(eq(projectOrgMembers.orgId, orgId), eq(projectOrgMembers.status, 'active')));
  return members;
}

// 检查用户是否有项目权限
export async function checkProjectPermission(projectId: number, userId: number): Promise<PermissionLevel | null> {
  const org = await getProjectOrg(projectId);
  if (!org) return null;

  const member = org.members.find(m => m.userId === userId);
  if (!member) return null;

  return member.permissionLevel;
}

// ============================================
// 归档模板管理
// ============================================

export async function getArchivedTemplates(filters?: {
  projectName?: string;
  projectCode?: string;
}): Promise<ArchivedOrgTemplate[]> {
  const conditions = [];
  
  if (filters?.projectName) {
    conditions.push(sql`${archivedOrgTemplates.projectName} ILIKE ${`%${filters.projectName}%`}`);
  }
  if (filters?.projectCode) {
    conditions.push(sql`${archivedOrgTemplates.projectCode} ILIKE ${`%${filters.projectCode}%`}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const templates = await db
    .select()
    .from(archivedOrgTemplates)
    .where(whereClause)
    .orderBy(desc(archivedOrgTemplates.archivedAt));

  return templates;
}

export async function archiveProjectOrg(projectId: number, userId: number): Promise<ArchivedOrgTemplate> {
  const org = await getProjectOrg(projectId);
  if (!org) throw new Error('项目组织不存在');

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  const orgData = {
    positions: org.positions,
    members: org.members.map(m => ({
      id: m.id,
      positionId: m.positionId,
      userId: m.userId,
      isExternal: m.isExternal,
      externalName: m.externalName,
      externalPhone: m.externalPhone,
      externalEmail: m.externalEmail,
      permissionLevel: m.permissionLevel,
      joinedAt: m.joinedAt,
    })),
  };

  const [archived] = await db.insert(archivedOrgTemplates).values({
    projectId,
    projectName: project?.name || `项目${projectId}`,
    projectCode: project?.code || null,
    orgData: JSON.stringify(orgData),
    archivedBy: userId,
  }).returning();

  // 更新组织状态为已归档
  await db.update(projectOrgs).set({ status: 'archived', archivedAt: new Date() }).where(eq(projectOrgs.id, org.id));

  return archived;
}

export async function copyFromArchivedTemplate(
  projectId: number,
  archivedId: number,
  userId: number
): Promise<ProjectOrg> {
  const [archived] = await db
    .select()
    .from(archivedOrgTemplates)
    .where(eq(archivedOrgTemplates.id, archivedId))
    .limit(1);

  if (!archived) throw new Error('归档模板不存在');

  const orgData = JSON.parse(archived.orgData);

  // 创建新组织
  const [org] = await db.insert(projectOrgs).values({
    projectId,
    name: `${archived.projectName} - 项目组织`,
    createdBy: userId,
  }).returning();

  // 创建岗位
  const positionIdMap: Record<number, number> = {};
  for (const pos of orgData.positions) {
    const [newPos] = await db.insert(projectPositions).values({
      orgId: org.id,
      name: pos.name,
      permissionLevel: pos.permissionLevel,
      sortOrder: pos.sortOrder,
    }).returning();
    positionIdMap[pos.id] = newPos.id;
  }

  // 添加成员（只复制结构，不复制具体用户）
  // 用户需要手动添加

  return org;
}

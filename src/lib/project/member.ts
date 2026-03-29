/**
 * 项目成员管理服务
 * 提供项目级成员授权功能
 */

import { db } from '@/db';
import { projects, projectMembers, users, departments } from '@/db/schema';
import { eq, and, inArray as _inArray } from 'drizzle-orm';

// 项目成员角色
export type ProjectRole = 'owner' | 'editor' | 'viewer' | 'auditor';

// 文档密级
export type SecurityLevel = 'public' | 'internal' | 'confidential' | 'secret';

// 密级权重（用于比较）
const _SECURITY_LEVEL_WEIGHT: Record<SecurityLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  secret: 3,
};

// 项目成员信息
export interface ProjectMemberInfo {
  id: number;
  projectId: number;
  userId: number;
  username: string;
  realName: string;
  departmentName: string;
  role: ProjectRole;
  canView: boolean;
  canEdit: boolean;
  canAudit: boolean;
  canExport: boolean;
  maxSecurityLevel: SecurityLevel;
  joinedAt: Date;
}

// 项目成员权限
export interface ProjectMemberPermission {
  canView: boolean;
  canEdit: boolean;
  canAudit: boolean;
  canExport: boolean;
  maxSecurityLevel: SecurityLevel;
}

/**
 * 获取项目的所有成员
 * @param projectId 项目ID
 * @returns 成员列表
 */
export async function getProjectMembers(projectId: number): Promise<ProjectMemberInfo[]> {
  const result = await db
    .select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      username: users.username,
      realName: users.realName,
      departmentName: departments.name,
      role: projectMembers.role,
      canView: projectMembers.canView,
      canEdit: projectMembers.canEdit,
      canAudit: projectMembers.canAudit,
      canExport: projectMembers.canExport,
      maxSecurityLevel: projectMembers.maxSecurityLevel,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(projectMembers.projectId, projectId));

  return result as ProjectMemberInfo[];
}

/**
 * 获取用户在项目中的成员信息
 * @param projectId 项目ID
 * @param userId 用户ID
 * @returns 成员信息（不存在返回null）
 */
export async function getProjectMember(
  projectId: number,
  userId: number
): Promise<ProjectMemberInfo | null> {
  const result = await db
    .select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      username: users.username,
      realName: users.realName,
      departmentName: departments.name,
      role: projectMembers.role,
      canView: projectMembers.canView,
      canEdit: projectMembers.canEdit,
      canAudit: projectMembers.canAudit,
      canExport: projectMembers.canExport,
      maxSecurityLevel: projectMembers.maxSecurityLevel,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .limit(1);

  return result.length > 0 ? (result[0] as ProjectMemberInfo) : null;
}

/**
 * 检查用户是否是项目成员
 * @param projectId 项目ID
 * @param userId 用户ID
 * @returns 是否是成员
 */
export async function isProjectMember(
  projectId: number,
  userId: number
): Promise<boolean> {
  const member = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    ),
    columns: { id: true },
  });

  return !!member;
}

/**
 * 获取用户在项目中的权限
 * @param projectId 项目ID
 * @param userId 用户ID
 * @returns 权限信息（非成员返回null）
 */
export async function getProjectMemberPermission(
  projectId: number,
  userId: number
): Promise<ProjectMemberPermission | null> {
  // 首先检查是否是项目负责人（owner）
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { ownerId: true },
  });

  if (project?.ownerId === userId) {
    // 项目负责人拥有所有权限
    return {
      canView: true,
      canEdit: true,
      canAudit: true,
      canExport: true,
      maxSecurityLevel: 'secret',
    };
  }

  // 检查是否是项目成员
  const member = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    ),
  });

  if (!member) {
    return null;
  }

  return {
    canView: member.canView,
    canEdit: member.canEdit,
    canAudit: member.canAudit,
    canExport: member.canExport,
    maxSecurityLevel: (member.maxSecurityLevel || 'internal') as SecurityLevel,
  };
}

/**
 * 检查用户是否有项目的指定权限
 * @param projectId 项目ID
 * @param userId 用户ID
 * @param permission 权限类型
 * @returns 是否有权限
 */
export async function hasProjectPermission(
  projectId: number,
  userId: number,
  permission: 'view' | 'edit' | 'audit' | 'export'
): Promise<boolean> {
  const permissions = await getProjectMemberPermission(projectId, userId);

  if (!permissions) {
    return false;
  }

  switch (permission) {
    case 'view':
      return permissions.canView;
    case 'edit':
      return permissions.canEdit;
    case 'audit':
      return permissions.canAudit;
    case 'export':
      return permissions.canExport;
    default:
      return false;
  }
}

/**
 * 获取用户参与的所有项目
 * @param userId 用户ID
 * @returns 项目列表
 */
export async function getUserProjects(userId: number) {
  // 作为负责人的项目
  const ownedProjects = await db.query.projects.findMany({
    where: eq(projects.ownerId, userId),
  });

  // 作为成员的项目
  const memberProjects = await db.query.projectMembers.findMany({
    where: eq(projectMembers.userId, userId),
    with: {
      project: true,
    },
  });

  // 合并并去重
  const projectMap = new Map<number, typeof projects.$inferSelect & { role: string }>();

  // 添加负责人的项目
  for (const project of ownedProjects) {
    projectMap.set(project.id, { ...project, role: 'owner' });
  }

  // 添加成员的项目
  for (const mp of memberProjects) {
    if (!projectMap.has(mp.projectId)) {
      projectMap.set(mp.projectId, { ...mp.project, role: mp.role });
    }
  }

  return Array.from(projectMap.values());
}

/**
 * 添加项目成员
 * @param projectId 项目ID
 * @param userId 用户ID
 * @param role 角色
 * @param permissions 权限配置
 * @param invitedBy 邀请人ID
 * @returns 新成员信息
 */
export async function addProjectMember(
  projectId: number,
  userId: number,
  role: ProjectRole,
  permissions: Partial<ProjectMemberPermission>,
  invitedBy?: number
): Promise<typeof projectMembers.$inferSelect> {
  // 默认权限配置
  const defaultPermissions: ProjectMemberPermission = {
    canView: true,
    canEdit: role === 'editor' || role === 'owner',
    canAudit: role === 'auditor' || role === 'owner',
    canExport: role === 'owner',
    maxSecurityLevel: 'internal',
    ...permissions,
  };

  const [member] = await db
    .insert(projectMembers)
    .values({
      projectId,
      userId,
      role,
      canView: defaultPermissions.canView,
      canEdit: defaultPermissions.canEdit,
      canAudit: defaultPermissions.canAudit,
      canExport: defaultPermissions.canExport,
      maxSecurityLevel: defaultPermissions.maxSecurityLevel,
      invitedBy,
    })
    .returning();

  return member;
}

/**
 * 更新项目成员权限
 * @param projectId 项目ID
 * @param userId 用户ID
 * @param permissions 权限配置
 * @returns 更新后的成员信息
 */
export async function updateProjectMemberPermission(
  projectId: number,
  userId: number,
  permissions: Partial<ProjectMemberPermission>
): Promise<typeof projectMembers.$inferSelect | null> {
  const [member] = await db
    .update(projectMembers)
    .set({
      ...permissions,
    })
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .returning();

  return member || null;
}

/**
 * 移除项目成员
 * @param projectId 项目ID
 * @param userId 用户ID
 * @returns 是否成功
 */
export async function removeProjectMember(
  projectId: number,
  userId: number
): Promise<boolean> {
  // 不能移除项目负责人
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { ownerId: true },
  });

  if (project?.ownerId === userId) {
    return false;
  }

  const _result = await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    );

  return true;
}

/**
 * 批量添加项目成员
 * @param projectId 项目ID
 * @param members 成员列表
 * @param invitedBy 邀请人ID
 * @returns 添加的成员数量
 */
export async function batchAddProjectMembers(
  projectId: number,
  members: Array<{
    userId: number;
    role: ProjectRole;
    permissions?: Partial<ProjectMemberPermission>;
  }>,
  invitedBy?: number
): Promise<number> {
  const values = members.map((m) => {
    const defaultPermissions: ProjectMemberPermission = {
      canView: true,
      canEdit: m.role === 'editor' || m.role === 'owner',
      canAudit: m.role === 'auditor' || m.role === 'owner',
      canExport: m.role === 'owner',
      maxSecurityLevel: 'internal',
      ...m.permissions,
    };

    return {
      projectId,
      userId: m.userId,
      role: m.role,
      canView: defaultPermissions.canView,
      canEdit: defaultPermissions.canEdit,
      canAudit: defaultPermissions.canAudit,
      canExport: defaultPermissions.canExport,
      maxSecurityLevel: defaultPermissions.maxSecurityLevel,
      invitedBy,
    };
  });

  await db.insert(projectMembers).values(values);

  return members.length;
}

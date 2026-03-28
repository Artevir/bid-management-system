/**
 * 文档密级服务
 * 提供文档密级管理和访问校验功能
 */

import { db } from '@/db';
import { projectMembers, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// 文档密级枚举
export type SecurityLevel = 'public' | 'internal' | 'confidential' | 'secret';

// 密级配置
export const SECURITY_LEVELS: Record<SecurityLevel, { name: string; description: string; color: string }> = {
  public: {
    name: '公开',
    description: '所有人可见，包括外部人员',
    color: '#22c55e', // green
  },
  internal: {
    name: '内部',
    description: '仅公司内部人员可见',
    color: '#3b82f6', // blue
  },
  confidential: {
    name: '机密',
    description: '仅项目成员和指定人员可见',
    color: '#f59e0b', // amber
  },
  secret: {
    name: '绝密',
    description: '仅核心人员和指定人员可见',
    color: '#ef4444', // red
  },
};

// 密级权重（用于比较）
const SECURITY_LEVEL_WEIGHT: Record<SecurityLevel, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  secret: 3,
};

// 文档信息
export interface DocumentInfo {
  id: number;
  projectId: number;
  securityLevel: SecurityLevel;
  createdBy: number;
  createdAt: Date;
}

/**
 * 比较两个密级
 * @param level1 密级1
 * @param level2 密级2
 * @returns -1: level1 < level2, 0: 相等, 1: level1 > level2
 */
export function compareSecurityLevel(
  level1: SecurityLevel,
  level2: SecurityLevel
): number {
  const weight1 = SECURITY_LEVEL_WEIGHT[level1];
  const weight2 = SECURITY_LEVEL_WEIGHT[level2];
  
  if (weight1 < weight2) return -1;
  if (weight1 > weight2) return 1;
  return 0;
}

/**
 * 检查密级是否满足要求
 * @param userLevel 用户可访问的密级
 * @param requiredLevel 文档要求的密级
 * @returns 是否可访问
 */
export function canAccessSecurityLevel(
  userLevel: SecurityLevel,
  requiredLevel: SecurityLevel
): boolean {
  return SECURITY_LEVEL_WEIGHT[userLevel] >= SECURITY_LEVEL_WEIGHT[requiredLevel];
}

/**
 * 获取用户在项目中的最高可访问密级
 * @param projectId 项目ID
 * @param userId 用户ID
 * @returns 最高可访问密级
 */
export async function getUserMaxSecurityLevel(
  projectId: number,
  userId: number
): Promise<SecurityLevel | null> {
  // 检查是否是项目负责人
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { ownerId: true },
  });

  if (project?.ownerId === userId) {
    // 项目负责人可以访问所有密级
    return 'secret';
  }

  // 检查项目成员
  const member = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    ),
    columns: { maxSecurityLevel: true },
  });

  if (!member) {
    // 非项目成员，只能访问公开文档
    return 'public';
  }

  return (member.maxSecurityLevel || 'internal') as SecurityLevel;
}

/**
 * 检查用户是否可以访问指定密级的文档
 * @param projectId 项目ID
 * @param userId 用户ID
 * @param documentLevel 文档密级
 * @returns 是否可访问
 */
export async function canAccessDocument(
  projectId: number,
  userId: number,
  documentLevel: SecurityLevel
): Promise<boolean> {
  // 公开文档所有人都可以访问
  if (documentLevel === 'public') {
    return true;
  }

  const userLevel = await getUserMaxSecurityLevel(projectId, userId);

  if (!userLevel) {
    return false;
  }

  return canAccessSecurityLevel(userLevel, documentLevel);
}

/**
 * 批量检查文档访问权限
 * @param projectId 项目ID
 * @param userId 用户ID
 * @param documents 文档列表（包含密级信息）
 * @returns 可访问的文档ID列表
 */
export async function filterAccessibleDocuments<T extends { id: number; securityLevel: SecurityLevel }>(
  projectId: number,
  userId: number,
  documents: T[]
): Promise<T[]> {
  const userLevel = await getUserMaxSecurityLevel(projectId, userId);

  if (!userLevel) {
    // 只能访问公开文档
    return documents.filter((doc) => doc.securityLevel === 'public');
  }

  const userWeight = SECURITY_LEVEL_WEIGHT[userLevel];

  return documents.filter((doc) => {
    const docWeight = SECURITY_LEVEL_WEIGHT[doc.securityLevel];
    return userWeight >= docWeight;
  });
}

/**
 * 获取用户可以创建的文档密级选项
 * @param projectId 项目ID
 * @param userId 用户ID
 * @returns 可创建的密级列表
 */
export async function getCreatableSecurityLevels(
  projectId: number,
  userId: number
): Promise<SecurityLevel[]> {
  const userLevel = await getUserMaxSecurityLevel(projectId, userId);

  if (!userLevel) {
    return ['public'];
  }

  const userWeight = SECURITY_LEVEL_WEIGHT[userLevel];
  const levels: SecurityLevel[] = [];

  // 可以创建不高于自己访问级别的文档
  for (const [level, weight] of Object.entries(SECURITY_LEVEL_WEIGHT)) {
    if (weight <= userWeight) {
      levels.push(level as SecurityLevel);
    }
  }

  return levels;
}

/**
 * 升级文档密级（需要更高权限）
 * @param projectId 项目ID
 * @param userId 操作用户ID
 * @param newLevel 新密级
 * @returns 是否允许升级
 */
export async function canUpgradeDocumentLevel(
  projectId: number,
  userId: number,
  newLevel: SecurityLevel
): Promise<boolean> {
  // 只有项目负责人可以将文档设为绝密
  if (newLevel === 'secret') {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { ownerId: true },
    });

    return project?.ownerId === userId;
  }

  // 其他密级检查用户权限
  const userLevel = await getUserMaxSecurityLevel(projectId, userId);

  if (!userLevel) {
    return false;
  }

  return canAccessSecurityLevel(userLevel, newLevel);
}

/**
 * 获取密级显示信息
 * @param level 密级
 * @returns 显示信息
 */
export function getSecurityLevelInfo(level: SecurityLevel) {
  return SECURITY_LEVELS[level];
}

/**
 * 验证密级是否有效
 * @param level 密级字符串
 * @returns 是否有效
 */
export function isValidSecurityLevel(level: string): level is SecurityLevel {
  return level in SECURITY_LEVELS;
}

/**
 * 获取所有密级选项（用于下拉选择）
 */
export function getAllSecurityLevels(): Array<{ value: SecurityLevel; label: string; description: string; color: string }> {
  return Object.entries(SECURITY_LEVELS).map(([value, info]) => ({
    value: value as SecurityLevel,
    label: info.name,
    description: info.description,
    color: info.color,
  }));
}

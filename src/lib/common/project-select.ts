/**
 * 项目选择公共函数库
 * 提供通用的项目选择相关函数，避免代码重复
 */

import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface ProjectSelectOption {
  id: number;
  name: string;
  code: string | null;
}

// ============================================
// 公共函数
// ============================================

/**
 * 获取项目选择列表
 * 返回格式化的项目选项，用于下拉选择等场景
 *
 * @param options - 可选配置
 * @param options.status - 项目状态过滤（可选）
 * @param options.limit - 返回数量限制（默认100）
 * @returns 项目选择列表
 */
export async function getProjectsForSelect(options?: {
  status?: string | string[];
  limit?: number;
}): Promise<ProjectSelectOption[]> {
  const { status, limit = 100 } = options || {};

  // 构建查询条件
  const conditions = [eq(projects.isDeleted, false)];

  // 状态过滤
  if (status) {
    if (Array.isArray(status)) {
      conditions.push(sql`${projects.status} = ANY(${status})`);
    } else {
      conditions.push(eq(projects.status, status as any));
    }
  }

  // 执行查询
  const projectList = await db
    .select({
      id: projects.id,
      name: projects.name,
      code: projects.code,
    })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(projects.id))
    .limit(limit);

  return projectList;
}

/**
 * 根据ID获取项目选择选项
 *
 * @param projectId - 项目ID
 * @returns 项目选择选项
 */
export async function getProjectSelectOptionById(
  projectId: number
): Promise<ProjectSelectOption | null> {
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      code: projects.code,
    })
    .from(projects)
    .where(eq(projects.id, projectId));

  return project || null;
}

/**
 * 根据IDs批量获取项目选择选项
 *
 * @param projectIds - 项目ID数组
 * @returns 项目选择选项列表
 */
export async function getProjectSelectOptionsByIds(
  projectIds: number[]
): Promise<ProjectSelectOption[]> {
  if (projectIds.length === 0) {
    return [];
  }

  const projectList = await db
    .select({
      id: projects.id,
      name: projects.name,
      code: projects.code,
    })
    .from(projects)
    .where(sql`${projects.id} = ANY(${projectIds})`);

  return projectList;
}

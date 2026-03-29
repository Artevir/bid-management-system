/**
 * 全文检索服务
 * 提供项目、文档、知识库等内容的搜索功能
 */

import { db } from '@/db';
import {
  projects,
  bidDocuments,
  bidChapters,
  knowledgeItems,
  users,
  departments as _departments,
} from '@/db/schema';
import { eq, or, and, ilike, sql as _sql, desc as _desc, inArray as _inArray } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface SearchResult {
  id: number;
  type: 'project' | 'document' | 'chapter' | 'knowledge' | 'user';
  title: string;
  description: string;
  url: string;
  highlights?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchParams {
  keyword: string;
  types?: ('project' | 'document' | 'chapter' | 'knowledge' | 'user')[];
  projectId?: number;
  departmentId?: number;
  userId?: number;
  page?: number;
  pageSize?: number;
}

export interface SearchResponse {
  data: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  aggregations: {
    byType: Record<string, number>;
  };
}

// ============================================
// 搜索服务
// ============================================

/**
 * 全局搜索
 */
export async function globalSearch(params: SearchParams): Promise<SearchResponse> {
  const {
    keyword,
    types,
    projectId,
    departmentId,
    userId as _userId,
    page = 1,
    pageSize = 20,
  } = params;

  if (!keyword || keyword.trim().length === 0) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      aggregations: { byType: {} },
    };
  }

  const searchTerm = `%${keyword.trim()}%`;
  const results: SearchResult[] = [];
  const aggregations: Record<string, number> = {
    project: 0,
    document: 0,
    chapter: 0,
    knowledge: 0,
    user: 0,
  };

  // 并行搜索各类型
  const searchPromises: Promise<void>[] = [];

  // 搜索项目
  if (!types || types.includes('project')) {
    searchPromises.push(
      (async () => {
        const conditions = [
          or(
            ilike(projects.name, searchTerm),
            ilike(projects.code, searchTerm),
            ilike(projects.description, searchTerm),
            ilike(projects.tenderOrganization, searchTerm)
          ),
        ];
        if (departmentId) {
          conditions.push(eq(projects.departmentId, departmentId));
        }

        const items = await db
          .select()
          .from(projects)
          .where(and(...conditions))
          .limit(100);

        for (const item of items) {
          results.push({
            id: item.id,
            type: 'project',
            title: item.name,
            description: item.description || `项目编号: ${item.code}`,
            url: `/projects/${item.id}`,
            tags: item.tags ? JSON.parse(item.tags) : undefined,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        }
        aggregations.project = items.length;
      })()
    );
  }

  // 搜索文档
  if (!types || types.includes('document')) {
    searchPromises.push(
      (async () => {
        const conditions = [
          or(
            ilike(bidDocuments.name, searchTerm)
          ),
        ];
        if (projectId) {
          conditions.push(eq(bidDocuments.projectId, projectId));
        }

        const items = await db
          .select()
          .from(bidDocuments)
          .where(and(...conditions))
          .limit(100);

        for (const item of items) {
          results.push({
            id: item.id,
            type: 'document',
            title: item.name,
            description: `状态: ${item.status}, 进度: ${item.progress}%`,
            url: `/bid/documents/${item.id}`,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        }
        aggregations.document = items.length;
      })()
    );
  }

  // 搜索章节
  if (!types || types.includes('chapter')) {
    searchPromises.push(
      (async () => {
        const conditions = [
          or(
            ilike(bidChapters.title, searchTerm),
            ilike(bidChapters.content, searchTerm)
          ),
        ];

        const items = await db
          .select({
            id: bidChapters.id,
            documentId: bidChapters.documentId,
            title: bidChapters.title,
            content: bidChapters.content,
            createdAt: bidChapters.createdAt,
            updatedAt: bidChapters.updatedAt,
          })
          .from(bidChapters)
          .where(and(...conditions))
          .limit(100);

        for (const item of items) {
          // 提取关键词上下文作为高亮
          let highlights = '';
          if (item.content) {
            const keywordIndex = item.content.toLowerCase().indexOf(keyword.toLowerCase());
            if (keywordIndex !== -1) {
              const start = Math.max(0, keywordIndex - 50);
              const end = Math.min(item.content.length, keywordIndex + keyword.length + 50);
              highlights = item.content.substring(start, end);
            }
          }

          results.push({
            id: item.id,
            type: 'chapter',
            title: item.title,
            description: highlights || '文档章节',
            url: `/bid/documents/${item.documentId}?chapter=${item.id}`,
            highlights,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        }
        aggregations.chapter = items.length;
      })()
    );
  }

  // 搜索知识库
  if (!types || types.includes('knowledge')) {
    searchPromises.push(
      (async () => {
        const conditions = [
          or(
            ilike(knowledgeItems.title, searchTerm),
            ilike(knowledgeItems.content, searchTerm)
          ),
        ];

        const items = await db
          .select()
          .from(knowledgeItems)
          .where(and(...conditions))
          .limit(100);

        for (const item of items) {
          // 提取关键词上下文
          let highlights = '';
          if (item.content) {
            const keywordIndex = item.content.toLowerCase().indexOf(keyword.toLowerCase());
            if (keywordIndex !== -1) {
              const start = Math.max(0, keywordIndex - 50);
              const end = Math.min(item.content.length, keywordIndex + keyword.length + 50);
              highlights = item.content.substring(start, end);
            }
          }

          results.push({
            id: item.id,
            type: 'knowledge',
            title: item.title,
            description: highlights || item.summary || '知识条目',
            url: `/knowledge/${item.id}`,
            highlights,
            tags: item.keywords ? JSON.parse(item.keywords) : undefined,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        }
        aggregations.knowledge = items.length;
      })()
    );
  }

  // 搜索用户
  if (!types || types.includes('user')) {
    searchPromises.push(
      (async () => {
        const conditions = [
          or(
            ilike(users.realName, searchTerm),
            ilike(users.username, searchTerm),
            ilike(users.email, searchTerm)
          ),
        ];
        if (departmentId) {
          conditions.push(eq(users.departmentId, departmentId));
        }

        const items = await db
          .select({
            id: users.id,
            realName: users.realName,
            username: users.username,
            email: users.email,
            position: users.position,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(and(...conditions))
          .limit(100);

        for (const item of items) {
          results.push({
            id: item.id,
            type: 'user',
            title: item.realName,
            description: `${item.username} - ${item.position || '员工'}`,
            url: `/admin/users/${item.id}`,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        }
        aggregations.user = items.length;
      })()
    );
  }

  // 等待所有搜索完成
  await Promise.all(searchPromises);

  // 按更新时间排序
  results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  // 分页
  const total = results.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedResults = results.slice(startIndex, startIndex + pageSize);

  return {
    data: paginatedResults,
    total,
    page,
    pageSize,
    totalPages,
    aggregations: { byType: aggregations },
  };
}

/**
 * 搜索建议（自动补全）
 */
export async function searchSuggestions(keyword: string, limit: number = 10): Promise<string[]> {
  if (!keyword || keyword.trim().length < 2) {
    return [];
  }

  const searchTerm = `%${keyword.trim()}%`;
  const suggestions: Set<string> = new Set();

  // 从项目名称获取建议
  const projectNames = await db
    .select({ name: projects.name })
    .from(projects)
    .where(ilike(projects.name, searchTerm))
    .limit(limit);

  for (const p of projectNames) {
    suggestions.add(p.name);
  }

  // 从知识库标题获取建议
  const knowledgeTitles = await db
    .select({ title: knowledgeItems.title })
    .from(knowledgeItems)
    .where(ilike(knowledgeItems.title, searchTerm))
    .limit(limit);

  for (const k of knowledgeTitles) {
    suggestions.add(k.title);
  }

  return Array.from(suggestions).slice(0, limit);
}

/**
 * 搜索历史记录
 */
export async function getSearchHistory(userId: number, _limit: number = 10): Promise<string[]> {
  // 这里可以扩展为从数据库读取用户搜索历史
  // 目前返回空数组
  return [];
}

/**
 * 热门搜索
 */
export async function getHotSearches(limit: number = 10): Promise<string[]> {
  // 返回一些预设的热门搜索词
  return [
    '招标文件',
    '技术方案',
    '商务报价',
    '资质证明',
    '项目进度',
    '审核流程',
  ].slice(0, limit);
}

/**
 * 全文搜索服务
 * 支持项目、文档、用户等内容的全文搜索
 * 支持模糊匹配、拼写纠错、搜索建议
 */

import { db } from '@/db/index';
import { projects, bidDocuments, companies, users } from '@/db/schema';
import { sql, or, and, ilike, desc } from 'drizzle-orm';
import { cache } from '@/lib/cache';

// ============================================
// 搜索结果类型
// ============================================

export interface SearchResult<T = any> {
  type: 'project' | 'document' | 'user' | 'company';
  id: string;
  title: string;
  description: string;
  data: T;
  score: number;
  highlight?: {
    title?: string;
    description?: string;
  };
}

export interface SearchOptions {
  query: string;
  type?: 'project' | 'document' | 'user' | 'company' | 'all';
  page?: number;
  pageSize?: number;
  filters?: Record<string, any>;
  sortBy?: 'relevance' | 'date' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  took: number; // 搜索耗时（毫秒）
  suggestions?: string[]; // 搜索建议
}

// ============================================
// 全文搜索服务类
// ============================================

export class SearchService {
  /**
   * 执行全文搜索
   */
  static async search(options: SearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      const {
        query,
        type = 'all',
        page = 1,
        pageSize = 20,
        filters = {},
        sortBy = 'relevance',
        sortOrder = 'desc',
      } = options;

      // 检查缓存
      const cacheKey = `search:${type}:${query}:${page}:${pageSize}:${JSON.stringify(filters)}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // 清理查询字符串
      const cleanQuery = query.trim();
      if (!cleanQuery) {
        return this.emptyResponse('', page, pageSize);
      }

      const results: SearchResult[] = [];
      let total = 0;

      // 根据类型搜索
      if (type === 'all' || type === 'project') {
        const projectResults = await this.searchProjects(cleanQuery, filters, page, pageSize);
        results.push(...projectResults.results);
        total += projectResults.total;
      }

      if (type === 'all' || type === 'document') {
        const docResults = await this.searchDocuments(cleanQuery, filters, page, pageSize);
        results.push(...docResults.results);
        total += docResults.total;
      }

      if (type === 'all' || type === 'user') {
        const userResults = await this.searchUsers(cleanQuery, filters, page, pageSize);
        results.push(...userResults.results);
        total += userResults.total;
      }

      if (type === 'all' || type === 'company') {
        const companyResults = await this.searchCompanies(cleanQuery, filters, page, pageSize);
        results.push(...companyResults.results);
        total += companyResults.total;
      }

      // 排序
      if (sortBy === 'date') {
        results.sort((a, b) => {
          const dateA = (a.data as any).createdAt || new Date();
          const dateB = (b.data as any).createdAt || new Date();
          return sortOrder === 'asc' 
            ? new Date(dateA).getTime() - new Date(dateB).getTime()
            : new Date(dateB).getTime() - new Date(dateA).getTime();
        });
      } else if (sortBy === 'name') {
        results.sort((a, b) => {
          return sortOrder === 'asc'
            ? a.title.localeCompare(b.title)
            : b.title.localeCompare(a.title);
        });
      } else {
        // 按相关性排序
        results.sort((a, b) => b.score - a.score);
      }

      // 分页
      const paginatedResults = results.slice((page - 1) * pageSize, page * pageSize);
      const totalPages = Math.ceil(total / pageSize);
      const took = Date.now() - startTime;

      // 生成搜索建议
      const suggestions = await this.generateSuggestions(cleanQuery);

      const response: SearchResponse = {
        results: paginatedResults,
        total,
        page,
        pageSize,
        totalPages,
        query,
        took,
        suggestions,
      };

      // 缓存结果（5分钟）
      await cache.set(cacheKey, JSON.stringify(response), 300);

      return response;
    } catch (error) {
      console.error('[Search] 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 搜索项目
   */
  private static async searchProjects(
    query: string,
    filters: Record<string, any>,
    page: number,
    pageSize: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const conditions = [];

    // 标题模糊搜索
    conditions.push(ilike(projects.name, `%${query}%`));

    // 描述模糊搜索
    conditions.push(ilike(projects.description, `%${query}%`));

    // 添加过滤条件
    if (filters.status) {
      conditions.push(sql`${projects.status} = ${filters.status}`);
    }
    if (filters.companyId) {
      conditions.push(sql`${projects.companyId} = ${filters.companyId}`);
    }

    const whereClause = or(...conditions);

    // 获取项目列表
    const projectList = await db.query.projects.findMany({
      where: whereClause,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(projects.createdAt)],
    });

    // 获取总数
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereClause);

    const results = projectList.map(project => ({
      type: 'project' as const,
      id: project.id,
      title: project.name,
      description: project.description || '',
      data: project,
      score: this.calculateScore(query, project.name, project.description),
      highlight: this.highlightText(query, project.name, project.description),
    }));

    return {
      results,
      total: Number(totalResult[0]?.count || 0),
    };
  }

  /**
   * 搜索文档
   */
  private static async searchDocuments(
    query: string,
    filters: Record<string, any>,
    page: number,
    pageSize: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const conditions = [];

    conditions.push(ilike(bidDocuments.name, `%${query}%`));

    if (filters.projectId) {
      conditions.push(sql`${bidDocuments.projectId} = ${filters.projectId}`);
    }
    if (filters.status) {
      conditions.push(sql`${bidDocuments.status} = ${filters.status}`);
    }
    if (filters.type) {
      conditions.push(sql`${bidDocuments.status} = ${filters.type}`);
    }

    const whereClause = or(...conditions);

    const docList = await db.query.bidDocuments.findMany({
      where: whereClause,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(bidDocuments.createdAt)],
    });

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bidDocuments)
      .where(whereClause);

    const results = docList.map(doc => ({
      type: 'document' as const,
      id: String(doc.id),
      title: doc.name,
      description: doc.status || '',
      data: doc,
      score: this.calculateScore(query, doc.name),
      highlight: this.highlightText(query, doc.name),
    }));

    return {
      results,
      total: Number(totalResult[0]?.count || 0),
    };
  }

  /**
   * 搜索用户
   */
  private static async searchUsers(
    query: string,
    filters: Record<string, any>,
    page: number,
    pageSize: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const conditions = [];

    conditions.push(ilike(users.name, `%${query}%`));
    conditions.push(ilike(users.email, `%${query}%`));

    const whereClause = or(...conditions);

    const userList = await db.query.users.findMany({
      where: whereClause,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(users.createdAt)],
    });

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    const results = userList.map(user => ({
      type: 'user' as const,
      id: user.id,
      title: user.name,
      description: user.email || '',
      data: user,
      score: this.calculateScore(query, user.name, user.email),
      highlight: this.highlightText(query, user.name, user.email),
    }));

    return {
      results,
      total: Number(totalResult[0]?.count || 0),
    };
  }

  /**
   * 搜索公司
   */
  private static async searchCompanies(
    query: string,
    filters: Record<string, any>,
    page: number,
    pageSize: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const conditions = [];

    conditions.push(ilike(companies.name, `%${query}%`));

    const whereClause = or(...conditions);

    const companyList = await db.query.companies.findMany({
      where: whereClause,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(companies.createdAt)],
    });

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(whereClause);

    const results = companyList.map(company => ({
      type: 'company' as const,
      id: company.id,
      title: company.name,
      description: company.description || '',
      data: company,
      score: this.calculateScore(query, company.name, company.description),
      highlight: this.highlightText(query, company.name, company.description),
    }));

    return {
      results,
      total: Number(totalResult[0]?.count || 0),
    };
  }

  /**
   * 计算相关性得分
   */
  private static calculateScore(query: string, ...texts: (string | null | undefined)[]): number {
    let score = 0;
    const lowerQuery = query.toLowerCase();

    for (const text of texts) {
      if (!text) continue;

      const lowerText = text.toLowerCase();

      // 完全匹配（最高分）
      if (lowerText === lowerQuery) {
        score += 100;
      }
      // 开头匹配
      else if (lowerText.startsWith(lowerQuery)) {
        score += 80;
      }
      // 包含匹配
      else if (lowerText.includes(lowerQuery)) {
        score += 60;
      }

      // 计算匹配的词数
      const queryWords = lowerQuery.split(/\s+/);
      const textWords = lowerText.split(/\s+/);
      const matchedWords = queryWords.filter(word => textWords.some(tw => tw.includes(word)));
      score += matchedWords.length * 10;
    }

    return score;
  }

  /**
   * 高亮匹配文本
   */
  private static highlightText(
    query: string,
    title?: string,
    description?: string
  ): { title?: string; description?: string } {
    const highlightText = (text: string): string => {
      if (!text) return '';
      const regex = new RegExp(`(${query})`, 'gi');
      return text.replace(regex, '<mark>$1</mark>');
    };

    return {
      title: title ? highlightText(title) : undefined,
      description: description ? highlightText(description.substring(0, 200)) : undefined,
    };
  }

  /**
   * 生成搜索建议
   */
  static async generateSuggestions(query: string): Promise<string[]> {
    // TODO: 基于搜索历史和热门搜索生成建议
    // 这里简化为空数组
    return [];
  }

  /**
   * 空响应
   */
  private static emptyResponse(query: string, page: number, pageSize: number): SearchResponse {
    return {
      results: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      query,
      took: 0,
      suggestions: [],
    };
  }

  /**
   * 记录搜索历史
   */
  static async recordSearchHistory(userId: string, query: string, resultCount: number): Promise<void> {
    // TODO: 记录搜索历史到数据库或Redis
    console.log(`[Search] User ${userId} searched for "${query}", ${resultCount} results`);
  }

  /**
   * 获取热门搜索
   */
  static async getPopularSearches(limit: number = 10): Promise<string[]> {
    // TODO: 从数据库或Redis获取热门搜索
    return [];
  }

  /**
   * 获取搜索历史
   */
  static async getSearchHistory(userId: string, limit: number = 10): Promise<string[]> {
    // TODO: 从数据库或Redis获取用户的搜索历史
    return [];
  }
}

// ============================================
// 导出
// ============================================

export default SearchService;

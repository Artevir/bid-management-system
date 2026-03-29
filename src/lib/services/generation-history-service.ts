/**
 * 文档生成历史服务
 * 支持生成历史记录和版本管理
 */

import { db } from '@/db';
import { documentGenerationHistories, bidDocuments, bidDocumentInterpretations, users } from '@/db/schema';
import { eq, and as _and, desc, inArray } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface GenerationHistory {
  id: number;
  documentId: number;
  generationConfig: Record<string, any> | null;
  companyIds: number[] | null;
  interpretationId: number | null;
  partnerApplicationIds: number[] | null;
  templateIds: number[] | null;
  status: string;
  totalChapters: number;
  generatedChapters: number;
  totalWordCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  errorMessage: string | null;
  version: number;
  createdBy: number;
  createdAt: Date;
  document?: {
    id: number;
    name: string;
    status: string;
  };
  interpretation?: {
    id: number;
    fileName: string;
  } | null;
  creator?: {
    id: number;
    name: string;
  };
}

export interface CreateHistoryData {
  documentId: number;
  generationConfig?: Record<string, any>;
  companyIds?: number[];
  interpretationId?: number;
  partnerApplicationIds?: number[];
  templateIds?: number[];
  version?: number;
}

// ============================================
// 生成历史服务
// ============================================

export const generationHistoryService = {
  /**
   * 创建生成历史记录
   */
  async createHistory(data: CreateHistoryData, userId: number): Promise<number> {
    const [history] = await db
      .insert(documentGenerationHistories)
      .values({
        documentId: data.documentId,
        generationConfig: data.generationConfig ? JSON.stringify(data.generationConfig) : null,
        companyIds: data.companyIds ? JSON.stringify(data.companyIds) : null,
        interpretationId: data.interpretationId || null,
        partnerApplicationIds: data.partnerApplicationIds
          ? JSON.stringify(data.partnerApplicationIds)
          : null,
        templateIds: data.templateIds ? JSON.stringify(data.templateIds) : null,
        status: 'pending',
        totalChapters: 0,
        generatedChapters: 0,
        totalWordCount: 0,
        version: data.version || 1,
        createdBy: userId,
        startedAt: new Date(),
      })
      .returning();

    return history.id;
  },

  /**
   * 更新生成历史
   */
  async updateHistory(
    historyId: number,
    data: {
      status?: string;
      totalChapters?: number;
      generatedChapters?: number;
      totalWordCount?: number;
      completedAt?: Date;
      duration?: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    await db
      .update(documentGenerationHistories)
      .set(data)
      .where(eq(documentGenerationHistories.id, historyId));
  },

  /**
   * 获取文档的生成历史
   */
  async getHistoriesByDocument(documentId: number): Promise<GenerationHistory[]> {
    const histories = await db
      .select({
        id: documentGenerationHistories.id,
        documentId: documentGenerationHistories.documentId,
        generationConfig: documentGenerationHistories.generationConfig,
        companyIds: documentGenerationHistories.companyIds,
        interpretationId: documentGenerationHistories.interpretationId,
        partnerApplicationIds: documentGenerationHistories.partnerApplicationIds,
        templateIds: documentGenerationHistories.templateIds,
        status: documentGenerationHistories.status,
        totalChapters: documentGenerationHistories.totalChapters,
        generatedChapters: documentGenerationHistories.generatedChapters,
        totalWordCount: documentGenerationHistories.totalWordCount,
        startedAt: documentGenerationHistories.startedAt,
        completedAt: documentGenerationHistories.completedAt,
        duration: documentGenerationHistories.duration,
        errorMessage: documentGenerationHistories.errorMessage,
        version: documentGenerationHistories.version,
        createdBy: documentGenerationHistories.createdBy,
        createdAt: documentGenerationHistories.createdAt,
        document: {
          id: bidDocuments.id,
          name: bidDocuments.name,
          status: bidDocuments.status,
        },
        interpretation: {
          id: bidDocumentInterpretations.id,
          fileName: bidDocumentInterpretations.documentName,
        },
        creator: {
          id: users.id,
          name: users.realName,
        },
      })
      .from(documentGenerationHistories)
      .innerJoin(bidDocuments, eq(documentGenerationHistories.documentId, bidDocuments.id))
      .leftJoin(
        bidDocumentInterpretations,
        eq(documentGenerationHistories.interpretationId, bidDocumentInterpretations.id)
      )
      .innerJoin(users, eq(documentGenerationHistories.createdBy, users.id))
      .where(eq(documentGenerationHistories.documentId, documentId))
      .orderBy(desc(documentGenerationHistories.createdAt));

    return histories.map((h) => ({
      ...h,
      generationConfig: h.generationConfig ? JSON.parse(h.generationConfig) : null,
      companyIds: h.companyIds ? JSON.parse(h.companyIds) : null,
      partnerApplicationIds: h.partnerApplicationIds ? JSON.parse(h.partnerApplicationIds) : null,
      templateIds: h.templateIds ? JSON.parse(h.templateIds) : null,
    }));
  },

  /**
   * 获取项目所有文档的生成历史
   */
  async getHistoriesByProject(projectId: number): Promise<GenerationHistory[]> {
    // 先获取项目的所有文档
    const documents = await db
      .select({ id: bidDocuments.id })
      .from(bidDocuments)
      .where(eq(bidDocuments.projectId, projectId));

    if (documents.length === 0) return [];

    const documentIds = documents.map((d) => d.id);

    const histories = await db
      .select({
        id: documentGenerationHistories.id,
        documentId: documentGenerationHistories.documentId,
        generationConfig: documentGenerationHistories.generationConfig,
        companyIds: documentGenerationHistories.companyIds,
        interpretationId: documentGenerationHistories.interpretationId,
        partnerApplicationIds: documentGenerationHistories.partnerApplicationIds,
        templateIds: documentGenerationHistories.templateIds,
        status: documentGenerationHistories.status,
        totalChapters: documentGenerationHistories.totalChapters,
        generatedChapters: documentGenerationHistories.generatedChapters,
        totalWordCount: documentGenerationHistories.totalWordCount,
        startedAt: documentGenerationHistories.startedAt,
        completedAt: documentGenerationHistories.completedAt,
        duration: documentGenerationHistories.duration,
        errorMessage: documentGenerationHistories.errorMessage,
        version: documentGenerationHistories.version,
        createdBy: documentGenerationHistories.createdBy,
        createdAt: documentGenerationHistories.createdAt,
        document: {
          id: bidDocuments.id,
          name: bidDocuments.name,
          status: bidDocuments.status,
        },
        interpretation: {
          id: bidDocumentInterpretations.id,
          fileName: bidDocumentInterpretations.documentName,
        },
        creator: {
          id: users.id,
          name: users.realName,
        },
      })
      .from(documentGenerationHistories)
      .innerJoin(bidDocuments, eq(documentGenerationHistories.documentId, bidDocuments.id))
      .leftJoin(
        bidDocumentInterpretations,
        eq(documentGenerationHistories.interpretationId, bidDocumentInterpretations.id)
      )
      .innerJoin(users, eq(documentGenerationHistories.createdBy, users.id))
      .where(inArray(documentGenerationHistories.documentId, documentIds))
      .orderBy(desc(documentGenerationHistories.createdAt));

    return histories.map((h) => ({
      ...h,
      generationConfig: h.generationConfig ? JSON.parse(h.generationConfig) : null,
      companyIds: h.companyIds ? JSON.parse(h.companyIds) : null,
      partnerApplicationIds: h.partnerApplicationIds ? JSON.parse(h.partnerApplicationIds) : null,
      templateIds: h.templateIds ? JSON.parse(h.templateIds) : null,
    }));
  },

  /**
   * 获取历史详情
   */
  async getHistoryById(historyId: number): Promise<GenerationHistory | null> {
    const [history] = await db
      .select({
        id: documentGenerationHistories.id,
        documentId: documentGenerationHistories.documentId,
        generationConfig: documentGenerationHistories.generationConfig,
        companyIds: documentGenerationHistories.companyIds,
        interpretationId: documentGenerationHistories.interpretationId,
        partnerApplicationIds: documentGenerationHistories.partnerApplicationIds,
        templateIds: documentGenerationHistories.templateIds,
        status: documentGenerationHistories.status,
        totalChapters: documentGenerationHistories.totalChapters,
        generatedChapters: documentGenerationHistories.generatedChapters,
        totalWordCount: documentGenerationHistories.totalWordCount,
        startedAt: documentGenerationHistories.startedAt,
        completedAt: documentGenerationHistories.completedAt,
        duration: documentGenerationHistories.duration,
        errorMessage: documentGenerationHistories.errorMessage,
        version: documentGenerationHistories.version,
        createdBy: documentGenerationHistories.createdBy,
        createdAt: documentGenerationHistories.createdAt,
        document: {
          id: bidDocuments.id,
          name: bidDocuments.name,
          status: bidDocuments.status,
        },
        interpretation: {
          id: bidDocumentInterpretations.id,
          fileName: bidDocumentInterpretations.documentName,
        },
        creator: {
          id: users.id,
          name: users.realName,
        },
      })
      .from(documentGenerationHistories)
      .innerJoin(bidDocuments, eq(documentGenerationHistories.documentId, bidDocuments.id))
      .leftJoin(
        bidDocumentInterpretations,
        eq(documentGenerationHistories.interpretationId, bidDocumentInterpretations.id)
      )
      .innerJoin(users, eq(documentGenerationHistories.createdBy, users.id))
      .where(eq(documentGenerationHistories.id, historyId))
      .limit(1);

    if (!history) return null;

    return {
      ...history,
      generationConfig: history.generationConfig ? JSON.parse(history.generationConfig) : null,
      companyIds: history.companyIds ? JSON.parse(history.companyIds) : null,
      partnerApplicationIds: history.partnerApplicationIds
        ? JSON.parse(history.partnerApplicationIds)
        : null,
      templateIds: history.templateIds ? JSON.parse(history.templateIds) : null,
    };
  },

  /**
   * 格式化持续时间
   */
  formatDuration(ms: number | null): string {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  },

  /**
   * 获取生成统计
   */
  async getStatistics(projectId?: number): Promise<{
    totalGenerations: number;
    completedGenerations: number;
    failedGenerations: number;
    totalWordCount: number;
    avgDuration: number;
  }> {
    // 这里简化实现，实际应该用SQL聚合
    const histories = projectId
      ? await this.getHistoriesByProject(projectId)
      : [];

    const completed = histories.filter((h) => h.status === 'completed');
    const failed = histories.filter((h) => h.status === 'failed');

    const totalDuration = completed.reduce((sum, h) => sum + (h.duration || 0), 0);

    return {
      totalGenerations: histories.length,
      completedGenerations: completed.length,
      failedGenerations: failed.length,
      totalWordCount: completed.reduce((sum, h) => sum + h.totalWordCount, 0),
      avgDuration: completed.length > 0 ? totalDuration / completed.length : 0,
    };
  },
};

export default generationHistoryService;

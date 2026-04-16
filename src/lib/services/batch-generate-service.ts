/**
 * 批量生成投标文档服务
 * 支持同时生成多个文档
 */

import { db as _db } from '@/db';
import {
  bidDocuments as _bidDocuments,
  bidDocumentInterpretations as _bidDocumentInterpretations,
  documentGenerationHistories as _documentGenerationHistories,
} from '@/db/schema';
import { eq as _eq, inArray as _inArray } from 'drizzle-orm';
import { oneClickGenerateService, type OneClickGenerateParams } from './one-click-generate-service';
import { generationProgressService as _generationProgressService } from './generation-progress-service';

// ============================================
// 类型定义
// ============================================

export interface BatchGenerateItem {
  projectId: number;
  documentName: string;
  interpretationId: number;
  companyIds: number[];
  partnerApplicationIds?: number[];
}

export interface BatchGenerateParams {
  items: BatchGenerateItem[];
  generateOptions: OneClickGenerateParams['generateOptions'];
  parallel?: boolean; // 是否并行生成，默认串行
  maxParallel?: number; // 最大并行数
}

export interface BatchGenerateResult {
  batchId: string;
  createdBy: number;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  results: BatchItemResult[];
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  startedAt: Date;
  completedAt?: Date;
}

export interface BatchItemResult {
  index: number;
  projectId: number;
  documentName: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  documentId?: number;
  error?: string;
  progress?: number;
}

// ============================================
// 批量生成服务
// ============================================

const batchStore = new Map<string, BatchGenerateResult>();

export const batchGenerateService = {
  /**
   * 批量生成投标文档
   */
  async generateBatch(
    params: BatchGenerateParams,
    userId: number,
    customHeaders?: Record<string, string>
  ): Promise<BatchGenerateResult> {
    const { items, generateOptions, parallel = false, maxParallel = 3 } = params;

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date();

    // 初始化批量结果
    const result: BatchGenerateResult = {
      batchId,
      createdBy: userId,
      totalItems: items.length,
      completedItems: 0,
      failedItems: 0,
      results: items.map((item, index) => ({
        index,
        projectId: item.projectId,
        documentName: item.documentName,
        status: 'pending',
      })),
      status: 'running',
      startedAt,
    };

    batchStore.set(batchId, result);

    // 执行批量生成
    if (parallel) {
      await this.executeParallel(
        items,
        generateOptions,
        result,
        userId,
        maxParallel || 3,
        customHeaders
      );
    } else {
      await this.executeSequential(items, generateOptions, result, userId, customHeaders);
    }

    // 更新最终状态
    result.completedAt = new Date();
    if (result.failedItems === 0) {
      result.status = 'completed';
    } else if (result.completedItems === 0) {
      result.status = 'failed';
    } else {
      result.status = 'partial';
    }

    return result;
  },

  /**
   * 串行执行生成
   */
  async executeSequential(
    items: BatchGenerateItem[],
    generateOptions: OneClickGenerateParams['generateOptions'],
    result: BatchGenerateResult,
    userId: number,
    customHeaders?: Record<string, string>
  ): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      result.results[i].status = 'generating';
      batchStore.set(result.batchId, result);

      try {
        const generateResult = await oneClickGenerateService.generateDocument(
          {
            projectId: item.projectId,
            documentName: item.documentName,
            interpretationId: item.interpretationId,
            companyIds: item.companyIds,
            partnerApplicationIds: item.partnerApplicationIds,
            generateOptions,
          },
          userId,
          customHeaders
        );

        result.results[i].status = 'completed';
        result.results[i].documentId = generateResult.documentId;
        result.results[i].progress = 100;
        result.completedItems++;
      } catch (error: any) {
        result.results[i].status = 'failed';
        result.results[i].error = error.message || '生成失败';
        result.failedItems++;
      }

      batchStore.set(result.batchId, result);
    }
  },

  /**
   * 并行执行生成
   */
  async executeParallel(
    items: BatchGenerateItem[],
    generateOptions: OneClickGenerateParams['generateOptions'],
    result: BatchGenerateResult,
    userId: number,
    maxParallel: number,
    customHeaders?: Record<string, string>
  ): Promise<void> {
    const chunks: BatchGenerateItem[][] = [];
    for (let i = 0; i < items.length; i += maxParallel) {
      chunks.push(items.slice(i, i + maxParallel));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (item, _chunkIndex) => {
        const index = result.results.findIndex(
          (r) => r.projectId === item.projectId && r.documentName === item.documentName
        );
        if (index === -1) return;

        result.results[index].status = 'generating';
        batchStore.set(result.batchId, result);

        try {
          const generateResult = await oneClickGenerateService.generateDocument(
            {
              projectId: item.projectId,
              documentName: item.documentName,
              interpretationId: item.interpretationId,
              companyIds: item.companyIds,
              partnerApplicationIds: item.partnerApplicationIds,
              generateOptions,
            },
            userId,
            customHeaders
          );

          result.results[index].status = 'completed';
          result.results[index].documentId = generateResult.documentId;
          result.results[index].progress = 100;
          result.completedItems++;
        } catch (error: any) {
          result.results[index].status = 'failed';
          result.results[index].error = error.message || '生成失败';
          result.failedItems++;
        }
      });

      await Promise.all(promises);
      batchStore.set(result.batchId, result);
    }
  },

  /**
   * 获取批量生成结果
   */
  getBatchResult(batchId: string): BatchGenerateResult | null {
    return batchStore.get(batchId) || null;
  },

  /**
   * 清理批量结果
   */
  clearBatchResult(batchId: string): void {
    batchStore.delete(batchId);
  },

  /**
   * 取消批量生成（停止后续任务）
   */
  cancelBatch(batchId: string): BatchGenerateResult | null {
    const result = batchStore.get(batchId);
    if (!result) return null;

    // 标记所有pending任务为cancelled
    result.results.forEach((item) => {
      if (item.status === 'pending') {
        item.status = 'failed';
        item.error = '已取消';
        result.failedItems++;
      }
    });

    result.status = 'partial';
    result.completedAt = new Date();
    batchStore.set(batchId, result);

    return result;
  },
};

export default batchGenerateService;

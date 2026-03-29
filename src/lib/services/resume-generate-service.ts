/**
 * 断点续传服务
 * 支持中断后继续生成文档
 */

import { db } from '@/db';
import { bidDocuments, bidChapters, documentGenerationHistories } from '@/db/schema';
import { eq, and as _and, inArray as _inArray } from 'drizzle-orm';
import { generationProgressServiceV2, Checkpoint, GenerationProgress } from './generation-progress-service-v2';
import { oneClickGenerateService as _oneClickGenerateService, OneClickGenerateParams } from './one-click-generate-service';

// ============================================
// 类型定义
// ============================================

export interface ResumeResult {
  success: boolean;
  documentId: number;
  resumedFrom: {
    chapterIndex: number;
    completedChapters: number;
    failedChapters: number;
  };
  message: string;
}

export interface GenerationTask {
  documentId: number;
  params: OneClickGenerateParams;
  userId: number;
  startedAt: Date;
  status: 'running' | 'paused' | 'completed' | 'failed';
}

// ============================================
// 断点续传服务
// ============================================

export const resumeGenerateService = {
  /**
   * 检查是否有可恢复的任务
   */
  async checkResumable(documentId: number): Promise<{
    canResume: boolean;
    checkpoint: Checkpoint | null;
    progress: GenerationProgress | null;
  }> {
    const checkpoint = await generationProgressServiceV2.getCheckpoint(documentId);
    const progress = await generationProgressServiceV2.getProgress(documentId);
    const canResume = await generationProgressServiceV2.canResume(documentId);

    return {
      canResume,
      checkpoint,
      progress,
    };
  },

  /**
   * 恢复生成
   */
  async resumeGeneration(
    documentId: number,
    userId: number,
    customHeaders?: Record<string, string>
  ): Promise<ResumeResult> {
    // 获取检查点
    const checkpoint = await generationProgressServiceV2.getCheckpoint(documentId);
    if (!checkpoint) {
      return {
        success: false,
        documentId,
        resumedFrom: { chapterIndex: 0, completedChapters: 0, failedChapters: 0 },
        message: '没有找到可恢复的检查点',
      };
    }

    // 获取文档信息
    const [document] = await db
      .select()
      .from(bidDocuments)
      .where(eq(bidDocuments.id, documentId))
      .limit(1);

    if (!document) {
      return {
        success: false,
        documentId,
        resumedFrom: { chapterIndex: 0, completedChapters: 0, failedChapters: 0 },
        message: '文档不存在',
      };
    }

    // 获取生成历史
    const [history] = await db
      .select()
      .from(documentGenerationHistories)
      .where(eq(documentGenerationHistories.documentId, documentId))
      .orderBy(documentGenerationHistories.createdAt)
      .limit(1);

    if (!history) {
      return {
        success: false,
        documentId,
        resumedFrom: { chapterIndex: 0, completedChapters: 0, failedChapters: 0 },
        message: '没有找到生成历史记录',
      };
    }

    // 解析生成配置
    const params: OneClickGenerateParams = {
      projectId: document.projectId,
      documentName: document.name,
      interpretationId: history.interpretationId || 0,
      companyIds: history.companyIds ? JSON.parse(history.companyIds) : [],
      partnerApplicationIds: history.partnerApplicationIds 
        ? JSON.parse(history.partnerApplicationIds) 
        : undefined,
      generateOptions: history.generationConfig 
        ? JSON.parse(history.generationConfig).generateOptions || {
            includeQualification: true,
            includePerformance: true,
            includeTechnical: true,
            includeBusiness: true,
            style: 'formal' as const,
          }
        : {
            includeQualification: true,
            includePerformance: true,
            includeTechnical: true,
            includeBusiness: true,
            style: 'formal' as const,
          },
    };

    // 恢复进度
    await generationProgressServiceV2.resumeGeneration(documentId);

    // 获取所有章节
    const allChapters = await db
      .select()
      .from(bidChapters)
      .where(eq(bidChapters.documentId, documentId))
      .orderBy(bidChapters.sortOrder);

    // 找出需要重新生成的章节
    const pendingChapters = allChapters.filter(
      (ch) => !checkpoint.completedChapterIds.includes(ch.id)
    );

    // 继续生成
    try {
      const _result = await this.continueGeneration(
        documentId,
        pendingChapters,
        params,
        userId,
        checkpoint,
        customHeaders
      );

      return {
        success: true,
        documentId,
        resumedFrom: {
          chapterIndex: checkpoint.currentChapterIndex,
          completedChapters: checkpoint.completedChapterIds.length,
          failedChapters: checkpoint.failedChapterIds.length,
        },
        message: `已从第 ${checkpoint.currentChapterIndex + 1} 章恢复生成`,
      };
    } catch (error: any) {
      await generationProgressServiceV2.failGeneration(documentId, error.message);
      return {
        success: false,
        documentId,
        resumedFrom: {
          chapterIndex: checkpoint.currentChapterIndex,
          completedChapters: checkpoint.completedChapterIds.length,
          failedChapters: checkpoint.failedChapterIds.length,
        },
        message: `恢复失败: ${error.message}`,
      };
    }
  },

  /**
   * 继续生成剩余章节
   */
  async continueGeneration(
    documentId: number,
    pendingChapters: any[],
    params: OneClickGenerateParams,
    userId: number,
    checkpoint: Checkpoint,
    customHeaders?: Record<string, string>
  ): Promise<void> {
    const { oneClickGenerateService } = await import('./one-click-generate-service');

    // 获取解读数据和上下文
    const interpretation = await oneClickGenerateService.getInterpretationData(params.interpretationId);
    if (!interpretation) {
      throw new Error('招标文件解读不存在');
    }

    const companiesData = await oneClickGenerateService.getCompaniesData(params.companyIds);
    let partnerMaterialsData: any[] = [];
    if (params.partnerApplicationIds && params.partnerApplicationIds.length > 0) {
      partnerMaterialsData = await oneClickGenerateService.getPartnerMaterials(params.partnerApplicationIds);
    }

    const context = {
      interpretation,
      companiesData,
      partnerMaterials: partnerMaterialsData,
      generateOptions: params.generateOptions,
    };

    // 获取当前进度
    let progress = await generationProgressServiceV2.getProgress(documentId);
    if (!progress) {
      throw new Error('进度数据不存在');
    }

    // 更新总步数
    const totalSteps = checkpoint.completedChapterIds.length + pendingChapters.length;
    await generationProgressServiceV2.updateProgress(documentId, {
      totalSteps,
      currentStep: '继续生成中...',
    });

    // 生成每个待处理章节
    for (let i = 0; i < pendingChapters.length; i++) {
      const chapter = pendingChapters[i];

      // 检查是否已暂停
      progress = await generationProgressServiceV2.getProgress(documentId);
      if (progress?.status === 'paused') {
        await generationProgressServiceV2.saveCheckpoint(documentId);
        return;
      }

      // 开始章节
      await generationProgressServiceV2.startChapter(
        documentId,
        chapter.id,
        chapter.title,
        checkpoint.currentChapterIndex + i + 1,
        totalSteps
      );

      try {
        // 生成章节内容
        const result = await oneClickGenerateService.generateChapter(
          documentId,
          {
            chapterTitle: chapter.title,
            chapterNumber: chapter.serialNumber,
            sortOrder: chapter.sortOrder,
            level: chapter.level,
            contentRequirement: null,
          },
          context,
          userId,
          customHeaders
        );

        if (result) {
          await generationProgressServiceV2.completeChapter(
            documentId,
            chapter.id,
            chapter.title,
            result.wordCount
          );
        }
      } catch (error: any) {
        await generationProgressServiceV2.recordError(
          documentId,
          chapter.id,
          chapter.title,
          error.message
        );
      }
    }

    // 完成
    await generationProgressServiceV2.completeGeneration(documentId);

    // 更新文档状态
    const finalProgress = await generationProgressServiceV2.getProgress(documentId);
    await db
      .update(bidDocuments)
      .set({
        status: 'reviewing',
        wordCount: finalProgress?.statistics.totalWordCount || 0,
        progress: 100,
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, documentId));

    // 更新生成历史
    if (finalProgress) {
      await db
        .update(documentGenerationHistories)
        .set({
          status: 'completed',
          totalChapters: finalProgress.statistics.totalChapters,
          generatedChapters: finalProgress.statistics.generatedChapters,
          totalWordCount: finalProgress.statistics.totalWordCount,
          completedAt: new Date(),
          duration: finalProgress.statistics.elapsedTime,
        })
        .where(eq(documentGenerationHistories.documentId, documentId));
    }
  },

  /**
   * 获取项目中所有可恢复的任务
   */
  async getResumableTasks(projectId: number): Promise<Array<{
    documentId: number;
    documentName: string;
    progress: GenerationProgress;
    checkpoint: Checkpoint | null;
  }>> {
    const documents = await db
      .select()
      .from(bidDocuments)
      .where(eq(bidDocuments.projectId, projectId));

    const resumableTasks: Array<{
      documentId: number;
      documentName: string;
      progress: GenerationProgress;
      checkpoint: Checkpoint | null;
    }> = [];

    for (const doc of documents) {
      const progress = await generationProgressServiceV2.getProgress(doc.id);
      if (progress && (progress.status === 'paused' || progress.status === 'failed')) {
        const checkpoint = await generationProgressServiceV2.getCheckpoint(doc.id);
        resumableTasks.push({
          documentId: doc.id,
          documentName: doc.name,
          progress,
          checkpoint,
        });
      }
    }

    return resumableTasks;
  },

  /**
   * 取消生成任务
   */
  async cancelGeneration(documentId: number): Promise<boolean> {
    const progress = await generationProgressServiceV2.getProgress(documentId);
    if (!progress) return false;

    await generationProgressServiceV2.failGeneration(documentId, '用户取消');
    await generationProgressServiceV2.clearProgress(documentId);

    // 更新文档状态
    await db
      .update(bidDocuments)
      .set({
        status: 'draft',
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, documentId));

    return true;
  },
};

export default resumeGenerateService;

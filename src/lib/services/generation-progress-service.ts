/**
 * 文档生成进度追踪服务
 * 支持实时进度显示和SSE推送
 */

import { db } from '@/db';
import { bidDocuments, bidChapters } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface GenerationProgress {
  documentId: number;
  status: 'preparing' | 'generating' | 'completed' | 'failed';
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  percentage: number;
  currentChapter?: {
    title: string;
    index: number;
    total: number;
  };
  statistics: {
    totalChapters: number;
    generatedChapters: number;
    totalWordCount: number;
    elapsedTime: number; // 毫秒
    estimatedRemaining: number; // 毫秒
  };
  errors: Array<{
    chapterTitle: string;
    error: string;
    timestamp: Date;
  }>;
  startedAt: Date;
  updatedAt: Date;
}

export interface ProgressUpdate {
  type: 'start' | 'progress' | 'chapter_start' | 'chapter_complete' | 'complete' | 'error';
  data: GenerationProgress;
}

// ============================================
// 内存进度存储（生产环境可替换为Redis）
// ============================================

const progressStore = new Map<number, GenerationProgress>();
const progressSubscribers = new Map<number, Set<(update: ProgressUpdate) => void>>();

// ============================================
// 进度追踪服务
// ============================================

export const generationProgressService = {
  /**
   * 初始化生成进度
   */
  initProgress(documentId: number, totalChapters: number): GenerationProgress {
    const now = new Date();
    const progress: GenerationProgress = {
      documentId,
      status: 'preparing',
      currentStep: '初始化生成任务',
      totalSteps: totalChapters + 1, // +1 for initialization
      completedSteps: 0,
      percentage: 0,
      statistics: {
        totalChapters,
        generatedChapters: 0,
        totalWordCount: 0,
        elapsedTime: 0,
        estimatedRemaining: 0,
      },
      errors: [],
      startedAt: now,
      updatedAt: now,
    };

    progressStore.set(documentId, progress);
    this.notifySubscribers(documentId, 'start', progress);
    return progress;
  },

  /**
   * 更新进度
   */
  updateProgress(
    documentId: number,
    update: Partial<GenerationProgress>
  ): GenerationProgress | null {
    const progress = progressStore.get(documentId);
    if (!progress) return null;

    const now = new Date();
    const updatedProgress: GenerationProgress = {
      ...progress,
      ...update,
      updatedAt: now,
      statistics: {
        ...progress.statistics,
        ...update.statistics,
        elapsedTime: now.getTime() - progress.startedAt.getTime(),
      },
    };

    // 计算预计剩余时间
    if (updatedProgress.completedSteps > 0 && updatedProgress.totalSteps > 0) {
      const avgTimePerStep = updatedProgress.statistics.elapsedTime / updatedProgress.completedSteps;
      const remainingSteps = updatedProgress.totalSteps - updatedProgress.completedSteps;
      updatedProgress.statistics.estimatedRemaining = avgTimePerStep * remainingSteps;
    }

    // 计算百分比
    updatedProgress.percentage = Math.round(
      (updatedProgress.completedSteps / updatedProgress.totalSteps) * 100
    );

    progressStore.set(documentId, updatedProgress);
    this.notifySubscribers(documentId, 'progress', updatedProgress);
    return updatedProgress;
  },

  /**
   * 开始生成章节
   */
  startChapter(documentId: number, chapterTitle: string, chapterIndex: number, totalChapters: number): GenerationProgress | null {
    const progress = progressStore.get(documentId);
    if (!progress) return null;

    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'generating',
      currentStep: `正在生成: ${chapterTitle}`,
      currentChapter: {
        title: chapterTitle,
        index: chapterIndex,
        total: totalChapters,
      },
      updatedAt: new Date(),
    };

    progressStore.set(documentId, updatedProgress);
    this.notifySubscribers(documentId, 'chapter_start', updatedProgress);
    return updatedProgress;
  },

  /**
   * 完成章节生成
   */
  completeChapter(
    documentId: number,
    chapterTitle: string,
    wordCount: number
  ): GenerationProgress | null {
    const progress = progressStore.get(documentId);
    if (!progress) return null;

    const updatedProgress: GenerationProgress = {
      ...progress,
      completedSteps: progress.completedSteps + 1,
      statistics: {
        ...progress.statistics,
        generatedChapters: progress.statistics.generatedChapters + 1,
        totalWordCount: progress.statistics.totalWordCount + wordCount,
        elapsedTime: new Date().getTime() - progress.startedAt.getTime(),
        estimatedRemaining: 0,
      },
      currentChapter: undefined,
      updatedAt: new Date(),
    };

    // 计算预计剩余时间
    if (updatedProgress.completedSteps > 0 && updatedProgress.totalSteps > 0) {
      const avgTimePerStep = updatedProgress.statistics.elapsedTime / updatedProgress.completedSteps;
      const remainingSteps = updatedProgress.totalSteps - updatedProgress.completedSteps;
      updatedProgress.statistics.estimatedRemaining = avgTimePerStep * remainingSteps;
    }

    // 计算百分比
    updatedProgress.percentage = Math.round(
      (updatedProgress.completedSteps / updatedProgress.totalSteps) * 100
    );

    progressStore.set(documentId, updatedProgress);
    this.notifySubscribers(documentId, 'chapter_complete', updatedProgress);
    return updatedProgress;
  },

  /**
   * 标记生成完成
   */
  completeGeneration(documentId: number): GenerationProgress | null {
    const progress = progressStore.get(documentId);
    if (!progress) return null;

    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'completed',
      currentStep: '生成完成',
      completedSteps: progress.totalSteps,
      percentage: 100,
      updatedAt: new Date(),
    };

    progressStore.set(documentId, updatedProgress);
    this.notifySubscribers(documentId, 'complete', updatedProgress);
    return updatedProgress;
  },

  /**
   * 记录错误
   */
  recordError(
    documentId: number,
    chapterTitle: string,
    error: string
  ): GenerationProgress | null {
    const progress = progressStore.get(documentId);
    if (!progress) return null;

    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'generating', // 继续生成，但有错误
      errors: [
        ...progress.errors,
        {
          chapterTitle,
          error,
          timestamp: new Date(),
        },
      ],
      updatedAt: new Date(),
    };

    progressStore.set(documentId, updatedProgress);
    this.notifySubscribers(documentId, 'error', updatedProgress);
    return updatedProgress;
  },

  /**
   * 标记生成失败
   */
  failGeneration(documentId: number, error: string): GenerationProgress | null {
    const progress = progressStore.get(documentId);
    if (!progress) return null;

    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'failed',
      currentStep: `生成失败: ${error}`,
      updatedAt: new Date(),
    };

    progressStore.set(documentId, updatedProgress);
    this.notifySubscribers(documentId, 'error', updatedProgress);
    return updatedProgress;
  },

  /**
   * 获取当前进度
   */
  getProgress(documentId: number): GenerationProgress | null {
    return progressStore.get(documentId) || null;
  },

  /**
   * 订阅进度更新
   */
  subscribe(documentId: number, callback: (update: ProgressUpdate) => void): () => void {
    if (!progressSubscribers.has(documentId)) {
      progressSubscribers.set(documentId, new Set());
    }
    progressSubscribers.get(documentId)!.add(callback);

    // 返回取消订阅函数
    return () => {
      const subscribers = progressSubscribers.get(documentId);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          progressSubscribers.delete(documentId);
        }
      }
    };
  },

  /**
   * 通知所有订阅者
   */
  notifySubscribers(
    documentId: number,
    type: ProgressUpdate['type'],
    data: GenerationProgress
  ): void {
    const subscribers = progressSubscribers.get(documentId);
    if (subscribers) {
      const update: ProgressUpdate = { type, data };
      subscribers.forEach((callback) => callback(update));
    }
  },

  /**
   * 清理进度数据
   */
  clearProgress(documentId: number): void {
    progressStore.delete(documentId);
    progressSubscribers.delete(documentId);
  },

  /**
   * 获取格式化的剩余时间
   */
  formatRemainingTime(ms: number): string {
    if (ms <= 0) return '即将完成';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `预计剩余 ${hours} 小时 ${minutes % 60} 分钟`;
    } else if (minutes > 0) {
      return `预计剩余 ${minutes} 分钟 ${seconds % 60} 秒`;
    } else {
      return `预计剩余 ${seconds} 秒`;
    }
  },

  /**
   * 获取格式化的已用时间
   */
  formatElapsedTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    } else {
      return `${seconds}秒`;
    }
  },
};

export default generationProgressService;

/**
 * 文档生成进度追踪服务 V2
 * 支持 Redis 持久化存储、断点续传、SSE 推送
 */

import { db } from '@/db';
import { bidDocuments, bidChapters, documentGenerationHistories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import redis, { RedisKeys, getRedisClient, isUsingMemoryFallback } from '@/lib/cache';

// ============================================
// 类型定义
// ============================================

export interface GenerationProgress {
  documentId: number;
  status: 'pending' | 'preparing' | 'generating' | 'paused' | 'completed' | 'failed';
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  percentage: number;
  currentChapter?: {
    id: number;
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
    chapterId?: number;
    chapterTitle: string;
    error: string;
    timestamp: string;
  }>;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  pausedAt?: string;
  canResume: boolean;
}

export interface ProgressUpdate {
  type: 'start' | 'progress' | 'chapter_start' | 'chapter_complete' | 'pause' | 'resume' | 'complete' | 'error';
  data: GenerationProgress;
}

export interface Checkpoint {
  documentId: number;
  currentChapterIndex: number;
  completedChapterIds: number[];
  pendingChapterIds: number[];
  failedChapterIds: number[];
  lastChapterId?: number;
  lastChapterTitle?: string;
  totalWordCount: number;
  startedAt: string;
  updatedAt: string;
  canResume: boolean;
}

export interface ChapterProgress {
  chapterId: number;
  documentId: number;
  chapterTitle: string;
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'skipped';
  wordCount: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
}

// 进度存储 TTL（24小时）
const PROGRESS_TTL = 24 * 60 * 60;

// ============================================
// 进度追踪服务
// ============================================

export const generationProgressServiceV2 = {
  /**
   * 初始化生成进度
   */
  async initProgress(documentId: number, totalChapters: number): Promise<GenerationProgress> {
    const now = new Date().toISOString();
    const progress: GenerationProgress = {
      documentId,
      status: 'preparing',
      currentStep: '初始化生成任务',
      totalSteps: totalChapters + 1,
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
      canResume: false,
    };

    // 保存到 Redis
    await redis.set(RedisKeys.generationProgress(documentId.toString()), JSON.stringify(progress), PROGRESS_TTL);

    // 发布进度更新
    await this.notifySubscribers(documentId, 'start', progress);

    return progress;
  },

  /**
   * 获取进度
   */
  async getProgress(documentId: number): Promise<GenerationProgress | null> {
    const val = await redis.get(RedisKeys.generationProgress(documentId.toString()));
    return val ? JSON.parse(val) : null;
  },

  /**
   * 更新进度
   */
  async updateProgress(
    documentId: number,
    update: Partial<GenerationProgress>
  ): Promise<GenerationProgress | null> {
    const progress = await this.getProgress(documentId);
    if (!progress) return null;

    const now = new Date().toISOString();
    const startedAt = new Date(progress.startedAt);
    const elapsedMs = Date.now() - startedAt.getTime();

    const updatedProgress: GenerationProgress = {
      ...progress,
      ...update,
      updatedAt: now,
      statistics: {
        ...progress.statistics,
        ...update.statistics,
        elapsedTime: elapsedMs,
      },
    };

    // 计算预计剩余时间
    if (updatedProgress.completedSteps > 0 && updatedProgress.totalSteps > 0) {
      const avgTimePerStep = elapsedMs / updatedProgress.completedSteps;
      const remainingSteps = updatedProgress.totalSteps - updatedProgress.completedSteps;
      updatedProgress.statistics.estimatedRemaining = avgTimePerStep * remainingSteps;
    }

    // 计算百分比
    updatedProgress.percentage = Math.round(
      (updatedProgress.completedSteps / updatedProgress.totalSteps) * 100
    );

    // 保存到 Redis
    await redis.set(RedisKeys.generationProgress(documentId.toString()), JSON.stringify(updatedProgress), PROGRESS_TTL);

    // 发布进度更新
    await this.notifySubscribers(documentId, 'progress', updatedProgress);

    return updatedProgress;
  },

  /**
   * 开始生成章节
   */
  async startChapter(
    documentId: number,
    chapterId: number,
    chapterTitle: string,
    chapterIndex: number,
    totalChapters: number
  ): Promise<GenerationProgress | null> {
    const progress = await this.getProgress(documentId);
    if (!progress) return null;

    const now = new Date().toISOString();

    // 保存章节进度
    const chapterProgress: ChapterProgress = {
      chapterId,
      documentId,
      chapterTitle,
      status: 'generating',
      startedAt: now,
      retryCount: 0,
      wordCount: 0,
    };
    await redis.hset(RedisKeys.generationChapter(documentId.toString(), 0), chapterId.toString(), JSON.stringify(chapterProgress));

    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'generating',
      currentStep: `正在生成: ${chapterTitle}`,
      currentChapter: {
        id: chapterId,
        title: chapterTitle,
        index: chapterIndex,
        total: totalChapters,
      },
      updatedAt: now,
    };

    await redis.set(RedisKeys.generationProgress(documentId.toString()), JSON.stringify(updatedProgress), PROGRESS_TTL);
    await this.notifySubscribers(documentId, 'chapter_start', updatedProgress);

    return updatedProgress;
  },

  /**
   * 完成章节生成
   */
  async completeChapter(
    documentId: number,
    chapterId: number,
    chapterTitle: string,
    wordCount: number
  ): Promise<GenerationProgress | null> {
    const progress = await this.getProgress(documentId);
    if (!progress) return null;

    const now = new Date().toISOString();

    // 更新章节进度
    const chapterProgress: ChapterProgress = {
      chapterId,
      documentId,
      chapterTitle,
      status: 'completed',
      wordCount,
      completedAt: now,
      retryCount: 0,
    };
    await redis.hset(RedisKeys.generationChapter(documentId.toString(), 0), chapterId.toString(), JSON.stringify(chapterProgress));

    const startedAt = new Date(progress.startedAt);
    const elapsedMs = Date.now() - startedAt.getTime();

    const updatedProgress: GenerationProgress = {
      ...progress,
      completedSteps: progress.completedSteps + 1,
      statistics: {
        ...progress.statistics,
        generatedChapters: progress.statistics.generatedChapters + 1,
        totalWordCount: progress.statistics.totalWordCount + wordCount,
        elapsedTime: elapsedMs,
        estimatedRemaining: 0,
      },
      currentChapter: undefined,
      updatedAt: now,
    };

    // 计算预计剩余时间
    if (updatedProgress.completedSteps > 0 && updatedProgress.totalSteps > 0) {
      const avgTimePerStep = elapsedMs / updatedProgress.completedSteps;
      const remainingSteps = updatedProgress.totalSteps - updatedProgress.completedSteps;
      updatedProgress.statistics.estimatedRemaining = avgTimePerStep * remainingSteps;
    }

    // 计算百分比
    updatedProgress.percentage = Math.round(
      (updatedProgress.completedSteps / updatedProgress.totalSteps) * 100
    );

    await redis.set(RedisKeys.generationProgress(documentId.toString()), JSON.stringify(updatedProgress), PROGRESS_TTL);
    await this.notifySubscribers(documentId, 'chapter_complete', updatedProgress);

    return updatedProgress;
  },

  /**
   * 记录错误
   */
  async recordError(
    documentId: number,
    chapterId: number | undefined,
    chapterTitle: string,
    error: string
  ): Promise<GenerationProgress | null> {
    const progress = await this.getProgress(documentId);
    if (!progress) return null;

    const now = new Date().toISOString();

    // 更新章节进度
    if (chapterId) {
      const chapterProgress: ChapterProgress = {
        chapterId,
        documentId,
        chapterTitle,
        status: 'failed',
        error,
        retryCount: 0,
        wordCount: 0,
      };
      await redis.hset(RedisKeys.generationChapter(documentId.toString(), 0), chapterId.toString(), JSON.stringify(chapterProgress));
    }

    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'generating', // 继续生成，但有错误
      errors: [
        ...progress.errors,
        {
          chapterId,
          chapterTitle,
          error,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };

    await redis.set(RedisKeys.generationProgress(documentId.toString()), JSON.stringify(updatedProgress), PROGRESS_TTL);
    await this.notifySubscribers(documentId, 'error', updatedProgress);

    return updatedProgress;
  },

  /**
   * 暂停生成
   */
  async pauseGeneration(documentId: number): Promise<GenerationProgress | null> {
    const progress = await this.getProgress(documentId);
    if (!progress) return null;

    const now = new Date().toISOString();
    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'paused',
      pausedAt: now,
      currentStep: '已暂停',
      canResume: true,
      updatedAt: now,
    };

    await redis.set(RedisKeys.generationProgress(documentId.toString()), JSON.stringify(updatedProgress), PROGRESS_TTL);

    // 保存检查点
    await this.saveCheckpoint(documentId);

    await this.notifySubscribers(documentId, 'pause', updatedProgress);

    return updatedProgress;
  },

  /**
   * 恢复生成
   */
  async resumeGeneration(documentId: number): Promise<GenerationProgress | null> {
    const progress = await this.getProgress(documentId);
    if (!progress || progress.status !== 'paused') return null;

    const now = new Date().toISOString();
    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'generating',
      pausedAt: undefined,
      currentStep: '继续生成中...',
      updatedAt: now,
    };

    await redis.set(RedisKeys.generationProgress(documentId.toString()), JSON.stringify(updatedProgress), PROGRESS_TTL);
    await this.notifySubscribers(documentId, 'resume', updatedProgress);

    return updatedProgress;
  },

  /**
   * 标记生成完成
   */
  async completeGeneration(documentId: number): Promise<GenerationProgress | null> {
    const progress = await this.getProgress(documentId);
    if (!progress) return null;

    const now = new Date().toISOString();
    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'completed',
      currentStep: '生成完成',
      completedSteps: progress.totalSteps,
      percentage: 100,
      completedAt: now,
      canResume: false,
      updatedAt: now,
    };

    await redis.set(RedisKeys.generationProgress(documentId.toString()), JSON.stringify(updatedProgress), PROGRESS_TTL);
    await this.notifySubscribers(documentId, 'complete', updatedProgress);

    return updatedProgress;
  },

  /**
   * 标记生成失败
   */
  async failGeneration(documentId: number, error: string): Promise<GenerationProgress | null> {
    const progress = await this.getProgress(documentId);
    if (!progress) return null;

    const now = new Date().toISOString();
    const updatedProgress: GenerationProgress = {
      ...progress,
      status: 'failed',
      currentStep: `生成失败: ${error}`,
      canResume: true, // 失败可以重试
      updatedAt: now,
    };

    await redis.set(RedisKeys.generationProgress(documentId.toString()), JSON.stringify(updatedProgress), PROGRESS_TTL);
    await this.notifySubscribers(documentId, 'error', updatedProgress);

    return updatedProgress;
  },

  // ============================================
  // 断点续传相关
  // ============================================

  /**
   * 保存检查点
   */
  async saveCheckpoint(documentId: number): Promise<Checkpoint | null> {
    const progress = await this.getProgress(documentId);
    if (!progress) return null;

    // 获取所有章节进度
    const chaptersVal = await redis.hgetall(RedisKeys.generationChapter(documentId.toString(), 0));
    const chapters = chaptersVal as Record<string, ChapterProgress>;

    const completedChapterIds: number[] = [];
    const failedChapterIds: number[] = [];
    const pendingChapterIds: number[] = [];

    for (const [id, chapter] of Object.entries(chapters)) {
      const chapterData = chapter as any;
      if (chapterData.status === 'completed') {
        completedChapterIds.push(parseInt(id));
      } else if (chapterData.status === 'failed') {
        failedChapterIds.push(parseInt(id));
      } else {
        pendingChapterIds.push(parseInt(id));
      }
    }

    const checkpoint: Checkpoint = {
      documentId,
      currentChapterIndex: progress.currentChapter?.index || 0,
      completedChapterIds,
      pendingChapterIds,
      failedChapterIds,
      lastChapterId: progress.currentChapter?.id,
      lastChapterTitle: progress.currentChapter?.title,
      totalWordCount: progress.statistics.totalWordCount,
      startedAt: progress.startedAt,
      updatedAt: progress.updatedAt,
      canResume: true,
    };

    await redis.set(RedisKeys.generationCheckpoint(documentId.toString()), JSON.stringify(checkpoint), PROGRESS_TTL);

    return checkpoint;
  },

  /**
   * 获取检查点
   */
  async getCheckpoint(documentId: number): Promise<Checkpoint | null> {
    const val = await redis.get(RedisKeys.generationCheckpoint(documentId.toString()));
    return val ? JSON.parse(val) : null;
  },

  /**
   * 检查是否可以恢复
   */
  async canResume(documentId: number): Promise<boolean> {
    const checkpoint = await this.getCheckpoint(documentId);
    if (!checkpoint) return false;

    const progress = await this.getProgress(documentId);
    if (!progress) return true; // 有检查点但没有进度，可以恢复

    return progress.status === 'paused' || progress.status === 'failed';
  },

  /**
   * 清理进度数据
   */
  async clearProgress(documentId: number): Promise<void> {
    await redis.del(RedisKeys.generationProgress(documentId.toString()));
    await redis.del(RedisKeys.generationCheckpoint(documentId.toString()));
    await redis.del(RedisKeys.generationChapter(documentId.toString(), 0));
  },

  // ============================================
  // 订阅相关
  // ============================================

  /**
   * 订阅进度更新
   */
  async subscribe(documentId: number, callback: (update: ProgressUpdate) => void): Promise<() => void> {
    const channel = `progress:${documentId}`;
    
    const subscription = await redis.subscribe(channel, (message: string) => {
      try {
        const update = JSON.parse(message) as ProgressUpdate;
        callback(update);
      } catch (error) {
        console.error('[Progress] Failed to parse message:', error);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  /**
   * 通知订阅者
   */
  async notifySubscribers(
    documentId: number,
    type: ProgressUpdate['type'],
    data: GenerationProgress
  ): Promise<void> {
    const channel = `progress:${documentId}`;
    const message: ProgressUpdate = { type, data };
    await redis.publish(channel, JSON.stringify(message));
  },

  // ============================================
  // 格式化工具
  // ============================================

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

  /**
   * 检查是否使用内存存储
   */
  isUsingMemoryStorage(): boolean {
    return isUsingMemoryFallback();
  },
};

export default generationProgressServiceV2;

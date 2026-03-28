/**
 * 大文件分片上传服务
 * 支持断点续传、进度追踪、并发上传
 */

// ============================================
// 类型定义
// ============================================

export interface UploadTask {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  progress: number;
  uploadId?: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface ChunkUploadResult {
  chunkIndex: number;
  success: boolean;
  etag?: string;
  error?: string;
}

export interface UploadOptions {
  chunkSize?: number; // 分片大小（字节），默认5MB
  concurrency?: number; // 并发上传数，默认3
  onProgress?: (taskId: string, progress: number) => void;
  onChunkComplete?: (taskId: string, chunkIndex: number, total: number) => void;
  onComplete?: (taskId: string, result: { fileId: number; url: string }) => void;
  onError?: (taskId: string, error: string) => void;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_CONCURRENCY = 3;

// ============================================
// 上传管理器
// ============================================

class UploadManager {
  private tasks = new Map<string, UploadTask>();
  private options: UploadOptions;
  private abortControllers = new Map<string, AbortController>();

  constructor(options: UploadOptions = {}) {
    this.options = {
      chunkSize: DEFAULT_CHUNK_SIZE,
      concurrency: DEFAULT_CONCURRENCY,
      ...options,
    };
  }

  /**
   * 创建上传任务
   */
  createTask(file: File): UploadTask {
    const taskId = this.generateTaskId();
    const chunkSize = this.options.chunkSize || DEFAULT_CHUNK_SIZE;
    const totalChunks = Math.ceil(file.size / chunkSize);

    const task: UploadTask = {
      id: taskId,
      file,
      fileName: file.name,
      fileSize: file.size,
      chunkSize,
      totalChunks,
      uploadedChunks: [],
      status: 'pending',
      progress: 0,
      startTime: new Date(),
    };

    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * 开始上传
   */
  async startUpload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('任务不存在');
    if (task.status === 'uploading') return;

    task.status = 'uploading';
    const abortController = new AbortController();
    this.abortControllers.set(taskId, abortController);

    try {
      // 初始化分片上传
      const initResult = await this.initMultipartUpload(task, abortController.signal);
      task.uploadId = initResult.uploadId;

      // 并发上传分片
      await this.uploadChunks(task, abortController.signal);

      // 完成上传
      const completeResult = await this.completeMultipartUpload(task, abortController.signal);

      task.status = 'completed';
      task.progress = 100;
      task.endTime = new Date();

      this.options.onComplete?.(taskId, completeResult);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        task.status = 'paused';
      } else {
        task.status = 'error';
        task.error = (error as Error).message;
        this.options.onError?.(taskId, task.error);
      }
    }
  }

  /**
   * 暂停上传
   */
  pauseUpload(taskId: string): void {
    const abortController = this.abortControllers.get(taskId);
    if (abortController) {
      abortController.abort();
    }
  }

  /**
   * 恢复上传
   */
  async resumeUpload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('任务不存在');
    if (task.status !== 'paused') return;

    await this.startUpload(taskId);
  }

  /**
   * 取消上传
   */
  async cancelUpload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.pauseUpload(taskId);

    // 通知服务器取消上传
    if (task.uploadId) {
      await this.abortMultipartUpload(task);
    }

    this.tasks.delete(taskId);
    this.abortControllers.delete(taskId);
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): UploadTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): UploadTask[] {
    return Array.from(this.tasks.values());
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 初始化分片上传
   */
  private async initMultipartUpload(
    task: UploadTask,
    signal: AbortSignal
  ): Promise<{ uploadId: string }> {
    const response = await fetch('/api/files/multipart/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: task.fileName,
        fileSize: task.fileSize,
        mimeType: task.file.type,
        totalChunks: task.totalChunks,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error('初始化上传失败');
    }

    return response.json();
  }

  /**
   * 上传分片
   */
  private async uploadChunks(task: UploadTask, signal: AbortSignal): Promise<void> {
    const concurrency = this.options.concurrency || DEFAULT_CONCURRENCY;
    const pendingChunks = this.getPendingChunks(task);

    // 分批并发上传
    for (let i = 0; i < pendingChunks.length; i += concurrency) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const batch = pendingChunks.slice(i, i + concurrency);
      await Promise.all(batch.map((chunkIndex) => this.uploadChunk(task, chunkIndex, signal)));
    }
  }

  /**
   * 上传单个分片
   */
  private async uploadChunk(
    task: UploadTask,
    chunkIndex: number,
    signal: AbortSignal
  ): Promise<ChunkUploadResult> {
    const start = chunkIndex * task.chunkSize;
    const end = Math.min(start + task.chunkSize, task.fileSize);
    const chunk = task.file.slice(start, end);

    // 获取分片上传URL
    const presignResponse = await fetch('/api/files/multipart/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: task.uploadId,
        chunkIndex,
      }),
      signal,
    });

    if (!presignResponse.ok) {
      throw new Error('获取上传地址失败');
    }

    const { uploadUrl } = await presignResponse.json();

    // 上传分片
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: chunk,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      signal,
    });

    if (!uploadResponse.ok) {
      throw new Error(`分片 ${chunkIndex} 上传失败`);
    }

    const etag = uploadResponse.headers.get('ETag') || '';

    // 记录已上传分片
    task.uploadedChunks.push(chunkIndex);
    task.progress = Math.round((task.uploadedChunks.length / task.totalChunks) * 100);

    this.options.onProgress?.(task.id, task.progress);
    this.options.onChunkComplete?.(task.id, chunkIndex, task.totalChunks);

    return { chunkIndex, success: true, etag };
  }

  /**
   * 完成分片上传
   */
  private async completeMultipartUpload(
    task: UploadTask,
    signal: AbortSignal
  ): Promise<{ fileId: number; url: string }> {
    const response = await fetch('/api/files/multipart/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: task.uploadId,
        fileName: task.fileName,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error('完成上传失败');
    }

    return response.json();
  }

  /**
   * 取消分片上传
   */
  private async abortMultipartUpload(task: UploadTask): Promise<void> {
    try {
      await fetch('/api/files/multipart/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: task.uploadId }),
      });
    } catch (error) {
      console.error('Abort upload error:', error);
    }
  }

  /**
   * 获取待上传分片
   */
  private getPendingChunks(task: UploadTask): number[] {
    const allChunks = Array.from({ length: task.totalChunks }, (_, i) => i);
    return allChunks.filter((i) => !task.uploadedChunks.includes(i));
  }
}

// ============================================
// 导出单例
// ============================================

export const uploadManager = new UploadManager();

// ============================================
// React Hook
// ============================================

import { useState, useCallback, useRef } from 'react';

export function useFileUpload(options: UploadOptions = {}) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const managerRef = useRef<UploadManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new UploadManager({
      ...options,
      onProgress: (taskId, progress) => {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, progress } : t))
        );
        options.onProgress?.(taskId, progress);
      },
      onComplete: (taskId, result) => {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: 'completed' as const } : t
          )
        );
        options.onComplete?.(taskId, result);
      },
      onError: (taskId, error) => {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: 'error' as const, error } : t
          )
        );
        options.onError?.(taskId, error);
      },
    });
  }

  const addFile = useCallback((file: File) => {
    const task = managerRef.current!.createTask(file);
    setTasks((prev) => [...prev, task]);
    return task;
  }, []);

  const startUpload = useCallback(async (taskId: string) => {
    await managerRef.current!.startUpload(taskId);
  }, []);

  const pauseUpload = useCallback((taskId: string) => {
    managerRef.current!.pauseUpload(taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'paused' as const } : t))
    );
  }, []);

  const resumeUpload = useCallback(async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'uploading' as const } : t))
    );
    await managerRef.current!.resumeUpload(taskId);
  }, []);

  const cancelUpload = useCallback(async (taskId: string) => {
    await managerRef.current!.cancelUpload(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  return {
    tasks,
    addFile,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
  };
}

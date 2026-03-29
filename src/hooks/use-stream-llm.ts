/**
 * 流式LLM响应Hook
 * 支持SSE流式读取和打字机式渲染
 */

'use client';

import { useState, useCallback, useRef } from 'react';

// ============================================
// 类型定义
// ============================================

export interface StreamMessage {
  type: 'text' | 'progress' | 'issue' | 'phase' | 'complete' | 'error' | 'start';
  content?: string;
  progress?: number;
  step?: string;
  issue?: StreamIssue;
  phase?: string;
  phaseName?: string;
  result?: unknown;
  error?: string;
  wordCount?: number;
}

export interface StreamIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  location: {
    chapterId?: number;
    chapterTitle?: string;
  };
  message: string;
  suggestion?: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface StreamState {
  content: string;
  isStreaming: boolean;
  progress: number;
  currentPhase: string | null;
  issues: StreamIssue[];
  error: string | null;
  wordCount: number;
}

export interface UseStreamLLMOptions {
  onText?: (text: string) => void;
  onComplete?: (result: unknown) => void;
  onError?: (error: string) => void;
  onIssue?: (issue: StreamIssue) => void;
  onProgress?: (progress: number) => void;
}

// ============================================
// Hook实现
// ============================================

export function useStreamLLM(options: UseStreamLLMOptions = {}) {
  const [state, setState] = useState<StreamState>({
    content: '',
    isStreaming: false,
    progress: 0,
    currentPhase: null,
    issues: [],
    error: null,
    wordCount: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 流式请求
   */
  const stream = useCallback(async (
    url: string,
    body: Record<string, unknown>
  ): Promise<void> => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      content: '',
      isStreaming: true,
      progress: 0,
      currentPhase: null,
      issues: [],
      error: null,
      wordCount: 0,
    }));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析SSE消息
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的消息

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as StreamMessage;
              handleMessage(data);
            } catch (_e) {
              console.error('Failed to parse SSE message:', line);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream aborted');
        return;
      }
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: errorMessage,
      }));
      options.onError?.(errorMessage);
    }
  }, [options]);

  /**
   * 处理SSE消息
   */
  const handleMessage = useCallback((message: StreamMessage) => {
    switch (message.type) {
      case 'text':
        setState(prev => {
          const newContent = prev.content + (message.content || '');
          options.onText?.(message.content || '');
          return { ...prev, content: newContent };
        });
        break;

      case 'progress':
        setState(prev => ({
          ...prev,
          progress: message.progress || 0,
        }));
        options.onProgress?.(message.progress || 0);
        break;

      case 'phase':
        setState(prev => ({
          ...prev,
          currentPhase: message.phaseName || null,
        }));
        break;

      case 'issue':
        if (message.issue) {
          setState(prev => ({
            ...prev,
            issues: [...prev.issues, message.issue!],
          }));
          options.onIssue?.(message.issue!);
        }
        break;

      case 'complete':
        setState(prev => ({
          ...prev,
          isStreaming: false,
          progress: 100,
          wordCount: message.wordCount || prev.content.length,
        }));
        options.onComplete?.(message.result);
        break;

      case 'error':
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: message.error || '未知错误',
        }));
        options.onError?.(message.error || '未知错误');
        break;
    }
  }, [options]);

  /**
   * 取消请求
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({
        ...prev,
        isStreaming: false,
      }));
    }
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
      content: '',
      isStreaming: false,
      progress: 0,
      currentPhase: null,
      issues: [],
      error: null,
      wordCount: 0,
    });
  }, []);

  return {
    ...state,
    stream,
    abort,
    reset,
  };
}

// ============================================
// 便捷Hooks
// ============================================

/**
 * 标书生成流式Hook
 */
export function useBidGeneration() {
  return useStreamLLM();
}

/**
 * 标书审校流式Hook
 */
export function useBidReview() {
  return useStreamLLM();
}

/**
 * 通用AI对话流式Hook
 */
export function useAIChat() {
  return useStreamLLM();
}

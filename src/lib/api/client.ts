/**
 * 统一 API 客户端
 * 处理请求拦截、响应拦截、错误处理及全局配置
 */

import { toast } from 'sonner';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string | { code?: string; message?: string };
}

class ApiClient {
  private extractErrorMessage(data: any, fallback = '请求失败'): string {
    if (!data) return fallback;

    if (typeof data === 'string') return data;

    if (typeof data?.error === 'string') return data.error;
    if (data?.error && typeof data.error.message === 'string') return data.error.message;

    if (typeof data?.message === 'string') return data.message;

    return fallback;
  }

  private isEventStreamRequest(options: RequestInit): boolean {
    const headers = options.headers as Record<string, string> | undefined;
    return headers?.Accept === 'text/event-stream';
  }

  private async parseResponseBody(response: Response): Promise<any> {
    // 204/205 无内容响应
    if (response.status === 204 || response.status === 205) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';

    // JSON
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }

    // 文本
    if (contentType.includes('text/')) {
      try {
        return await response.text();
      } catch {
        return null;
      }
    }

    // 其他类型不强行解析
    return null;
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      // 流式响应直接返回原始 Response
      if (this.isEventStreamRequest(options)) {
        return response as any;
      }

      const data = await this.parseResponseBody(response);

      if (!response.ok) {
        const errorMessage = this.extractErrorMessage(data, '请求失败');

        if (response.status === 401) {
          console.error('认证失效，请重新登录');
          // 这里先不 toast，避免和登录页局部错误提示重复
        } else {
          toast.error(errorMessage);
        }

        throw new Error(errorMessage);
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error(`API Request Error [${url}]:`, error.message);
      }
      throw error;
    }
  }

  get<T>(url: string, options: RequestInit = {}) {
    return this.request<ApiResponse<T>>(url, { ...options, method: 'GET' });
  }

  post<T>(url: string, body?: any, options: RequestInit = {}) {
    return this.request<ApiResponse<T>>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(url: string, body?: any, options: RequestInit = {}) {
    return this.request<ApiResponse<T>>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(url: string, options: RequestInit = {}) {
    return this.request<ApiResponse<T>>(url, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
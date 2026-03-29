/**
 * 统一 API 客户端
 * 处理请求拦截、响应拦截、错误处理及全局配置
 */

import { toast } from 'sonner';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

class ApiClient {
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      // 处理流式响应 (如果是流式请求，不在这里解析 JSON)
      if (options.headers && (options.headers as any)['Accept'] === 'text/event-stream') {
        return response as any;
      }

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        // 全局错误处理
        const errorMessage =
          typeof data?.error === 'string'
            ? data.error
            : typeof data?.error?.message === 'string'
              ? data.error.message
              : typeof data?.message === 'string'
                ? data.message
                : '请求失败';
        
        if (response.status === 401) {
          // 可以在这里触发登出逻辑
          console.error('认证失效，请重新登录');
        } else {
          toast.error(errorMessage);
        }
        
        throw new Error(errorMessage);
      }

      return data;
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

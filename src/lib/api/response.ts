/**
 * API 响应解包工具
 * 统一处理 { success, data } 与历史裸数据格式。
 */

export function unwrapSuccessData<T>(response: any): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data as T;
  }
  return response as T;
}

export function unwrapPaginatedItems<T>(response: any): T[] {
  const payload = unwrapSuccessData<any>(response);
  if (Array.isArray(payload?.items)) {
    return payload.items as T[];
  }
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  return [];
}

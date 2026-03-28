/**
 * 投标业务 API 服务
 */

import { api } from './client';
import { 
  DocumentDetail, 
  DocumentOverview, 
  ChapterTree, 
  CreateDocumentParams, 
  CreateChapterParams, 
  UpdateChapterParams,
  DocumentStatistics 
} from '@/types/bid';

export const bidService = {
  // 文档相关
  getDocuments: (projectId: number) => 
    api.get<DocumentOverview[]>(`/api/bid/documents?projectId=${projectId}`),
  
  getDocument: (id: number) => 
    api.get<DocumentDetail>(`/api/bid/documents/${id}`),
  
  createDocument: (data: CreateDocumentParams) => 
    api.post<{ documentId: number }>('/api/bid/documents', data),
  
  updateDocument: (id: number, data: Partial<DocumentDetail>) => 
    api.put(`/api/bid/documents/${id}`, data),
  
  deleteDocument: (id: number, permanent = false) => 
    api.delete(`/api/bid/documents/${id}${permanent ? '?permanent=true' : ''}`),

  // 章节相关
  getChapters: (documentId: number) => 
    api.get<ChapterTree[]>(`/api/bid/chapters?documentId=${documentId}`),
  
  getChapter: (id: number) => 
    api.get<{ chapter: any }>(`/api/bid/chapters/${id}`),
  
  createChapter: (data: CreateChapterParams) => 
    api.post<{ chapterId: number }>('/api/bid/chapters', data),
  
  updateChapter: (id: number, data: UpdateChapterParams) => 
    api.put(`/api/bid/chapters/${id}`, data),
  
  deleteChapter: (id: number) => 
    api.delete(`/api/bid/chapters/${id}`),

  // 审批相关
  getApprovals: (documentId?: number) => 
    api.get<any>(`/api/bid/approvals${documentId ? `?documentId=${documentId}` : ''}`),
  
  submitApproval: (documentId: number) => 
    api.post('/api/bid/approvals/submit', { documentId }),
  
  executeApproval: (data: { documentId: number; level: string; action: 'approve' | 'reject'; comment?: string }) => 
    api.post('/api/bid/approvals/execute', data),
  
  withdrawApproval: (documentId: number) => 
    api.post('/api/bid/approvals/withdraw', { documentId }),

  // 统计相关
  getStatistics: (params: { documentId?: number; projectId?: number }) => {
    const query = params.documentId 
      ? `documentId=${params.documentId}` 
      : `projectId=${params.projectId}`;
    return api.get<DocumentStatistics>(`/api/bid/documents/statistics?${query}`);
  },

  // AI 生成相关 (流式请求特殊处理)
  generateChapter: (id: number, config: any, signal?: AbortSignal) => {
    return fetch(`/api/bid/chapters/${id}/generate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(config),
      signal,
    });
  }
};

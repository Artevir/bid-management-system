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
  DocumentStatistics,
  ChapterDetail,
  ApprovalDetail,
  ApprovalExecutionParams,
  AIConfig
} from '@/types/bid';

export const bidService = {
  // 文档相关
  getDocuments: (projectId: number) => 
    api.get<DocumentOverview[]>(`/api/bid/documents?projectId=${projectId}`).then(res => res.data),
  
  getDocument: (id: number) => 
    api.get<DocumentDetail>(`/api/bid/documents/${id}`).then(res => res.data),
  
  createDocument: (data: CreateDocumentParams) => 
    api.post<{ documentId: number }>('/api/bid/documents', data).then(res => res.data),
  
  updateDocument: (id: number, data: Partial<DocumentDetail>) => 
    api.put(`/api/bid/documents/${id}`, data).then(res => res.data),
  
  deleteDocument: (id: number, permanent = false) => 
    api.delete(`/api/bid/documents/${id}${permanent ? '?permanent=true' : ''}`).then(res => res.data),

  // 章节相关
  getChapters: (documentId: number) => 
    api.get<ChapterTree[]>(`/api/bid/chapters?documentId=${documentId}`).then(res => res.data),
  
  getChapter: (id: number) => 
    api.get<ChapterDetail>(`/api/bid/chapters/${id}`).then(res => res.data),
  
  createChapter: (data: CreateChapterParams) => 
    api.post<{ chapterId: number }>('/api/bid/chapters', data).then(res => res.data),
  
  updateChapter: (id: number, data: UpdateChapterParams) => 
    api.put(`/api/bid/chapters/${id}`, data).then(res => res.data),
  
  deleteChapter: (id: number) => 
    api.delete(`/api/bid/chapters/${id}`).then(res => res.data),

  // 审批相关
  getApprovals: (documentId?: number) => 
    api.get<ApprovalDetail[]>(`/api/bid/approvals${documentId ? `?documentId=${documentId}` : ''}`).then(res => res.data),
  
  submitApproval: (documentId: number) => 
    api.post('/api/bid/approvals/submit', { documentId }).then(res => res.data),
  
  executeApproval: (data: ApprovalExecutionParams) => 
    api.post('/api/bid/approvals/execute', data).then(res => res.data),
  
  withdrawApproval: (documentId: number) => 
    api.post('/api/bid/approvals/withdraw', { documentId }).then(res => res.data),

  // 统计相关
  getStatistics: (params: { documentId?: number; projectId?: number }) => {
    const query = params.documentId 
      ? `documentId=${params.documentId}` 
      : `projectId=${params.projectId}`;
    return api.get<DocumentStatistics>(`/api/bid/documents/statistics?${query}`).then(res => res.data);
  },

  // AI 生成相关 (流式请求特殊处理)
  generateChapter: (id: number, config: AIConfig, signal?: AbortSignal) => {
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

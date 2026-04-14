/**
 * 投标业务 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bidService } from '@/lib/api/bid-service';
import { toast } from 'sonner';

// 文档相关 Hooks
export const useDocuments = (projectId?: number) => {
  return useQuery({
    queryKey: ['bid-documents', projectId],
    queryFn: () => bidService.getDocuments(projectId as number),
    enabled: typeof projectId === 'number' && projectId > 0,
  });
};

export const useDocument = (id: number) => {
  return useQuery({
    queryKey: ['bid-document', id],
    queryFn: () => bidService.getDocument(id),
    enabled: !!id,
  });
};

export const useUpdateDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => bidService.updateDocument(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['bid-document', id] });
      toast.success('更新成功');
    },
  });
};

// 章节相关 Hooks
export const useChapters = (documentId: number) => {
  return useQuery({
    queryKey: ['bid-chapters', documentId],
    queryFn: () => bidService.getChapters(documentId),
    enabled: !!documentId,
  });
};

export const useCreateChapter = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => bidService.createChapter(data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['bid-chapters', data.documentId] });
      toast.success('章节创建成功');
    },
  });
};

export const useUpdateChapter = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, documentId: _documentId }: { id: number; data: any; documentId: number }) => 
      bidService.updateChapter(id, data),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ['bid-chapters', documentId] });
    },
  });
};

export const useDeleteChapter = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, documentId: _documentId }: { id: number; documentId: number }) => bidService.deleteChapter(id),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ['bid-chapters', documentId] });
      toast.success('章节已删除');
    },
  });
};

// 审批相关 Hooks
export const useApprovals = (documentId?: number) => {
  return useQuery({
    queryKey: ['bid-approvals', documentId],
    queryFn: () => bidService.getApprovals(documentId),
  });
};

export const useSubmitApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => bidService.submitApproval(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid-documents'] });
      queryClient.invalidateQueries({ queryKey: ['bid-approvals'] });
      toast.success('已提交审核');
    },
  });
};

export const useExecuteApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => 
      bidService.executeApproval(data),
    onSuccess: (_, { documentId }) => {
      queryClient.invalidateQueries({ queryKey: ['bid-document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['bid-approvals'] });
      toast.success('审批操作已完成');
    },
  });
};

// 统计相关 Hooks
export const useDocumentStats = (documentId: number) => {
  return useQuery({
    queryKey: ['bid-stats', 'document', documentId],
    queryFn: () => bidService.getStatistics({ documentId }),
    enabled: !!documentId,
  });
};

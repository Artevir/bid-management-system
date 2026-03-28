/**
 * 标书业务统一类型定义
 */

/** 标书文档状态 */
export type BidDocStatus = 'draft' | 'editing' | 'reviewing' | 'approved' | 'rejected' | 'published';

/** 章节类型 */
export type ChapterType = 'cover' | 'toc' | 'business' | 'technical' | 'qualification' | 'price' | 'appendix';

/** 审批级别 */
export type ApprovalLevel = 'first' | 'second' | 'third' | 'final';

/** 审批状态 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'returned';

/** 文档概览项 */
export interface DocumentOverview {
  id: number;
  name: string;
  status: BidDocStatus;
  version: number;
  progress: number;
  totalChapters: number;
  completedChapters: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  creatorName?: string;
}

/** 章节简要信息 */
export interface ChapterSummary {
  id: number;
  title: string;
  type: ChapterType | null;
  wordCount: number;
  isCompleted: boolean;
  isRequired: boolean;
}

/** 审批流简要信息 */
export interface ApprovalFlowSummary {
  id: number;
  level: ApprovalLevel;
  status: ApprovalStatus;
  assigneeId: number;
  assigneeName: string;
  assignedAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
}

/** 生成历史简要信息 */
export interface GenerationHistorySummary {
  id: number;
  generationConfig: string | null;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

/** 评审简要信息 */
export interface ReviewSummary {
  id: number;
  type: string;
  score: number | null;
  status: string;
  reviewedAt: Date | null;
  createdAt: Date;
}

/** 文档详情（聚合数据） */
export interface DocumentDetail extends DocumentOverview {
  projectId: number;
  currentApprovalLevel: ApprovalLevel | null;
  deadline: Date | null;
  publishedAt: Date | null;
  publishedBy: number | null;
  createdBy: number;
  chapters: ChapterSummary[];
  approvalFlows: ApprovalFlowSummary[];
  generationHistories: GenerationHistorySummary[];
  reviews: ReviewSummary[];
}

/** 章节树形结构 */
export interface ChapterTree {
  id: number;
  serialNumber: string | null;
  title: string;
  type: ChapterType | null;
  wordCount: number;
  level: number;
  version: number;
  isRequired: boolean;
  isCompleted: boolean;
  assignedTo: number | null;
  deadline: Date | null;
  children: ChapterTree[];
}

/** 创建文档参数 */
export interface CreateDocumentParams {
  projectId: number;
  name: string;
  templateId?: number;
  userId: number;
}

/** 创建章节参数 */
export interface CreateChapterParams {
  documentId: number;
  parentId?: number;
  type?: ChapterType;
  serialNumber?: string;
  title: string;
  content?: string;
  isRequired?: boolean;
  assignedTo?: number;
  deadline?: Date;
  responseItemId?: number;
}

/** 更新章节参数 */
export interface UpdateChapterParams {
  title?: string;
  content?: string;
  version?: number;
  isCompleted?: boolean;
  assignedTo?: number;
  deadline?: Date;
  promptTemplateId?: number | null;
  promptParameters?: string | null;
  companyId?: number | null;
  tags?: string | null;
}

/** 章节详细信息 */
export interface ChapterDetail extends ChapterSummary {
  documentId: number;
  parentId: number | null;
  serialNumber: string | null;
  content: string | null;
  version: number;
  level: number;
  assignedTo: number | null;
  deadline: Date | null;
  completedAt: Date | null;
  responseItemId: number | null;
  promptTemplateId: number | null;
  promptParameters: string | null;
  companyId: number | null;
  tags: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 审批详细信息 */
export interface ApprovalDetail extends ApprovalFlowSummary {
  documentId: number;
  documentName: string;
  comment: string | null;
  createdBy: number;
  updatedAt: Date;
}

/** 审批执行参数 */
export interface ApprovalExecutionParams {
  documentId: number;
  level: ApprovalLevel;
  action: 'approve' | 'reject' | 'return';
  comment?: string;
}

/** AI 生成配置参数 */
export interface AIConfig {
  templateId?: number;
  parameters?: Record<string, any>;
  companyId?: number;
  tags?: string[];
  useKnowledge?: boolean;
  stream?: boolean;
}

/** 标书文档统计信息 */
export interface DocumentStatistics {
  totalChapters: number;
  completedChapters: number;
  byType: Record<string, number>;
  byStatus: {
    completed: number;
    pending: number;
  };
}

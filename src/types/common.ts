/**
 * 统一类型定义
 * 用于替代 any 类型，提升类型安全
 */

// ============================================
// 基础类型
// ============================================

/** 通用更新数据类型 */
export type UpdateData<T> = Partial<T> & {
  updatedAt: Date;
};

/** 分页查询参数 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/** 分页查询结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

/** 排序参数 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 通用查询条件 */
export type WhereCondition<T> = {
  [K in keyof T]?: T[K] | { in: T[K][] } | { like: string } | { is: T[K] | null };
};

// ============================================
// 项目相关类型
// ============================================

import { ProjectStatus } from '@/types/project';

/** 项目更新数据 */
export interface ProjectUpdateInput {
  name?: string;
  code?: string;
  tenderCode?: string;
  type?: string;
  industry?: string;
  region?: string;
  status?: ProjectStatus;
  progress?: number;
  currentPhaseId?: number;
  tenderOrganization?: string;
  tenderAgent?: string;
  tenderMethod?: string;
  budget?: string;
  publishDate?: Date | null;
  registerDeadline?: Date | null;
  questionDeadline?: Date | null;
  submissionDeadline?: Date | null;
  openBidDate?: Date | null;
  description?: string;
  tags?: string[];
}

/** 项目查询条件 */
export interface ProjectWhereConditions {
  keyword?: string;
  status?: ProjectStatus[];
  industry?: string[];
  region?: string[];
  departmentId?: number;
  ownerId?: number;
  tags?: string[];
}

// ============================================
// 用户相关类型
// ============================================

/** 用户基础信息 */
export interface UserBasicInfo {
  id: number;
  username: string;
  email: string;
  realName: string;
  avatar?: string;
  departmentId: number;
  position?: string;
}

/** 用户更新数据 */
export interface UserUpdateInput {
  realName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  position?: string;
  departmentId?: number;
  status?: 'active' | 'inactive' | 'locked';
}

// ============================================
// 文档相关类型
// ============================================

/** 文档状态类型 */
export type BidDocStatus = 'draft' | 'editing' | 'reviewing' | 'approved' | 'rejected' | 'published';

/** 审批级别类型 */
export type ApprovalLevel = 'level_1' | 'level_2' | 'level_3';

/** 文档更新数据 */
export interface DocumentUpdateInput {
  name?: string;
  status?: BidDocStatus;
  progress?: number;
  currentApprovalLevel?: ApprovalLevel;
  deadline?: Date | null;
  totalChapters?: number;
  completedChapters?: number;
  wordCount?: number;
}

/** 章节数据 */
export interface ChapterData {
  id: number;
  documentId: number;
  parentId?: number;
  type?: 'cover' | 'toc' | 'business' | 'technical' | 'qualification' | 'price' | 'appendix';
  serialNumber?: string;
  title: string;
  content?: string;
  wordCount: number;
  sortOrder: number;
  level: number;
  isRequired: boolean;
  isCompleted: boolean;
  assignedTo?: number;
  deadline?: Date;
  completedAt?: Date;
  responseItemId?: number;
  promptTemplateId?: number;
  promptParameters?: string;
  companyId?: number;
  tags?: string;
}

// ============================================
// 公司相关类型
// ============================================

/** 公司基础信息 */
export interface CompanyBasicInfo {
  id: number;
  name: string;
  shortName?: string;
  code: string;
  creditCode: string;
  legalPerson?: string;
  isDefault: boolean;
}

/** 公司文件 */
export interface CompanyFileInfo {
  id: number;
  companyId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  expiryDate?: Date;
  status: 'active' | 'expired' | 'archived';
  uploadedBy: number;
  uploadedAt: Date;
}

// ============================================
// 解读/生成相关类型
// ============================================

/** 解读数据 */
export interface InterpretationData {
  id: number;
  projectId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timeNodes: TimeNodeInfo[];
  qualificationRequirements: QualificationRequirement[];
  submissionRequirements: SubmissionRequirement[];
  scoringItems: ScoringItemInfo[];
  feeInfo: FeeInfo;
}

/** 时间节点信息 */
export interface TimeNodeInfo {
  name: string;
  date: Date;
  type: 'registration' | 'question' | 'submission' | 'opening' | 'other';
}

/** 资质要求 */
export interface QualificationRequirement {
  type: string;
  description: string;
  isRequired: boolean;
  documentRequired?: boolean;
}

/** 提交要求 */
export interface SubmissionRequirement {
  type: string;
  description: string;
  quantity?: number;
  format?: string;
}

/** 评分项信息 */
export interface ScoringItemInfo {
  serialNumber: string;
  title: string;
  score: number;
  type: 'technical' | 'business' | 'price' | 'qualification';
  requirement: string;
}

/** 费用信息 */
export interface FeeInfo {
  budgetAmount?: number;
  guaranteeAmount?: number;
  bidBondAmount?: number;
  paymentMethod?: string;
}

// ============================================
// 生成相关类型
// ============================================

/** 生成上下文 */
export interface GenerationContext {
  chapterTitle: string;
  chapterType?: string;
  documentName: string;
  projectName: string;
  requirements?: string[];
  referenceContent?: string[];
}

/** 生成选项 */
export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxLength?: number;
  style?: 'formal' | 'technical' | 'concise';
}

/** 生成结果 */
export interface GenerationResult {
  content: string;
  wordCount: number;
  suggestions?: string[];
  references?: string[];
}

/** 友商材料 */
export interface PartnerMaterialInfo {
  id: number;
  partnerApplicationId: number;
  partnerCompanyName: string;
  materialType: string;
  materialName: string;
  content?: string;
  files?: CompanyFileInfo[];
}

// ============================================
// API 响应类型
// ============================================

/** API 成功响应 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/** API 错误响应 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/** API 响应 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// 审计日志类型
// ============================================

/** 审计日志输入 */
export interface AuditLogInput {
  userId?: number;
  username?: string;
  action: string;
  resource: string;
  resourceId?: number;
  resourceCode?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  requestParams?: string;
  responseStatus?: number;
  errorMessage?: string;
  duration?: number;
}

// ============================================
// 缓存相关类型
// ============================================

/** 缓存项 */
export interface CacheItem<T> {
  data: T;
  expireAt: number;
  createdAt: number;
}

/** 离线存储项 */
export interface OfflineStorageItem<T> {
  id: string;
  type: string;
  data: T;
  syncStatus: 'pending' | 'synced' | 'failed';
  updatedAt: number;
}

// ============================================
// 工作流相关类型
// ============================================

/** 工作流节点 */
export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

/** 工作流边 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

// ============================================
// 导出所有类型
// ============================================

// 类型已在上方定义并导出

/**
 * API 请求验证工具
 * 基于 Zod 的请求体验证中间件
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema, ZodError } from 'zod';
import { AppError, handleError } from './error-handler';

// ============================================
// 通用验证 Schema
// ============================================

/** ID 验证 */
export const idSchema = z.number().int().positive();

/** 分页参数验证 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

/** 排序参数验证 */
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/** 日期验证 */
export const dateSchema = z.string().datetime().or(z.date());

/** 非空字符串验证 */
export const nonEmptyString = z.string().min(1, '不能为空');

/** 邮箱验证 */
export const emailSchema = z.string().email('邮箱格式不正确');

/** 手机号验证 */
export const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');

/** 密码验证 */
export const passwordSchema = z
  .string()
  .min(8, '密码至少8位')
  .regex(/[a-zA-Z]/, '密码必须包含字母')
  .regex(/[0-9]/, '密码必须包含数字');

// ============================================
// 项目相关 Schema
// ============================================

/** 创建项目验证 */
export const createProjectSchema = z.object({
  name: z.string().min(2, '项目名称至少2个字符').max(200),
  code: z.string().min(2, '项目编号至少2个字符').max(50),
  tenderCode: z.string().max(100).optional(),
  type: z.string().max(50).optional(),
  industry: z.string().max(50).optional(),
  region: z.string().max(50).optional(),
  tenderOrganization: z.string().max(200).optional(),
  tenderAgent: z.string().max(200).optional(),
  tenderMethod: z.string().max(50).optional(),
  budget: z.string().max(100).optional(),
  publishDate: z.coerce.date().optional().nullable(),
  registerDeadline: z.coerce.date().optional().nullable(),
  questionDeadline: z.coerce.date().optional().nullable(),
  submissionDeadline: z.coerce.date().optional().nullable(),
  openBidDate: z.coerce.date().optional().nullable(),
  ownerId: z.number().int().positive('必须指定项目负责人'),
  departmentId: z.number().int().positive('必须指定所属部门'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/** 更新项目验证 */
export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum([
    'draft', 'parsing', 'preparing', 'reviewing',
    'approved', 'submitted', 'awarded', 'lost', 'archived'
  ]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

// ============================================
// 用户相关 Schema
// ============================================

/** 创建用户验证 */
export const createUserSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50)
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
  email: emailSchema,
  password: passwordSchema,
  realName: z.string().min(2, '姓名至少2个字符').max(50),
  phone: phoneSchema.optional(),
  departmentId: z.number().int().positive('必须指定所属部门'),
  position: z.string().max(50).optional(),
  roleIds: z.array(z.number().int().positive()).optional(),
});

/** 更新用户验证 */
export const updateUserSchema = z.object({
  realName: z.string().min(2).max(50).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  avatar: z.string().url().optional(),
  position: z.string().max(50).optional(),
  departmentId: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive', 'locked']).optional(),
});

/** 登录验证 */
export const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

/** 修改密码验证 */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '请输入原密码'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, '请确认新密码'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

// ============================================
// 文档相关 Schema
// ============================================

/** 创建文档验证 */
export const createDocumentSchema = z.object({
  projectId: z.number().int().positive('必须关联项目'),
  name: z.string().min(2, '文档名称至少2个字符').max(200),
  deadline: z.coerce.date().optional().nullable(),
});

/** 更新文档验证 */
export const updateDocumentSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  status: z.enum(['draft', 'editing', 'reviewing', 'approved', 'rejected', 'published']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  deadline: z.coerce.date().nullable().optional(),
});

/** 创建章节验证 */
export const createChapterSchema = z.object({
  documentId: z.number().int().positive('必须关联文档'),
  parentId: z.number().int().positive().optional().nullable(),
  type: z.enum(['cover', 'toc', 'business', 'technical', 'qualification', 'price', 'appendix']).optional(),
  serialNumber: z.string().max(20).optional(),
  title: z.string().min(1, '章节标题不能为空').max(300),
  content: z.string().optional(),
  sortOrder: z.number().int().default(0),
  isRequired: z.boolean().default(true),
  assignedTo: z.number().int().positive().optional(),
  deadline: z.coerce.date().optional().nullable(),
});

// ============================================
// 文件相关 Schema
// ============================================

/** 文件上传验证 */
export const fileUploadMetaSchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  securityLevel: z.enum(['public', 'internal', 'confidential', 'secret']).default('internal'),
  projectId: z.coerce.number().int().positive().optional(),
  fileType: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

// ============================================
// 公司相关 Schema
// ============================================

/** 创建公司验证 */
export const createCompanySchema = z.object({
  name: z.string().min(2, '公司名称至少2个字符').max(200),
  shortName: z.string().max(50).optional(),
  code: z.string().min(2, '公司编码至少2个字符').max(50),
  creditCode: z.string().length(18, '统一社会信用代码为18位'),
  legalPerson: z.string().max(50).optional(),
  registeredCapital: z.string().max(100).optional(),
  establishedDate: z.coerce.date().optional().nullable(),
  address: z.string().max(500).optional(),
  contactPerson: z.string().max(50).optional(),
  contactPhone: phoneSchema.optional(),
  contactEmail: emailSchema.optional(),
  businessScope: z.string().optional(),
  isDefault: z.boolean().default(false),
});

/** 更新公司验证 */
export const updateCompanySchema = createCompanySchema.partial();

// ============================================
// 验证中间件
// ============================================

/**
 * 验证请求体
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (request: NextRequest): Promise<T> => {
    try {
      const body = await request.json();
      return schema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw AppError.validationError('请求参数验证失败', formatZodErrors(error));
      }
      throw AppError.badRequest('请求体格式错误');
    }
  };
}

/**
 * 验证查询参数
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (request: NextRequest): T => {
    try {
      const { searchParams } = request.nextUrl;
      const query: Record<string, string | string[]> = {};
      
      searchParams.forEach((value, key) => {
        const existing = query[key];
        if (existing) {
          query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
        } else {
          query[key] = value;
        }
      });
      
      return schema.parse(query);
    } catch (error) {
      if (error instanceof ZodError) {
        throw AppError.validationError('查询参数验证失败', formatZodErrors(error));
      }
      throw AppError.badRequest('查询参数格式错误');
    }
  };
}

/**
 * 验证路径参数
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (params: Record<string, string>): T => {
    try {
      return schema.parse(params);
    } catch (error) {
      if (error instanceof ZodError) {
        throw AppError.validationError('路径参数验证失败', formatZodErrors(error));
      }
      throw AppError.badRequest('路径参数格式错误');
    }
  };
}

// ============================================
// 工具函数
// ============================================

/**
 * 格式化 Zod 错误
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!result[path]) {
      result[path] = [];
    }
    result[path].push(err.message);
  });
  
  return result;
}

/**
 * 组合多个验证器
 */
export function composeValidators<T extends Record<string, unknown>>(
  validators: Record<keyof T, ZodSchema<T[keyof T]>>
) {
  return z.object(validators);
}

// ============================================
// 导出
// ============================================

export type { ZodSchema };

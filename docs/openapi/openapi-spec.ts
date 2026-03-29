/**
 * API 文档自动生成
 * 使用 OpenAPI/Swagger 规范生成 API 文档
 */

import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// ============================================
// 扩展 Zod 以支持 OpenAPI
// ============================================

extendZodWithOpenApi(z);

// ============================================
// 创建注册表
// ============================================

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT 认证令牌',
});

// ============================================
// 定义通用 Schema
// ============================================

// 成功响应
registry.register('SuccessResponse', z.object({
  success: z.boolean().openapi({
    example: true,
    description: '请求是否成功',
  }),
  data: z.any().openapi({
    description: '响应数据',
  }),
  message: z.string().optional().openapi({
    example: '操作成功',
    description: '响应消息',
  }),
}));

// 错误响应
registry.register('ErrorResponse', z.object({
  success: z.boolean().openapi({
    example: false,
    description: '请求是否成功',
  }),
  error: z.string().openapi({
    example: '请求失败',
    description: '错误消息',
  }),
  code: z.string().optional().openapi({
    example: 'INVALID_PARAMS',
    description: '错误代码',
  }),
}));

// 分页参数
registry.register('PaginationParams', z.object({
  page: z.number().int().min(1).default(1).openapi({
    example: 1,
    description: '页码',
  }),
  pageSize: z.number().int().min(1).max(100).default(20).openapi({
    example: 20,
    description: '每页数量',
  }),
}));

// 分页响应
registry.register('PaginatedResponse', z.object({
  success: z.boolean(),
  data: z.object({
    items: z.array(z.any()),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  }),
}));

// ============================================
// 生成 OpenAPI 文档
// ============================================

export function generateOpenAPIDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.0',
    info: {
      title: '投标管理平台 API',
      version: '1.0.0',
      description: '企业级投标全流程管理系统的 API 文档',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: '开发环境',
      },
      {
        url: 'https://api.example.com',
        description: '生产环境',
      },
    ],
    security: [
      {
        BearerAuth: [],
      },
    ],
    tags: [
      {
        name: '认证',
        description: '用户认证相关接口',
      },
      {
        name: '项目',
        description: '项目管理相关接口',
      },
      {
        name: '文档',
        description: '文档管理相关接口',
      },
      {
        name: '审核',
        description: '审核流程相关接口',
      },
      {
        name: '搜索',
        description: '全文搜索相关接口',
      },
      {
        name: '导入导出',
        description: '数据导入导出接口',
      },
      {
        name: '批量操作',
        description: '批量操作接口',
      },
      {
        name: '报表',
        description: '报表统计接口',
      },
      {
        name: '预警',
        description: '预警提醒接口',
      },
      {
        name: '系统管理',
        description: '系统管理接口',
      },
    ],
  });
}
// ============================================
// API 路径注册示例
// ============================================

// 注册项目相关 API
export const projectPaths = {
  '/api/projects': {
    get: {
      tags: ['项目'],
      summary: '获取项目列表',
      description: '分页获取项目列表，支持筛选和排序',
      parameters: [
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 1 },
        },
        {
          name: 'pageSize',
          in: 'query',
          required: false,
          schema: { type: 'integer', default: 20 },
        },
        {
          name: 'status',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: '成功',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PaginatedResponse',
              },
            },
          },
        },
      },
    },
    post: {
      tags: ['项目'],
      summary: '创建新项目',
      description: '创建一个新的投标项目',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '项目名称' },
                description: { type: 'string', description: '项目描述' },
                status: { type: 'string', enum: ['draft', 'active', 'completed'] },
                companyId: { type: 'string', description: '公司ID' },
              },
              required: ['name', 'companyId'],
            },
          },
        },
      },
      responses: {
        200: {
          description: '创建成功',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SuccessResponse',
              },
            },
          },
        },
      },
    },
  },
  '/api/projects/{id}': {
    get: {
      tags: ['项目'],
      summary: '获取项目详情',
      description: '根据ID获取项目详细信息',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: '成功',
        },
        404: {
          description: '项目不存在',
        },
      },
    },
    patch: {
      tags: ['项目'],
      summary: '更新项目',
      description: '更新项目信息',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: '更新成功',
        },
      },
    },
    delete: {
      tags: ['项目'],
      summary: '删除项目',
      description: '删除指定项目',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: '删除成功',
        },
      },
    },
  },
};

// ============================================
// 导出
// ============================================

export default {
  registry,
  generateOpenAPIDocument,
  projectPaths,
};

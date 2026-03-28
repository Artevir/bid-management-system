/**
 * API文档生成器
 * 基于路由自动生成OpenAPI规范
 */

import { NextResponse } from 'next/server';

// ============================================
// OpenAPI规范类型
// ============================================

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, PathItem>;
  components: {
    schemas: Record<string, Schema>;
    responses: Record<string, Response>;
    parameters: Record<string, Parameter>;
    securitySchemes?: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
}

export interface Operation {
  tags: string[];
  summary: string;
  description?: string;
  operationId: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: SecurityRequirement[];
}

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: Schema;
  example?: any;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema: Schema;
  example?: any;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

export interface Schema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: string[];
  example?: any;
  $ref?: string;
  default?: any;
}

export interface SecurityRequirement {
  [key: string]: string[];
}

// ============================================
// API端点定义
// ============================================

export interface ApiEndpoint {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  summary: string;
  description?: string;
  tags: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<number, Response>;
}

// ============================================
// API文档配置
// ============================================

const API_CONFIG = {
  title: '投标管理平台API',
  version: '1.0.0',
  description: '企业级投标全流程管理系统API文档',
  servers: [
    {
      url: 'http://localhost:5000',
      description: '开发环境',
    },
    {
      url: 'https://abc123.dev.coze.site',
      description: '生产环境',
    },
  ],
  tags: [
    { name: '认证', description: '用户认证相关接口' },
    { name: '项目', description: '项目管理相关接口' },
    { name: '文档', description: '文档管理相关接口' },
    { name: '审批', description: '审批流程相关接口' },
    { name: '公司', description: '公司管理相关接口' },
    { name: '政采', description: '政采对接相关接口' },
  ],
};

// ============================================
// API端点列表
// ============================================

export const API_ENDPOINTS: ApiEndpoint[] = [
  // 认证相关
  {
    path: '/api/auth/login',
    method: 'post',
    summary: '用户登录',
    description: '用户使用用户名和密码登录系统',
    tags: ['认证'],
    requestBody: {
      description: '登录信息',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              username: { type: 'string', description: '用户名' },
              password: { type: 'string', description: '密码' },
            },
            required: ['username', 'password'],
          },
          example: {
            username: 'admin',
            password: 'password123',
          },
        },
      },
    },
    responses: {
      200: {
        description: '登录成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', description: '访问令牌' },
                    refreshToken: { type: 'string', description: '刷新令牌' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        username: { type: 'string' },
                        realName: { type: 'string' },
                        email: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: {
        description: '认证失败',
      },
    },
  },
  {
    path: '/api/auth/logout',
    method: 'post',
    summary: '用户登出',
    description: '用户登出系统',
    tags: ['认证'],
    responses: {
      200: {
        description: '登出成功',
      },
    },
  },
  {
    path: '/api/auth/me',
    method: 'get',
    summary: '获取当前用户信息',
    description: '获取当前登录用户的详细信息',
    tags: ['认证'],
    responses: {
      200: {
        description: '获取成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    username: { type: 'string' },
                    realName: { type: 'string' },
                    email: { type: 'string' },
                    departmentId: { type: 'integer' },
                    roles: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' },
                          code: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  // 文档相关
  {
    path: '/api/bid/documents',
    method: 'get',
    summary: '获取项目的标书文档列表',
    description: '根据项目ID获取该项目的所有标书文档',
    tags: ['文档'],
    parameters: [
      {
        name: 'projectId',
        in: 'query',
        description: '项目ID',
        required: true,
        schema: { type: 'integer' },
      },
    ],
    responses: {
      200: {
        description: '获取成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    documents: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          projectId: { type: 'integer' },
                          name: { type: 'string' },
                          version: { type: 'string' },
                          status: {
                            type: 'string',
                            enum: ['draft', 'editing', 'reviewing', 'approved', 'rejected', 'published'],
                          },
                          totalChapters: { type: 'integer' },
                          completedChapters: { type: 'integer' },
                          wordCount: { type: 'integer' },
                          progress: { type: 'integer' },
                          createdAt: { type: 'string', format: 'date-time' },
                          updatedAt: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: '缺少项目ID',
      },
      500: {
        description: '服务器错误',
      },
    },
  },
  {
    path: '/api/bid/documents',
    method: 'post',
    summary: '创建标书文档',
    description: '为项目创建新的标书文档',
    tags: ['文档'],
    requestBody: {
      description: '文档信息',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              projectId: { type: 'integer', description: '项目ID' },
              name: { type: 'string', description: '文档名称' },
              templateId: { type: 'integer', description: '模板ID（可选）' },
            },
            required: ['projectId', 'name'],
          },
          example: {
            projectId: 1,
            name: '技术标书',
            templateId: 1,
          },
        },
      },
    },
    responses: {
      201: {
        description: '创建成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    documentId: { type: 'integer' },
                  },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      400: {
        description: '缺少必填字段',
      },
    },
  },
  {
    path: '/api/bid/documents/{id}',
    method: 'get',
    summary: '获取文档详情',
    description: '根据文档ID获取文档的详细信息',
    tags: ['文档'],
    parameters: [
      {
        name: 'id',
        in: 'path',
        description: '文档ID',
        required: true,
        schema: { type: 'integer' },
      },
    ],
    responses: {
      200: {
        description: '获取成功',
      },
      404: {
        description: '文档不存在',
      },
    },
  },
  {
    path: '/api/bid/documents/{id}',
    method: 'put',
    summary: '更新文档',
    description: '更新文档信息',
    tags: ['文档'],
    parameters: [
      {
        name: 'id',
        in: 'path',
        description: '文档ID',
        required: true,
        schema: { type: 'integer' },
      },
    ],
    requestBody: {
      description: '文档信息',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: {
                type: 'string',
                enum: ['draft', 'editing', 'reviewing', 'approved', 'rejected', 'published'],
              },
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
  {
    path: '/api/bid/documents/{id}',
    method: 'delete',
    summary: '删除文档',
    description: '删除指定文档',
    tags: ['文档'],
    parameters: [
      {
        name: 'id',
        in: 'path',
        description: '文档ID',
        required: true,
        schema: { type: 'integer' },
      },
    ],
    responses: {
      200: {
        description: '删除成功',
      },
    },
  },

  // 文档审批
  {
    path: '/api/bid/documents/approval',
    method: 'get',
    summary: '获取文档审批流程',
    description: '获取文档的审批流程列表',
    tags: ['文档', '审批'],
    parameters: [
      {
        name: 'documentId',
        in: 'query',
        description: '文档ID',
        required: true,
        schema: { type: 'integer' },
      },
      {
        name: 'status',
        in: 'query',
        description: '审批状态',
        schema: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected'],
        },
      },
    ],
    responses: {
      200: {
        description: '获取成功',
      },
    },
  },
  {
    path: '/api/bid/documents/approval',
    method: 'post',
    summary: '创建审批流程',
    description: '为文档创建审批流程',
    tags: ['文档', '审批'],
    requestBody: {
      description: '审批流程信息',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              documentId: { type: 'integer' },
              level: { type: 'integer', description: '审批级别' },
              assigneeId: { type: 'integer', description: '审批人ID' },
              dueDate: { type: 'string', format: 'date-time', description: '截止日期' },
              comment: { type: 'string', description: '备注' },
            },
            required: ['documentId', 'level', 'assigneeId'],
          },
        },
      },
    },
    responses: {
      201: {
        description: '创建成功',
      },
    },
  },

  // 文档统计
  {
    path: '/api/bid/documents/statistics',
    method: 'get',
    summary: '获取文档统计信息',
    description: '获取文档的详细统计信息',
    tags: ['文档'],
    parameters: [
      {
        name: 'documentId',
        in: 'query',
        description: '文档ID（与projectId二选一）',
        schema: { type: 'integer' },
      },
      {
        name: 'projectId',
        in: 'query',
        description: '项目ID（与documentId二选一）',
        schema: { type: 'integer' },
      },
    ],
    responses: {
      200: {
        description: '获取成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    document: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        status: { type: 'string' },
                        version: { type: 'string' },
                        progress: { type: 'integer' },
                      },
                    },
                    chapters: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        completed: { type: 'integer' },
                        totalWords: { type: 'integer' },
                      },
                    },
                    generations: {
                      type: 'object',
                      properties: {
                        count: { type: 'integer' },
                      },
                    },
                    reviews: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        pending: { type: 'integer' },
                        completed: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  // 文档签章
  {
    path: '/api/bid/documents/seal',
    method: 'get',
    summary: '获取文档签章申请',
    description: '获取文档关联的签章申请列表',
    tags: ['文档'],
    parameters: [
      {
        name: 'documentId',
        in: 'query',
        description: '文档ID',
        required: true,
        schema: { type: 'integer' },
      },
    ],
    responses: {
      200: {
        description: '获取成功',
      },
    },
  },
  {
    path: '/api/bid/documents/seal',
    method: 'post',
    summary: '创建签章申请',
    description: '为文档创建签章申请',
    tags: ['文档'],
    requestBody: {
      description: '签章申请信息',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              documentId: { type: 'integer' },
              projectId: { type: 'integer' },
              sealMethod: {
                type: 'string',
                enum: ['our_company', 'partner_company'],
                description: '盖章方式：our_company-本公司盖章，partner_company-对方来盖章',
              },
              printCopies: { type: 'integer', description: '打印份数', default: 5 },
              requiredBy: { type: 'string', format: 'date-time', description: '要求时间' },
              partnerCompanyId: { type: 'integer', description: '友司ID' },
              partnerContactId: { type: 'integer', description: '友司联系人ID' },
              remarks: { type: 'string', description: '备注' },
            },
            required: ['documentId', 'projectId', 'sealMethod'],
          },
        },
      },
    },
    responses: {
      201: {
        description: '创建成功',
      },
    },
  },

  // 文档解读
  {
    path: '/api/bid/documents/interpretations',
    method: 'get',
    summary: '获取文档解读列表',
    description: '获取文档关联的解读列表',
    tags: ['文档'],
    parameters: [
      {
        name: 'documentId',
        in: 'query',
        description: '文档ID',
        required: true,
        schema: { type: 'integer' },
      },
    ],
    responses: {
      200: {
        description: '获取成功',
      },
    },
  },
  {
    path: '/api/bid/documents/interpretations',
    method: 'post',
    summary: '关联文档解读',
    description: '为文档关联解读',
    tags: ['文档'],
    requestBody: {
      description: '关联信息',
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              documentId: { type: 'integer' },
              interpretationId: { type: 'integer' },
            },
            required: ['documentId', 'interpretationId'],
          },
        },
      },
    },
    responses: {
      200: {
        description: '关联成功',
      },
    },
  },
];

// ============================================
// 生成OpenAPI规范
// ============================================

export function generateOpenAPISpec(): OpenAPISpec {
  const spec: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: API_CONFIG.title,
      version: API_CONFIG.version,
      description: API_CONFIG.description,
    },
    servers: API_CONFIG.servers,
    tags: API_CONFIG.tags,
    paths: {},
    components: {
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
            path: { type: 'string' },
          },
        },
      },
      responses: {
        Success: {
          description: '操作成功',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' },
            },
          },
        },
        Error: {
          description: '操作失败',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
      parameters: {
        DocumentId: {
          name: 'documentId',
          in: 'query',
          description: '文档ID',
          required: true,
          schema: { type: 'integer' },
        },
        ProjectId: {
          name: 'projectId',
          in: 'query',
          description: '项目ID',
          required: true,
          schema: { type: 'integer' },
        },
      },
    },
  };

  // 构建路径
  for (const endpoint of API_ENDPOINTS) {
    const path = endpoint.path;
    if (!spec.paths[path]) {
      spec.paths[path] = {};
    }

    spec.paths[path][endpoint.method] = {
      tags: endpoint.tags,
      summary: endpoint.summary,
      description: endpoint.description,
      operationId: `${endpoint.method}_${path.replace(/\//g, '_').replace(/_/g, '')}`,
      parameters: endpoint.parameters,
      requestBody: endpoint.requestBody,
      responses: endpoint.responses,
      security: [{ BearerAuth: [] }],
    };
  }

  // 添加安全方案
  spec.components.securitySchemes = {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  };

  return spec;
}

// ============================================
// 导出JSON格式
// ============================================

export function getOpenAPIJSON(): string {
  return JSON.stringify(generateOpenAPISpec(), null, 2);
}

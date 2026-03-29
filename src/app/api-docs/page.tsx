/**
 * API文档页面
 * 提供交互式的API文档查看
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Book,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  FileText,
  Users,
  Building2,
  Gavel as _Gavel,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

// API端点类型
interface ApiEndpoint {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  summary: string;
  description?: string;
  tags: string[];
  parameters?: any[];
  requestBody?: any;
  responses: Record<number, any>;
}

// 方法图标和颜色
const METHOD_CONFIG = {
  get: { icon: 'GET', color: 'bg-green-100 text-green-800 border-green-300' },
  post: { icon: 'POST', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  put: { icon: 'PUT', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  delete: { icon: 'DELETE', color: 'bg-red-100 text-red-800 border-red-300' },
  patch: { icon: 'PATCH', color: 'bg-purple-100 text-purple-800 border-purple-300' },
};

// 标签图标
const TAG_ICONS: Record<string, any> = {
  '认证': Shield,
  '项目': FileText,
  '文档': FileText,
  '审批': CheckCircle,
  '公司': Building2,
  '政采': Users,
};

// 模拟API数据（实际应该从后端获取）
const MOCK_API_ENDPOINTS: ApiEndpoint[] = [
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
    },
  },
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
                          status: { type: 'string' },
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
    },
  },
];

export default function ApiDocsPage() {
  const [endpoints, _setEndpoints] = useState<ApiEndpoint[]>(MOCK_API_ENDPOINTS);
  const [filteredEndpoints, setFilteredEndpoints] = useState<ApiEndpoint[]>(MOCK_API_ENDPOINTS);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');

  // 获取所有标签
  const allTags = Array.from(new Set(endpoints.flatMap((e) => e.tags)));

  // 获取所有方法
  const allMethods = Array.from(new Set(endpoints.map((e) => e.method)));

  // 过滤API
  useEffect(() => {
    let filtered = endpoints;

    if (searchKeyword) {
      filtered = filtered.filter(
        (e) =>
          e.summary.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          e.path.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          e.description?.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }

    if (selectedTag !== 'all') {
      filtered = filtered.filter((e) => e.tags.includes(selectedTag));
    }

    if (selectedMethod !== 'all') {
      filtered = filtered.filter((e) => e.method === selectedMethod);
    }

    setFilteredEndpoints(filtered);
  }, [searchKeyword, selectedTag, selectedMethod, endpoints]);

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  // 格式化JSON
  const formatJSON = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  // 渲染方法徽章
  const renderMethodBadge = (method: string) => {
    const config = METHOD_CONFIG[method as keyof typeof METHOD_CONFIG];
    return (
      <Badge className={config.color} variant="outline">
        {config.icon}
      </Badge>
    );
  };

  // 渲染标签图标
  const renderTagIcon = (tag: string) => {
    const Icon = TAG_ICONS[tag] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Book className="h-6 w-6" />
            API 文档
          </h1>
          <p className="text-muted-foreground">投标管理平台 API 接口文档</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => copyToClipboard(JSON.stringify(endpoints, null, 2))}
          >
            <Copy className="h-4 w-4 mr-2" />
            复制所有API
          </Button>
          <Button
            onClick={() => {
              const blob = new Blob([JSON.stringify(endpoints, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'api-docs.json';
              a.click();
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            导出JSON
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总API数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{endpoints.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              API模块
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allTags.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              GET请求
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {endpoints.filter((e) => e.method === 'get').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              POST请求
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {endpoints.filter((e) => e.method === 'post').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索API名称、路径或描述..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择模块" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部模块</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    <div className="flex items-center gap-2">
                      {renderTagIcon(tag)}
                      {tag}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMethod} onValueChange={setSelectedMethod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择方法" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部方法</SelectItem>
                {allMethods.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* API列表 */}
      <Card>
        <CardHeader>
          <CardTitle>API 列表 ({filteredEndpoints.length})</CardTitle>
          <CardDescription>
            {filteredEndpoints.length === 0
              ? '没有找到匹配的API'
              : `显示 ${filteredEndpoints.length} 个API`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEndpoints.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>没有找到匹配的API</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {filteredEndpoints.map((endpoint, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 text-left">
                      {renderMethodBadge(endpoint.method)}
                      <div className="flex-1">
                        <div className="font-medium">{endpoint.summary}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {endpoint.path}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {endpoint.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      {/* 描述 */}
                      {endpoint.description && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">描述</h4>
                          <p className="text-sm text-muted-foreground">
                            {endpoint.description}
                          </p>
                        </div>
                      )}

                      {/* 路径 */}
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          路径
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(endpoint.path)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </h4>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {endpoint.method.toUpperCase()} {endpoint.path}
                        </code>
                      </div>

                      {/* 参数 */}
                      {endpoint.parameters && endpoint.parameters.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">请求参数</h4>
                          <ScrollArea className="h-40 rounded-md border">
                            <div className="p-4">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2">参数名</th>
                                    <th className="text-left py-2">位置</th>
                                    <th className="text-left py-2">类型</th>
                                    <th className="text-left py-2">必填</th>
                                    <th className="text-left py-2">描述</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {endpoint.parameters.map((param, idx) => (
                                    <tr key={idx} className="border-b">
                                      <td className="py-2 font-mono">{param.name}</td>
                                      <td className="py-2">
                                        <Badge variant="outline">{param.in}</Badge>
                                      </td>
                                      <td className="py-2">
                                        <Badge variant="secondary">
                                          {param.schema?.type}
                                        </Badge>
                                      </td>
                                      <td className="py-2">
                                        {param.required ? (
                                          <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-gray-400" />
                                        )}
                                      </td>
                                      <td className="py-2 text-muted-foreground">
                                        {param.description}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      {/* 请求体 */}
                      {endpoint.requestBody && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">请求体</h4>
                          {endpoint.requestBody.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {endpoint.requestBody.description}
                            </p>
                          )}
                          <Tabs defaultValue="schema">
                            <TabsList>
                              <TabsTrigger value="schema">Schema</TabsTrigger>
                              <TabsTrigger value="example">Example</TabsTrigger>
                            </TabsList>
                            <TabsContent value="schema">
                              <ScrollArea className="h-40 rounded-md border">
                                <pre className="p-4 text-xs">
                                  {formatJSON(endpoint.requestBody.content['application/json'].schema)}
                                </pre>
                              </ScrollArea>
                            </TabsContent>
                            <TabsContent value="example">
                              <ScrollArea className="h-40 rounded-md border">
                                <pre className="p-4 text-xs">
                                  {formatJSON(
                                    endpoint.requestBody.content['application/json'].example
                                  )}
                                </pre>
                              </ScrollArea>
                            </TabsContent>
                          </Tabs>
                        </div>
                      )}

                      {/* 响应 */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">响应</h4>
                        <Tabs defaultValue="200">
                          <TabsList>
                            {Object.keys(endpoint.responses).map((status) => (
                              <TabsTrigger key={status} value={status}>
                                {status}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          {Object.entries(endpoint.responses).map(([status, response]) => (
                            <TabsContent key={status} value={status}>
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  {response.description}
                                </p>
                                {response.content?.['application/json'] && (
                                  <ScrollArea className="h-40 rounded-md border">
                                    <pre className="p-4 text-xs">
                                      {formatJSON(response.content['application/json'].schema)}
                                    </pre>
                                  </ScrollArea>
                                )}
                              </div>
                            </TabsContent>
                          ))}
                        </Tabs>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

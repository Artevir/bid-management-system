# 方案功能模块文档

> 版本：1.0.0  
> 更新日期：2026-03-18

## 目录

- [概述](#概述)
- [功能特性](#功能特性)
- [技术架构](#技术架构)
- [数据库设计](#数据库设计)
- [API接口](#api接口)
- [前端页面](#前端页面)
- [使用指南](#使用指南)
- [配置说明](#配置说明)
- [最佳实践](#最佳实践)

---

## 概述

方案功能模块是投标管理平台的核心AI能力模块，提供提示词模板管理、参数化配置、方案生成等功能。通过与多种大语言模型（LLM）的深度集成，支持快速生成投标方案、技术文档等内容。

### 核心能力

- **提示词模板管理**：支持创建、编辑、版本控制的提示词模板
- **参数化配置**：通过 `{{param_name}}` 语法定义可变参数
- **多模型支持**：集成豆包、DeepSeek、千问、文心一言、讯飞星火等多种LLM
- **流式输出**：支持SSE协议的实时内容生成
- **角色化配置**：支持按角色配置模板权限

---

## 功能特性

### 1. 提示词分类管理

支持多级分类体系，便于组织和管理大量提示词模板。

**功能点：**
- 树形分类结构展示
- 分类创建/编辑/删除
- 支持分类类型（通用/投标/技术/商务）
- 分类排序和图标配置

**访问路径：** `/prompts/categories`

### 2. 提示词模板管理

核心功能模块，管理所有提示词模板。

**功能点：**
- 模板列表展示（支持搜索、筛选、分页）
- 模板创建/编辑对话框
- 参数占位符语法支持
- 系统提示词配置
- 模型配置（提供商、模型名称、温度、最大令牌）
- 模板预览功能
- 版本历史管理
- 模板复制功能

**访问路径：** `/prompts/templates`

### 3. 方案生成

基于模板和参数生成方案内容。

**功能点：**
- 模板选择和参数填充
- 高级模型配置覆盖
- SSE流式实时输出
- 生成结果复制和下载
- 提示词预览

**访问路径：** `/prompts/generate`

---

## 技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端层 (React)                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ 模板管理页面 │  │ 分类管理页面 │  │   方案生成页面       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      API层 (Next.js)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ 分类API     │  │ 模板API     │  │   方案生成API       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     LLM适配层                                │
├─────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ 豆包   │ │ DeepSeek │ │ 千问   │ │ 文心   │ │ 星火   │  │
│  └────────┘ └──────────┘ └────────┘ └────────┘ └────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    数据层 (PostgreSQL)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ prompt_categories │ prompt_templates │ prompt_parameters │
│  │ prompt_versions │ prompt_role_mappings │ scheme_generations │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | Next.js 15.1.3 + React 19 |
| 语言 | TypeScript 5 |
| UI组件 | shadcn/ui + Tailwind CSS 4 |
| 状态管理 | React Hooks |
| 后端框架 | Next.js API Routes |
| ORM | Drizzle ORM |
| 数据库 | PostgreSQL |
| 流式传输 | SSE (Server-Sent Events) |

---

## 数据库设计

### ER图

```
┌───────────────────┐
│ prompt_categories │
├───────────────────┤     ┌───────────────────┐
│ id (PK)           │────→│ prompt_templates  │
│ name              │     ├───────────────────┤
│ code              │     │ id (PK)           │
│ type              │     │ category_id (FK)  │
│ parent_id (FK)    │     │ name              │
│ sort_order        │     │ code              │
└───────────────────┘     │ content           │
                          │ system_prompt     │
                          │ model_provider    │
                          │ status            │
                          │ created_by (FK)   │──┐
                          └───────────────────┘  │
                                   │             │
                                   ↓             │
                          ┌───────────────────┐  │
                          │ prompt_parameters │  │
                          ├───────────────────┤  │
                          │ id (PK)           │  │
                          │ template_id (FK)  │──┘
                          │ name              │
                          │ code              │
                          │ type              │
                          │ default_value     │
                          │ required          │
                          └───────────────────┘
```

### 表结构说明

#### prompt_categories（提示词分类表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | SERIAL | 主键 |
| name | VARCHAR(255) | 分类名称 |
| code | VARCHAR(100) | 唯一标识码 |
| type | VARCHAR(50) | 分类类型：general/bid/technical/business |
| description | TEXT | 描述 |
| icon | VARCHAR(255) | 图标 |
| parent_id | INTEGER | 父级分类ID |
| sort_order | INTEGER | 排序序号 |
| is_active | BOOLEAN | 是否启用 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### prompt_templates（提示词模板表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | SERIAL | 主键 |
| name | VARCHAR(255) | 模板名称 |
| code | VARCHAR(100) | 唯一标识码 |
| description | TEXT | 描述 |
| category_id | INTEGER | 分类ID |
| content | TEXT | 提示词内容（支持参数占位符） |
| system_prompt | TEXT | 系统提示词 |
| model_provider | VARCHAR(50) | 模型提供商 |
| model_name | VARCHAR(100) | 模型名称 |
| temperature | VARCHAR(10) | 温度参数 |
| max_tokens | INTEGER | 最大生成Token数 |
| output_format | VARCHAR(50) | 输出格式：markdown/html/plain |
| current_version | INTEGER | 当前版本号 |
| status | VARCHAR(20) | 状态：draft/published/archived |
| is_system | BOOLEAN | 是否系统内置 |
| is_active | BOOLEAN | 是否启用 |
| use_count | INTEGER | 使用次数 |
| created_by | INTEGER | 创建者ID |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### prompt_parameters（模板参数表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | SERIAL | 主键 |
| template_id | INTEGER | 模板ID |
| name | VARCHAR(255) | 参数名称 |
| code | VARCHAR(100) | 参数代码 |
| type | VARCHAR(50) | 参数类型：text/textarea/number/select |
| default_value | TEXT | 默认值 |
| description | TEXT | 参数说明 |
| required | BOOLEAN | 是否必填 |
| sort_order | INTEGER | 排序序号 |
| created_at | TIMESTAMP | 创建时间 |

#### prompt_versions（版本历史表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | SERIAL | 主键 |
| template_id | INTEGER | 模板ID |
| version | INTEGER | 版本号 |
| content | TEXT | 提示词内容 |
| system_prompt | TEXT | 系统提示词 |
| change_description | TEXT | 变更说明 |
| author_id | INTEGER | 作者ID |
| created_at | TIMESTAMP | 创建时间 |

#### prompt_role_mappings（角色映射表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | SERIAL | 主键 |
| template_id | INTEGER | 模板ID |
| role_id | INTEGER | 角色ID |
| created_at | TIMESTAMP | 创建时间 |

#### scheme_generations（方案生成记录表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | SERIAL | 主键 |
| template_id | INTEGER | 模板ID |
| project_id | INTEGER | 项目ID |
| content | TEXT | 生成内容 |
| parameters | JSONB | 使用的参数 |
| tokens_used | INTEGER | 消耗Token数 |
| model_provider | VARCHAR(50) | 使用的模型提供商 |
| model_name | VARCHAR(100) | 使用的模型名称 |
| created_by | INTEGER | 创建者ID |
| created_at | TIMESTAMP | 创建时间 |

---

## API接口

### 基础路径

所有API均以 `/api/prompts` 为前缀。

### 分类接口

#### GET /api/prompts/categories

获取分类列表。

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 否 | 分类类型筛选 |
| keyword | string | 否 | 关键词搜索 |
| tree | boolean | 否 | 是否返回树形结构 |

**响应示例：**

```json
{
  "items": [
    {
      "id": 1,
      "name": "投标方案",
      "code": "bid_proposal",
      "type": "bid",
      "description": "投标方案相关提示词模板",
      "parentId": null,
      "sortOrder": 1,
      "isActive": true,
      "children": []
    }
  ]
}
```

#### POST /api/prompts/categories

创建分类。

**请求体：**

```json
{
  "name": "投标方案",
  "code": "bid_proposal",
  "type": "bid",
  "description": "投标方案相关提示词模板",
  "parentId": null,
  "sortOrder": 1
}
```

### 模板接口

#### GET /api/prompts/templates

获取模板列表。

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| categoryId | number | 否 | 分类ID筛选 |
| status | string | 否 | 状态筛选 |
| keyword | string | 否 | 关键词搜索 |
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认20 |

**响应示例：**

```json
{
  "items": [
    {
      "id": 1,
      "name": "技术方案生成模板",
      "code": "tech_proposal",
      "description": "用于生成技术方案的提示词模板",
      "categoryId": 1,
      "category": {
        "id": 1,
        "name": "投标方案"
      },
      "content": "请根据以下信息生成技术方案：\n项目名称：{{project_name}}\n项目背景：{{project_background}}",
      "systemPrompt": "你是一位专业的技术方案撰写专家...",
      "modelProvider": "doubao",
      "modelName": "doubao-pro-32k",
      "temperature": "0.7",
      "maxTokens": 4096,
      "status": "published",
      "version": 1,
      "parameters": [
        {
          "id": 1,
          "name": "项目名称",
          "code": "project_name",
          "type": "text",
          "required": true
        },
        {
          "id": 2,
          "name": "项目背景",
          "code": "project_background",
          "type": "textarea",
          "required": true
        }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

#### POST /api/prompts/templates

创建模板。

**请求体：**

```json
{
  "name": "技术方案生成模板",
  "code": "tech_proposal",
  "description": "用于生成技术方案的提示词模板",
  "categoryId": 1,
  "content": "请根据以下信息生成技术方案：\n项目名称：{{project_name}}\n项目背景：{{project_background}}",
  "systemPrompt": "你是一位专业的技术方案撰写专家...",
  "modelProvider": "doubao",
  "modelName": "doubao-pro-32k",
  "temperature": "0.7",
  "maxTokens": 4096
}
```

#### GET /api/prompts/templates/[id]

获取模板详情。

#### PUT /api/prompts/templates/[id]

更新模板。

#### DELETE /api/prompts/templates/[id]

删除模板（系统内置模板不可删除）。

### 方案生成接口

#### POST /api/prompts/generate

生成方案内容。

**请求体：**

```json
{
  "templateId": 1,
  "projectId": 123,
  "parameters": {
    "project_name": "智慧城市建设项目",
    "project_background": "本项目旨在..."
  },
  "modelProvider": "doubao",
  "modelName": "doubao-pro-32k",
  "temperature": "0.7",
  "maxTokens": 4096,
  "stream": true
}
```

**流式响应格式（SSE）：**

```
data: {"type": "content", "content": "## 技术方案\n\n"}

data: {"type": "content", "content": "### 一、项目概述\n\n"}

data: {"type": "content", "content": "本项目..."}

data: {"type": "done", "usage": {"promptTokens": 256, "completionTokens": 1024, "totalTokens": 1280}}
```

**错误响应：**

```
data: {"type": "error", "error": "模板不存在"}
```

---

## 前端页面

### 页面结构

```
/prompts
├── /templates     # 提示词模板管理
├── /categories    # 分类管理
└── /generate      # 方案生成
```

### 组件说明

#### 模板管理页面 (`src/app/prompts/templates/page.tsx`)

**主要组件：**
- `TemplateTable` - 模板列表表格
- `TemplateEditDialog` - 模板编辑对话框
- `TemplatePreviewDialog` - 模板预览对话框
- `GenerateDialogContent` - 方案生成对话框

**状态管理：**
- `templates` - 模板列表
- `categories` - 分类列表
- `selectedTemplate` - 当前选中模板
- `formData` - 表单数据
- `parameters` - 参数值

#### 分类管理页面 (`src/app/prompts/categories/page.tsx`)

**主要组件：**
- `CategoryTable` - 分类列表表格（支持树形展示）
- `CategoryEditDialog` - 分类编辑对话框

#### 方案生成页面 (`src/app/prompts/generate/page.tsx`)

**主要组件：**
- `TemplateSelector` - 模板选择器
- `ParameterForm` - 参数表单
- `AdvancedSettings` - 高级设置面板
- `GeneratedContent` - 生成结果展示
- `StreamPreview` - 流式预览

---

## 使用指南

### 1. 创建分类

1. 访问 **方案管理 > 分类管理**
2. 点击 **新建分类** 按钮
3. 填写分类信息：
   - 分类名称（如：投标方案）
   - 分类代码（如：bid_proposal）
   - 分类类型（通用/投标/技术/商务）
   - 描述
4. 点击 **保存**

### 2. 创建模板

1. 访问 **方案管理 > 提示词模板**
2. 点击 **新建模板** 按钮
3. 填写基本信息：
   - 模板名称
   - 模板代码
   - 所属分类
   - 描述
4. 编写提示词内容：
   - 使用 `{{param_name}}` 语法定义参数
   - 示例：`项目名称：{{project_name}}`
5. 配置系统提示词（可选）
6. 设置模型参数：
   - 选择模型提供商
   - 输入模型名称
   - 设置温度参数
   - 设置最大Token数
7. 点击 **保存**

### 3. 使用模板生成方案

**方式一：从模板管理页面**

1. 在模板列表中找到目标模板
2. 点击操作菜单 > **生成方案**
3. 在对话框中填写参数
4. 点击 **开始生成**
5. 实时查看生成结果
6. 可复制或下载结果

**方式二：从方案生成页面**

1. 访问 **方案管理 > 方案生成**
2. 选择分类和模板
3. 填写参数值
4. （可选）展开高级设置覆盖模型配置
5. 点击 **开始生成**
6. 实时查看生成结果

---

## 配置说明

### 模型提供商配置

系统支持以下模型提供商：

| 提供商 | 代码 | 说明 |
|--------|------|------|
| 豆包 | doubao | 字节跳动豆包大模型 |
| DeepSeek | deepseek | DeepSeek大模型 |
| 千问 | qwen | 阿里千问大模型 |
| 文心一言 | wenxin | 百度文心一言 |
| 讯飞星火 | spark | 讯飞星火大模型 |

### 参数类型

| 类型 | 代码 | 说明 |
|------|------|------|
| 单行文本 | text | 短文本输入 |
| 多行文本 | textarea | 长文本输入 |
| 数字 | number | 数值输入 |
| 下拉选择 | select | 选项选择 |

### 模板状态

| 状态 | 代码 | 说明 |
|------|------|------|
| 草稿 | draft | 编辑中，不可使用 |
| 已发布 | published | 可正常使用 |
| 已归档 | archived | 已停用 |

---

## 最佳实践

### 1. 提示词设计原则

**清晰明确**
```
你是一位专业的投标方案撰写专家，请根据以下信息撰写技术方案：
项目名称：{{project_name}}
项目背景：{{project_background}}
技术要求：{{tech_requirements}}
```

**结构化输出**
```
请按以下结构输出技术方案：
1. 项目概述
2. 技术架构
3. 实施方案
4. 风险控制
5. 服务承诺
```

**示例驱动**
```
参考以下格式撰写：
【示例】
项目名称：智慧城市建设项目
项目背景：本项目旨在...

请按照以上格式撰写：{{project_info}}
```

### 2. 参数命名规范

- 使用有意义的英文名称：`project_name`、`tech_requirements`
- 驼峰或下划线命名，保持一致
- 参数描述清晰，说明用途

### 3. 模板版本管理

- 每次重要修改后记录变更说明
- 保留历史版本便于回溯
- 发布前进行充分测试

### 4. 性能优化建议

- 合理设置 `maxTokens` 避免过度消耗
- 对于长内容生成，使用流式输出
- 缓存常用模板减少数据库查询

---

## 更新日志

### v1.0.0 (2026-03-18)

- 初始版本发布
- 实现提示词模板管理功能
- 实现分类管理功能
- 实现方案生成功能
- 支持SSE流式输出
- 支持多种LLM提供商

---

## 相关文档

- [LLM适配层文档](./llm-adapters.md)
- [数据库Schema文档](./database-schema.md)
- [API接口文档](./api-reference.md)

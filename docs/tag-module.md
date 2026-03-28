# 标签管理模块

## 概述

标签管理模块是投标管理平台的核心分类与检索功能，支持多实体关联、层级化目录、灵活的标签体系，实现高效的实体分类与检索。

## 核心设计

### 统一标签表设计

采用"统一标签表 + 多态关联"架构，支持多种实体类型共享标签体系：

```
┌─────────────────┐
│  tag_categories │ ── 标签分类（层级化）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  unified_tags   │ ── 统一标签（层级化）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  entity_tags    │ ── 实体关联（多态）
└─────────────────┘
```

### 支持的实体类型

| 实体类型 | 说明 | 关联表 |
|---------|------|--------|
| `project` | 项目 | projects |
| `document` | 标书文档 | bid_documents |
| `template` | 模板 | prompt_templates |
| `scheme` | 方案 | prompt_templates |
| `bid` | 投标 | bids |

## 数据库设计

### 标签分类表 (tag_categories)

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | SERIAL | 主键 |
| name | VARCHAR(100) | 分类名称 |
| code | VARCHAR(50) | 唯一编码 |
| description | TEXT | 描述 |
| icon | VARCHAR(50) | 图标 |
| color | VARCHAR(20) | 颜色 |
| entity_type | VARCHAR(50) | 适用实体类型 |
| parent_id | INTEGER | 父分类ID（支持层级） |
| sort_order | INTEGER | 排序 |
| is_active | BOOLEAN | 是否启用 |
| created_by | INTEGER | 创建人 |

### 统一标签表 (unified_tags)

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | SERIAL | 主键 |
| name | VARCHAR(100) | 标签名称 |
| code | VARCHAR(50) | 唯一编码 |
| slug | VARCHAR(100) | URL友好标识 |
| category_id | INTEGER | 所属分类 |
| parent_id | INTEGER | 父标签ID（支持层级） |
| type | VARCHAR(20) | 类型：tag/directory |
| color | VARCHAR(20) | 颜色 |
| icon | VARCHAR(50) | 图标 |
| description | TEXT | 描述 |
| entity_types | JSONB | 适用实体类型数组 |
| use_count | INTEGER | 使用次数 |
| is_system | BOOLEAN | 是否系统内置 |
| is_active | BOOLEAN | 是否启用 |
| sort_order | INTEGER | 排序 |
| created_by | INTEGER | 创建人 |

### 实体标签关联表 (entity_tags)

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | SERIAL | 主键 |
| entity_type | VARCHAR(50) | 实体类型 |
| entity_id | INTEGER | 实体ID |
| tag_id | INTEGER | 标签ID |
| added_at | TIMESTAMP | 添加时间 |

## API 接口

### 标签分类 API

#### 获取分类列表
```http
GET /api/tags/categories

Query Parameters:
- entityType: 实体类型过滤
- keyword: 关键词搜索
- tree: 是否返回树形结构 (true/false)
- parentId: 父分类ID过滤

Response:
{
  "items": [
    {
      "id": 1,
      "name": "项目分类",
      "code": "project-category",
      "color": "#6366f1",
      "entityType": "project",
      "tagCount": 10,
      "children": []
    }
  ]
}
```

#### 创建分类
```http
POST /api/tags/categories

Body:
{
  "name": "项目分类",
  "code": "project-category",
  "entityType": "project",
  "description": "项目相关标签分类",
  "color": "#6366f1",
  "parentId": null,
  "sortOrder": 0
}

Response:
{
  "item": { ... }
}
```

#### 更新分类
```http
PUT /api/tags/categories

Body:
{
  "id": 1,
  "name": "新名称",
  "color": "#ff0000"
}
```

#### 删除分类
```http
DELETE /api/tags/categories?id=1
```

### 统一标签 API

#### 获取标签列表
```http
GET /api/tags

Query Parameters:
- keyword: 关键词搜索
- categoryId: 分类ID过滤
- entityType: 实体类型过滤
- type: 标签类型 (tag/directory)
- tree: 是否返回树形结构
- parentId: 父标签ID过滤
- page: 页码
- pageSize: 每页数量

Response:
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 50,
  "totalPages": 2
}
```

#### 创建标签
```http
POST /api/tags

Body:
{
  "name": "重要项目",
  "code": "important",
  "categoryId": 1,
  "type": "tag",
  "color": "#ff0000",
  "description": "标记重要项目",
  "entityTypes": ["project", "bid"]
}
```

#### 更新标签
```http
PUT /api/tags

Body:
{
  "id": 1,
  "name": "新名称",
  "color": "#00ff00"
}
```

#### 删除标签
```http
DELETE /api/tags?id=1
DELETE /api/tags?ids=1,2,3  # 批量删除
```

### 实体标签关联 API

#### 获取实体的标签
```http
GET /api/tags/entities?entityType=project&entityId=1

Response:
{
  "items": [
    {
      "id": 1,
      "name": "重要项目",
      "code": "important",
      "color": "#ff0000"
    }
  ]
}
```

#### 设置实体标签（替换）
```http
POST /api/tags/entities

Body:
{
  "entityType": "project",
  "entityId": 1,
  "tagIds": [1, 2, 3]
}
```

#### 添加/移除单个标签
```http
PUT /api/tags/entities

Body:
{
  "entityType": "project",
  "entityId": 1,
  "tagId": 1,
  "action": "add" | "remove"
}
```

#### 删除实体标签关联
```http
DELETE /api/tags/entities?entityType=project&entityId=1&tagId=1
DELETE /api/tags/entities?entityType=project&entityId=1  # 删除所有关联
```

### 批量操作 API

#### 批量创建标签
```http
POST /api/tags/batch

Body:
{
  "operation": "batch-create",
  "data": [
    { "name": "标签1", "categoryId": 1 },
    { "name": "标签2", "categoryId": 1 }
  ]
}
```

#### 批量更新标签
```http
POST /api/tags/batch

Body:
{
  "operation": "batch-update",
  "data": [
    { "id": 1, "name": "新名称1" },
    { "id": 2, "name": "新名称2" }
  ]
}
```

#### 批量删除标签
```http
POST /api/tags/batch

Body:
{
  "operation": "batch-delete",
  "data": [1, 2, 3]
}
```

#### 批量关联实体
```http
POST /api/tags/batch

Body:
{
  "operation": "batch-associate",
  "data": {
    "entityType": "project",
    "entityId": 1,
    "tagIds": [1, 2, 3]
  }
}
```

## 前端页面

### 页面路径
- `/tags` - 标签管理主页面

### 页面功能
1. **左侧面板 - 分类树**
   - 层级化分类展示
   - 点击筛选标签
   - 右键菜单编辑/删除

2. **右侧面板 - 标签列表**
   - 卡片式标签展示
   - 支持搜索过滤
   - 多选批量操作
   - 新建/编辑/删除标签

3. **批量操作**
   - 批量选择
   - 批量删除
   - 批量修改分类

### 导航菜单
在侧边栏导航中，标签管理入口位于：
```
标签管理
├── 标签列表 (/tags)
└── 分类管理 (/tags?tab=categories)
```

## 使用示例

### 在项目中使用标签

```typescript
// 获取项目的标签
const projectTags = await fetch('/api/tags/entities?entityType=project&entityId=1');

// 为项目设置标签
await fetch('/api/tags/entities', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'project',
    entityId: 1,
    tagIds: [1, 2, 3]
  })
});
```

### 按标签筛选实体

```typescript
// 获取使用某标签的所有项目
const entities = await fetch('/api/tags/entities?tagId=1');
// 返回: [{ id: 1, entityType: 'project', ... }, ...]
```

### 创建层级化目录

```typescript
// 创建父目录
const parent = await fetch('/api/tags', {
  method: 'POST',
  body: JSON.stringify({
    name: '华东区域',
    type: 'directory',
    categoryId: 1
  })
});

// 创建子标签
const child = await fetch('/api/tags', {
  method: 'POST',
  body: JSON.stringify({
    name: '上海',
    type: 'tag',
    parentId: parent.id,
    categoryId: 1
  })
});
```

## 系统内置标签

系统会预置一些常用标签，标记为 `isSystem: true`，不可删除和修改：

| 标签 | 说明 |
|-----|------|
| 重要 | 标记重要实体 |
| 紧急 | 标记紧急实体 |
| 待处理 | 标记待处理状态 |
| 已完成 | 标记已完成状态 |

## 性能优化

1. **索引优化**
   - entity_type + entity_id 复合索引
   - tag_id 索引
   - category_id 索引

2. **查询优化**
   - 使用 JOIN 代替多次查询
   - 树形结构一次查询构建
   - 分页查询避免全表扫描

3. **缓存策略**
   - 热门标签缓存
   - 分类树缓存
   - 实体标签关联缓存

## 注意事项

1. **系统标签保护**
   - 系统内置标签不可删除和修改
   - 通过 `isSystem` 字段标识

2. **级联删除**
   - 删除分类时，标签的 category_id 会被设为 NULL
   - 删除标签时，会级联删除所有实体关联

3. **层级限制**
   - 建议分类层级不超过 3 级
   - 建议标签层级不超过 2 级

4. **权限控制**
   - 创建/编辑/删除需要登录
   - 系统管理员可管理所有标签

## 后续扩展

1. **标签推荐**：基于使用频率和关联性推荐标签
2. **标签合并**：合并重复或相似标签
3. **标签统计**：标签使用趋势分析
4. **智能标签**：基于内容自动推荐标签

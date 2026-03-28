# AI 图片生成功能文档

## 概述

AI 图片生成功能基于 `coze-coding-dev-sdk` 实现，支持文生图、图生图、批量生成等功能，为投标管理平台提供图片生成能力。

## 功能特性

### 1. 文生图 (Text-to-Image)
- 通过文本描述生成高质量图片
- 支持 2K、4K 分辨率
- 支持自定义尺寸
- 可选添加水印

### 2. 图生图 (Image-to-Image)
- 基于参考图片生成新图片
- 支持多张参考图片
- 保持参考图片的风格和内容

### 3. 批量生成
- 一次性生成多张图片
- 支持并发控制
- 自动处理生成结果

### 4. 业务集成
- 关联项目、文档等业务对象
- 支持用途标识（文档封面、插图等）
- 记录生成历史

## 技术架构

### 技术栈
- **SDK**: coze-coding-dev-sdk (TypeScript)
- **数据库**: PostgreSQL + Drizzle ORM
- **前端**: React + shadcn/ui

### 核心组件

#### 1. 数据库表
- `image_generations`: 图片生成记录表

#### 2. 服务层
- `src/lib/image-generation/service.ts`: 图片生成核心服务

#### 3. API 接口
- `POST /api/image-generations`: 创建图片生成任务
- `GET /api/image-generations`: 获取生成记录列表
- `GET /api/image-generations/[id]`: 获取生成详情
- `DELETE /api/image-generations/[id]`: 删除生成记录
- `POST /api/image-generations/batch`: 批量生成图片

#### 4. 前端组件
- `ImageGenerationDialog`: 图片生成对话框
- `ImagePreview`: 图片预览组件
- `ImageSelector`: 图片选择器组件

## 数据库设计

### image_generations 表

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | serial | 主键 |
| projectId | integer | 关联项目ID |
| projectName | varchar(200) | 项目名称（冗余） |
| bidDocumentId | integer | 关联文档ID |
| type | enum | 生成类型（text_to_image/image_to_image/batch_generation） |
| prompt | text | 提示词 |
| negativePrompt | text | 反向提示词 |
| size | enum | 图片尺寸（2K/4K/custom） |
| customWidth | integer | 自定义宽度 |
| customHeight | integer | 自定义高度 |
| watermark | boolean | 是否添加水印 |
| referenceImages | text | 参考图片URL列表（JSON数组） |
| imageUrls | text | 生成的图片URL列表（JSON数组） |
| imageCount | integer | 生成的图片数量 |
| businessObjectType | enum | 业务对象类型 |
| businessObjectId | integer | 业务对象ID |
| usage | varchar(100) | 用途说明 |
| status | enum | 状态（pending/generating/completed/failed） |
| errorMessage | text | 错误信息 |
| createdBy | integer | 创建者ID |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

## API 接口文档

### 1. 创建图片生成任务

**接口**: `POST /api/image-generations`

**请求参数**:
```json
{
  "prompt": "一个现代化的办公室，落地窗，明亮的光线",
  "type": "text_to_image",
  "size": "2K",
  "watermark": true,
  "projectId": 1,
  "projectName": "示例项目",
  "bidDocumentId": 1,
  "businessObjectType": "project",
  "businessObjectId": 1,
  "usage": "文档封面"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "imageUrls": ["https://example.com/image1.png"],
    "imageCount": 1,
    "status": "completed"
  }
}
```

### 2. 获取生成记录列表

**接口**: `GET /api/image-generations`

**查询参数**:
- `projectId`: 项目ID（可选）
- `bidDocumentId`: 文档ID（可选）
- `businessObjectType`: 业务对象类型（可选）
- `businessObjectId`: 业务对象ID（可选）
- `status`: 状态（可选）
- `page`: 页码（默认1）
- `pageSize`: 每页数量（默认20）

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "text_to_image",
      "prompt": "一个现代化的办公室",
      "imageUrls": ["https://example.com/image1.png"],
      "imageCount": 1,
      "status": "completed",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 3. 获取生成详情

**接口**: `GET /api/image-generations/[id]`

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "text_to_image",
    "prompt": "一个现代化的办公室",
    "size": "2K",
    "watermark": true,
    "imageUrls": ["https://example.com/image1.png"],
    "imageCount": 1,
    "projectId": 1,
    "status": "completed",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### 4. 删除生成记录

**接口**: `DELETE /api/image-generations/[id]`

**响应**:
```json
{
  "success": true,
  "message": "删除成功"
}
```

### 5. 批量生成图片

**接口**: `POST /api/image-generations/batch`

**请求参数**:
```json
{
  "prompts": ["图片1描述", "图片2描述", "图片3描述"],
  "size": "2K",
  "watermark": true,
  "projectId": 1
}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "imageUrls": ["https://example.com/image1.png"],
      "imageCount": 1,
      "status": "completed"
    },
    {
      "id": 2,
      "imageUrls": ["https://example.com/image2.png"],
      "imageCount": 1,
      "status": "completed"
    }
  ]
}
```

## 前端组件使用

### 1. 图片生成对话框

```tsx
import { ImageGenerationDialog } from '@/components/image-generation-dialog';

function MyComponent() {
  return (
    <ImageGenerationDialog
      options={{
        projectId: 1,
        usage: '文档封面'
      }}
      onImageGenerated={(result) => {
        console.log('生成成功:', result);
      }}
    />
  );
}
```

### 2. 图片预览

```tsx
import { ImagePreview } from '@/components/image-preview';

function MyComponent() {
  return (
    <ImagePreview
      src="https://example.com/image.png"
      alt="图片"
      width={200}
      height={150}
      onDownload={(url) => console.log('下载:', url)}
      onDelete={() => console.log('删除')}
    />
  );
}
```

### 3. 图片选择器

```tsx
import { ImageSelector } from '@/components/image-selector';

function MyComponent() {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <ImageSelector
      images={['url1', 'url2', 'url3']}
      selectedImages={selected}
      onChange={setSelected}
      multiple={true}
      maxSelection={2}
    />
  );
}
```

## 使用场景

### 1. 文档封面生成
在投标文档编辑页面，使用 AI 生成文档封面图片。

```tsx
<ImageGenerationDialog
  trigger={<Button>生成封面</Button>}
  options={{
    bidDocumentId: documentId,
    usage: '文档封面'
  }}
  onImageGenerated={(result) => {
    // 设置为文档封面
    setCoverImage(result.imageUrls[0]);
  }}
/>
```

### 2. 内容插图生成
根据文档内容，自动生成相关插图。

```tsx
<ImageGenerationDialog
  options={{
    prompt: chapterContent, // 使用章节内容作为提示词
    usage: '章节插图'
  }}
/>
```

### 3. 营销素材生成
为项目生成宣传图片、展板图等营销素材。

```tsx
<ImageGenerationDialog
  options={{
    projectId: projectId,
    businessObjectType: 'marketing',
    usage: '项目宣传图'
  }}
/>
```

## 注意事项

1. **后端调用限制**: coze-coding-dev-sdk 只能在后端代码中调用，不能在前端使用。
2. **Header 传递**: 必须从请求中提取 headers 并传递给 SDK，使用 `HeaderUtils.extractForwardHeaders()`。
3. **错误处理**: 始终检查 `helper.success` 再访问结果，并处理错误信息。
4. **并发控制**: 批量生成时建议限制并发数，避免触发限流。
5. **图片尺寸**: 自定义尺寸范围必须在 [2560x1440, 4096x4096] 之间。

## 常见问题

### 1. 生成失败怎么办？
检查 `errorMessage` 字段，常见原因包括：
- 提示词不清晰
- 参数超出范围
- 网络问题
- API 配额不足

### 2. 如何提高生成质量？
- 提供详细的提示词
- 使用图生图功能提供参考
- 选择合适的尺寸
- 描述明确的风格和内容

### 3. 生成的图片可以商用吗？
- 默认生成的图片带水印，不能直接商用
- 需要联系相关服务提供商获取商用授权
- 建议在内部演示、预览等非商业场景使用

## 未来扩展

1. **图片编辑**: 支持图片裁剪、滤镜、标注等编辑功能
2. **模板库**: 预设常用图片模板，快速生成
3. **智能提示**: 根据项目类型推荐提示词
4. **批量优化**: 批量生成时自动优化参数
5. **云端存储**: 支持将生成的图片上传到对象存储

## 更新日志

- **2024-01-15**: 初始版本，支持文生图、图生图、批量生成

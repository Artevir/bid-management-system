# 投标管理平台自动生成流程模块详解

## 一、模块概览

本系统实现了多个自动化生成模块，利用大语言模型（LLM）能力，大幅提升投标工作效率。主要包括以下模块：

| 模块名称 | 功能描述 | 核心能力 |
|----------|----------|----------|
| 文档解析生成 | 招标文件智能解析和信息提取 | 自动识别章节、时间节点、资质要求等 |
| 文件解读生成 | 招标文件解读与结构化信息提取 | 提取项目基本信息、技术规格、评分细则 |
| 响应矩阵生成 | 根据解析项生成响应建议 | 自动生成资格条件响应、评分项响应 |
| 标书文档生成 | 章节内容智能生成 | 基于模板和上下文自动生成标书章节 |
| 时间节点提取 | 自动识别关键时间节点 | AI识别报名、答疑、投标、开标时间 |
| 预警消息生成 | 自动生成预警通知 | 根据时间节点生成预警消息 |
| 项目信息同步 | 自动填充项目信息 | 招标信息一键转项目 |

---

## 二、详细功能与实现逻辑

### 2.1 文档解析生成模块

#### 功能描述
使用大语言模型对招标文件进行智能解析，自动提取关键信息，支持多种文档格式（PDF、Word、Excel）。

#### 生成内容
1. **章节结构提取**
   - 自动识别文档章节标题
   - 建立章节层级关系
   - 提取章节内容摘要
   - 记录页码信息

2. **关键信息提取**
   - 时间节点（deadline）
   - 资格条件（qualification）
   - 评分项（scoring_item）
   - 技术参数（technical_param）
   - 商务条款（commercial）
   - 其他要求（requirement）

#### 实现逻辑

**文件位置**: `src/lib/parse/service.ts`

**核心流程**:
```
1. 上传文件 → MD5校验去重
2. 调用文件解析SDK提取文本
3. 构建LLM解析提示词
4. LLM智能解析 → 返回JSON格式结果
5. 解析结果存储到parseItems表
6. 更新解析任务状态为completed
```

**关键代码**:
```typescript
// LLM解析提示词
const systemPrompt = `你是一个专业的招标文件解析专家。请按照以下格式返回JSON结果：
{
  "sections": [...],
  "items": [
    {
      "type": "deadline|qualification|scoring_item|...",
      "title": "条目标题",
      "content": "条目内容",
      "confidence": 置信度(0-100),
      ...
    }
  ]
}`;

// 调用LLM解析
const response = await client.invoke(messages, {
  model: 'doubao-seed-1-8-251228',
  temperature: 0.3, // 低温度保证准确性
});

// 解析结果存储
await db.insert(parseItems).values(parsedItems);
```

**数据表**: 
- `parse_tasks` - 解析任务
- `parse_items` - 解析项
- `parse_results` - 解析结果

---

### 2.2 文件解读生成模块

#### 功能描述
深度解读招标文件，提取结构化信息，为投标决策提供依据。

#### 生成内容
1. **基本信息提取**
   - 项目名称、项目编号
   - 招标单位、代理机构
   - 预算金额、项目类型

2. **时间节点识别**
   - 发布时间
   - 报名开始/截止时间
   - 答疑截止时间
   - 投标截止时间
   - 开标时间、开标地点

3. **技术规格提取**
   - 规格类别、子类别
   - 规格名称、规格值
   - 关键参数标注
   - 允许偏差范围

4. **评分细则解析**
   - 评分分类、子分类
   - 评分项名称
   - 最高分值、最低分值
   - 评分方法、评分标准
   - 扣分规则、加分规则

5. **文档框架生成**
   - 章节编号、章节标题
   - 章节类型（封面、目录、商务、技术等）
   - 层级关系
   - 内容要求、格式要求
   - 页数限制

#### 实现逻辑

**文件位置**: `src/lib/interpretation/service.ts`

**核心流程**:
```
1. 文件上传 → MD5去重校验
2. FetchClient下载文件内容
3. 文本预处理（分段、清理）
4. 分模块LLM解析：
   - 基本信息提取
   - 时间节点识别
   - 技术规格解析
   - 评分细则提取
   - 文档框架生成
5. 结构化数据存储
6. 解读日志记录
```

**关键代码**:
```typescript
// 基本信息提取
async function extractBasicInfo(content: string): Promise<Record<string, any>> {
  const prompt = `从以下招标文件中提取基本信息：${content}`;
  const response = await llmClient.invoke([
    { role: 'system', content: '你是招标文件分析专家' },
    { role: 'user', content: prompt }
  ]);
  return JSON.parse(response.content);
}

// 技术规格提取
async function extractTechnicalSpecs(content: string): Promise<TechnicalSpecItem[]> {
  const prompt = `提取技术规格，包括规格类别、规格名称、规格值、是否关键参数`;
  const response = await llmClient.invoke([...], {
    model: 'doubao-seed-1-8-251228',
    thinking: 'enabled' // 启用思考模式提高准确性
  });
  return JSON.parse(response.content);
}

// 评分细则提取
async function extractScoringItems(content: string): Promise<ScoringItemData[]> {
  const prompt = `提取评分细则，包括评分分类、评分项、分值、评分标准`;
  // ...
}
```

**数据表**:
- `bid_document_interpretations` - 文件解读记录
- `bid_technical_specs` - 技术规格
- `bid_scoring_items` - 评分细则
- `bid_requirement_checklist` - 资质核对清单
- `bid_document_framework` - 文档框架

---

### 2.3 响应矩阵生成模块

#### 功能描述
基于招标文件的解析项，自动生成响应建议，帮助用户快速制作投标响应方案。

#### 生成内容
1. **资格条件响应**
   - 资格类型编号（Q01, Q02...）
   - 资格条件标题
   - 要求内容
   - 强制性/可选性标注
   - 响应建议

2. **评分项响应**
   - 评分项编号（S01, S02...）
   - 评分项标题
   - 评分标准
   - 分值
   - 响应建议

3. **其他要求响应**
   - 要求编号（R01, R02...）
   - 要求内容
   - 响应建议

#### 实现逻辑

**文件位置**: `src/lib/matrix/generator.ts`

**核心流程**:
```
1. 获取解析任务的解析项
2. 创建响应矩阵记录
3. 按类型分组处理：
   - 资格条件 → 生成Q系列编号
   - 评分项 → 生成S系列编号
   - 其他要求 → 生成R系列编号
4. 为每个解析项生成响应建议：
   - 提取要求内容和上下文
   - 构建LLM提示词
   - LLM生成响应建议
   - 评估响应质量
5. 存储响应矩阵项
6. 计算统计信息
```

**关键代码**:
```typescript
// 生成响应建议
async function generateResponseSuggestion(
  requirement: string,
  context: string
): Promise<string> {
  const systemPrompt = `你是一个专业的投标响应专家。根据招标文件的要求，生成合适的响应建议。

要求：
1. 响应内容要具体、可操作
2. 突出公司的优势和实力
3. 提供具体的数据和案例支持
4. 注意格式规范`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `招标要求：\n${requirement}\n\n上下文：\n${context}\n\n请生成响应建议：` }
  ];

  const response = await client.invoke(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.7, // 适度创造性
  });

  return response.content;
}

// 生成响应矩阵
async function generateResponseMatrix(params: MatrixGenerationParams) {
  // 获取解析项
  const taskParseItems = await db
    .select()
    .from(parseItems)
    .where(eq(parseItems.taskId, params.taskId));

  // 处理资格条件
  const qualifications = taskParseItems.filter(item => item.type === 'qualification');
  for (const item of qualifications) {
    const suggestion = await generateResponseSuggestion(item.content, context);
    matrixItems.push({
      type: 'qualification',
      serialNumber: `Q${String(serialNumber++).padStart(2, '0')}`,
      suggestion,
      ...
    });
  }
  
  // 处理评分项（类似逻辑）
  // ...
}
```

**数据表**:
- `response_matrices` - 响应矩阵
- `response_items` - 响应项

---

### 2.4 标书文档生成模块

#### 功能描述
基于模板和上下文信息，自动生成标书章节内容。

#### 生成内容
1. **封面内容**
   - 项目名称
   - 招标编号
   - 投标单位信息
   - 日期等

2. **目录内容**
   - 自动提取章节标题
   - 生成页码索引

3. **商务标内容**
   - 公司介绍
   - 资质证明
   - 业绩展示
   - 财务状况

4. **技术标内容**
   - 技术方案
   - 产品说明
   - 实施计划
   - 售后服务

5. **资格证明**
   - 资质证书清单
   - 人员资质
   - 设备清单

#### 实现逻辑

**文件位置**: `src/lib/bid/service.ts`

**核心流程**:
```
1. 创建标书文档
2. 基于模板生成章节结构
3. 章节关联解析项/响应项
4. 按章节类型生成内容：
   - 封面：调用公司信息API
   - 目录：自动提取章节标题
   - 商务：调用公司管理模块获取资质、业绩
   - 技术：基于响应矩阵生成技术方案
   - 资格：调用公司文件获取证书
5. 内容审核与修正
6. 版本管理
```

**关键代码**:
```typescript
// 创建章节
async function createChapter(params: CreateChapterParams) {
  // 获取响应项内容（如果有关联）
  let suggestedContent = '';
  if (params.responseItemId) {
    const responseItem = await getResponseItem(params.responseItemId);
    suggestedContent = responseItem.suggestedResponse || '';
  }

  // 调用LLM生成内容
  if (params.type === 'technical') {
    const content = await generateChapterContent({
      type: 'technical',
      title: params.title,
      requirements: suggestedContent,
      companyContext: await getCompanyContext(params.companyId),
    });
    suggestedContent = content;
  }

  await db.insert(bidChapters).values({
    ...params,
    content: suggestedContent,
    wordCount: suggestedContent.length,
  });
}

// 生成章节内容
async function generateChapterContent(options: {
  type: string;
  title: string;
  requirements: string;
  companyContext: Record<string, any>;
}): Promise<string> {
  const systemPrompt = `你是一个专业的标书撰写专家。根据要求生成标书章节内容。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `章节类型：${options.type}\n章节标题：${options.title}\n要求：${options.requirements}\n公司信息：${JSON.stringify(options.companyContext)}` }
  ];

  const response = await client.invoke(messages, {
    model: 'doubao-seed-1-8-251228',
    temperature: 0.8, // 较高创造性
    thinking: 'enabled', // 启用思考模式
  });

  return response.content;
}
```

**数据表**:
- `bid_documents` - 标书文档
- `bid_chapters` - 文档章节
- `bid_templates` - 标书模板

---

### 2.5 时间节点提取模块

#### 功能描述
使用大语言模型从招标信息中自动提取关键时间节点。

#### 生成内容
1. **报名时间**
   - 报名开始时间
   - 报名截止时间

2. **答疑时间**
   - 答疑截止时间

3. **投标时间**
   - 投标截止时间

4. **开标时间**
   - 开标时间
   - 开标地点

5. **模糊时间标注**
   - 标记不明确的时间
   - 提供模糊时间说明

#### 实现逻辑

**文件位置**: `src/lib/tender-subscription/time-extraction.ts`

**核心流程**:
```
1. 获取招标信息文本内容
2. 构建时间提取提示词
3. LLM解析时间节点
4. 解析JSON响应
5. 日期格式标准化
6. 置信度评估
7. 存储时间节点
8. 标注模糊时间
```

**关键代码**:
```typescript
const TIME_EXTRACTION_PROMPT = `你是一个专业的招标文件分析师。请从以下招标信息中提取时间节点信息。

## 输出格式
请严格按照以下JSON格式输出：
{
  "registerStartDate": "YYYY-MM-DD HH:mm" 或 null,
  "registerEndDate": "YYYY-MM-DD HH:mm" 或 null,
  "questionDeadline": "YYYY-MM-DD HH:mm" 或 null,
  "submissionDeadline": "YYYY-MM-DD HH:mm" 或 null,
  "openBidDate": "YYYY-MM-DD HH:mm" 或 null,
  "openBidLocation": "开标地点" 或 null,
  "hasFuzzyTime": true/false,
  "fuzzyTimeNote": "模糊时间说明" 或 null,
  "confidence": 0-100
}

## 提取规则
1. 精确时间：直接提取明确日期和时间
2. 模糊时间：设置 hasFuzzyTime=true，并在 fuzzyTimeNote 中说明
3. 相对时间：尝试推算绝对日期
4. 置信度：根据明确程度打分（0-100）
`;

async function extractTimeNodes(content: string): Promise<ExtractionResult> {
  const config = new Config();
  const client = new LLMClient(config);

  const response = await client.invoke([
    { role: 'user', content: TIME_EXTRACTION_PROMPT + content.substring(0, 8000) }
  ], {
    temperature: 0.3, // 低温度保证准确性
  });

  const parsed = JSON.parse(response.content);
  return {
    success: true,
    timeNodes: {
      registerStartDate: parseDate(parsed.registerStartDate),
      registerEndDate: parseDate(parsed.registerEndDate),
      // ...
    },
    confidence: parsed.confidence
  };
}
```

**数据表**:
- `tender_infos` - 招标信息表（时间节点字段）

---

### 2.6 预警消息生成模块

#### 功能描述
根据时间节点自动生成预警消息，支持多渠道推送。

#### 生成内容
1. **预警类型**
   - 报名截止预警
   - 答疑截止预警
   - 投标截止预警
   - 开标预警

2. **预警消息**
   - 预警标题
   - 预警内容
   - 时间节点
   - 操作建议

#### 实现逻辑

**文件位置**: `src/lib/tender-subscription/service.ts`

**核心流程**:
```
1. 获取用户预警设置
2. 遍历订阅的招标信息
3. 计算触发时间：
   - 报名截止 = 当前时间 + 预警提前天数
   - 答疑截止 = 当前时间 + 预警提前天数
   - 投标截止 = 当前时间 + 预警提前天数
   - 开标 = 当前时间 + 预警提前天数
4. 生成预警记录
5. 匹配预警类型标签
6. 格式化预警消息
7. 存储预警记录
8. 推送到多渠道
```

**关键代码**:
```typescript
// 生成预警
async function generateAlertsForTender(tenderInfoId: number): Promise<TenderAlert[]> {
  const tender = await getTenderInfo(tenderInfoId);
  const subscriptions = await matchTenderToSubscriptions(tender);
  const alerts: TenderAlert[] = [];

  for (const subscription of subscriptions) {
    const setting = await getAlertSetting(subscription.userId);

    // 生成报名截止预警
    if (tender.registerEndDate) {
      const scheduledTime = new Date(tender.registerEndDate);
      scheduledTime.setDate(scheduledTime.getDate() - setting.registerDays);

      if (scheduledTime > new Date()) {
        alerts.push(await createAlert({
          tenderInfoId: tender.id,
          userId: subscription.userId,
          alertType: 'register_deadline',
          alertTitle: `报名截止预警：${tender.title.substring(0, 50)}`,
          alertMessage: `项目「${tender.title}」将于 ${formatDate(tender.registerEndDate)} 截止报名，请及时处理。`,
          targetTime: tender.registerEndDate,
          scheduledTime,
        }));
      }
    }

    // 其他预警类型（类似逻辑）
    // ...
  }

  return alerts;
}

// 发送预警
async function sendPendingAlerts(): Promise<{ sent: number; failed: number }> {
  const pendingAlerts = await getPendingAlerts();

  for (const alert of pendingAlerts) {
    // 系统内通知
    if (alert.channel === 'system') {
      await markAsSent(alert);
      await syncToNotificationCenter(alert);
    }
    // 企业微信
    else if (alert.channel === 'wechat_work') {
      await sendToWechatWork(webhook, alert);
      await markAsSent(alert);
    }
    // 钉钉
    else if (alert.channel === 'dingtalk') {
      await sendToDingtalk(webhook, alert);
      await markAsSent(alert);
    }
  }

  return { sent, failed };
}
```

**数据表**:
- `tender_subscriptions` - 订阅规则
- `alert_settings` - 预警设置
- `tender_alerts` - 预警记录

---

### 2.7 项目信息同步模块

#### 功能描述
招标信息一键转换为项目，自动填充项目信息。

#### 生成内容
1. **项目基本信息**
   - 项目名称
   - 项目编号
   - 项目类型
   - 行业、地区

2. **招标单位信息**
   - 招标单位
   - 招标代理
   - 联系人、联系电话

3. **时间节点**
   - 发布时间
   - 报名截止时间
   - 答疑截止时间
   - 投标截止时间
   - 开标时间

4. **项目其他信息**
   - 预算金额
   - 项目描述
   - 项目负责人

#### 实现逻辑

**文件位置**: `src/app/api/tender-crawl/tenders/[id]/create-project/route.ts`

**核心流程**:
```
1. 获取招标信息
2. 检查是否已转换
3. 生成项目编号
4. 创建项目记录：
   - 填充基本信息
   - 填充时间节点
   - 设置项目负责人
   - 设置项目部门
5. 更新招标信息状态
6. 关联项目ID
7. 返回项目信息
```

**关键代码**:
```typescript
// 招标信息转项目
async function createProjectFromTender(tenderInfoId: number, userId: number) {
  const tenderInfo = await getTenderInfo(tenderInfoId);
  const user = await getUser(userId);
  const projectCode = `PRJ-${Date.now()}`;

  const project = await db.insert(projects).values({
    name: tenderInfo.title || '未命名项目',
    code: projectCode,
    tenderCode: tenderInfo.tenderCode,
    tenderOrganization: tenderInfo.tenderOrganization,
    tenderAgent: tenderInfo.tenderAgent,
    budget: tenderInfo.budget,
    region: tenderInfo.region,
    industry: tenderInfo.industry,
    
    // 时间节点
    registerDeadline: tenderInfo.registerEndDate,
    questionDeadline: tenderInfo.questionDeadline,
    submissionDeadline: tenderInfo.submissionDeadline,
    openBidDate: tenderInfo.openBidDate,
    publishDate: tenderInfo.publishDate,
    
    // 项目负责人和部门
    ownerId: userId,
    departmentId: user.departmentId,
    
    description: tenderInfo.summary,
    status: 'draft',
    progress: 0,
  }).returning();

  // 更新招标信息
  await db.update(tenderInfos)
    .set({
      projectId: project.id,
      status: 'following',
      followedBy: userId,
      followedAt: new Date(),
    })
    .where(eq(tenderInfos.id, tenderInfoId));

  return project;
}
```

**数据表**:
- `projects` - 项目表
- `tender_infos` - 招标信息表（关联字段）

---

## 三、数据流程图

```
┌─────────────┐
│ 招标文件上传 │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│ 文档解析生成 │ ──▶│ parse_items  │
└──────┬──────┘     └──────────────┘
       │
       ▼
┌─────────────┐     ┌────────────────────┐
│ 文件解读生成 │ ──▶│ bid_* 多张关联表   │
└──────┬──────┘     └────────────────────┘
       │
       ├──────────▶ 技术规格
       ├──────────▶ 评分细则
       ├──────────▶ 文档框架
       └──────────▶ 时间节点
                      │
                      ▼
┌─────────────┐     ┌──────────────┐
│ 响应矩阵生成 │ ──▶│ response_*  │
└──────┬──────┘     └──────────────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│ 标书文档生成 │ ──▶│ bid_*       │
└─────────────┘     └──────────────┘
       │
       ├──────────▶ 章节内容
       └──────────▶ 整体文档

┌─────────────┐
│ 时间节点提取 │ ──▶ tender_infos
└──────┬──────┘
       │
       ├──────────▶ 预警记录生成
       └──────────▶ 项目信息同步
```

---

## 四、关键技术参数

| 模块 | 模型 | Temperature | Thinking Mode | 用途 |
|------|------|-------------|---------------|------|
| 文档解析 | doubao-seed-1-8-251228 | 0.3 | disabled | 准确提取信息 |
| 文件解读 | doubao-seed-1-8-251228 | 0.3 | enabled | 深度理解分析 |
| 响应建议 | doubao-seed-1-8-251228 | 0.7 | disabled | 平衡准确与创造 |
| 标书生成 | doubao-seed-1-8-251228 | 0.8 | enabled | 高度创造性 |
| 时间提取 | doubao-seed-1-8-251228 | 0.3 | disabled | 精确时间识别 |

---

## 五、性能优化策略

1. **批量处理**
   - 时间节点提取：批量处理20条记录
   - 预警发送：批量发送100条

2. **缓存机制**
   - 公司信息缓存
   - 模板内容缓存

3. **异步处理**
   - 长时间解析任务异步化
   - 定时任务队列

4. **去重校验**
   - MD5文件去重
   - 订阅规则去重

---

## 六、数据表清单

| 表名 | 说明 | 关联 |
|------|------|------|
| parse_tasks | 解析任务 | |
| parse_items | 解析项 | parse_tasks |
| parse_results | 解析结果 | parse_tasks |
| bid_document_interpretations | 文件解读 | |
| bid_technical_specs | 技术规格 | bid_document_interpretations |
| bid_scoring_items | 评分细则 | bid_document_interpretations |
| bid_requirement_checklist | 资质核对清单 | bid_document_interpretations |
| bid_document_framework | 文档框架 | bid_document_interpretations |
| response_matrices | 响应矩阵 | |
| response_items | 响应项 | response_matrices |
| bid_documents | 标书文档 | projects |
| bid_chapters | 文档章节 | bid_documents |
| tender_infos | 招标信息 | |
| tender_subscriptions | 订阅规则 | users |
| alert_settings | 预警设置 | users |
| tender_alerts | 预警记录 | tender_infos, tender_subscriptions |

---

*文档版本：1.0*  
*更新时间：2026年3月*

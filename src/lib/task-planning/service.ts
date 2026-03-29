/**
 * 智能任务规划服务层
 * 基于文件解读结果，使用AI助手进行任务分解和分配
 */

import { db } from '@/db';
import {
  bidDocumentInterpretations,
  projects as _projects,
  users as _users,
  projectMembers,
} from '@/db/schema';
import { eq, and, desc, inArray as _inArray } from 'drizzle-orm';
import { getLLM } from '@/lib/llm';

// ============================================
// 类型定义
// ============================================

export interface TimeNode {
  name: string;
  deadline: string;
  description?: string;
  type: string;
}

export interface TaskBreakdown {
  id: string;
  name: string;
  description: string;
  deadline?: string;
  assignee?: {
    id: number;
    name: string;
    role: string;
  };
  priority: 'high' | 'medium' | 'low';
  category: string;
  dependencies?: string[];
  estimatedHours?: number;
  relatedApplication?: {
    type: 'authorization' | 'sample' | 'price' | 'partner';
    name: string;
  };
}

export interface TaskPlanResult {
  projectName: string;
  projectCode?: string;
  overallDeadline: string;
  timeNodes: TimeNode[];
  tasks: TaskBreakdown[];
  recommendations: string[];
  riskAlerts: string[];
}

export interface TaskPlanningInput {
  interpretationId: number;
  projectId?: number;
  additionalContext?: string;
}

// ============================================
// AI 任务分解服务
// ============================================

const TASK_BREAKDOWN_PROMPT = `你是一个专业的投标项目任务规划专家。请根据以下招标文件解读结果，进行任务分解和人员分配。

## 招标文件解读结果

### 项目基本信息
{{basicInfo}}

### 时间节点
{{timeNodes}}

### 资质要求
{{qualificationRequirements}}

### 投标要求
{{submissionRequirements}}

### 团队成员（可选分配对象）
{{teamMembers}}

### 其他上下文
{{additionalContext}}

## 请按以下格式输出任务分解结果（JSON格式）：

\`\`\`json
{
  "projectName": "项目名称",
  "projectCode": "项目编号",
  "overallDeadline": "投标截止日期",
  "timeNodes": [
    {
      "name": "节点名称",
      "deadline": "截止时间",
      "description": "说明",
      "type": "类型"
    }
  ],
  "tasks": [
    {
      "id": "task_1",
      "name": "任务名称",
      "description": "任务详细描述",
      "deadline": "截止时间",
      "assignee": {
        "id": 用户ID或null,
        "name": "建议负责人姓名或角色",
        "role": "角色"
      },
      "priority": "high/medium/low",
      "category": "授权申请/样机申请/价格申请/友司支持/文档编制/材料准备/审核提交",
      "dependencies": ["前置任务ID"],
      "estimatedHours": 预估工时,
      "relatedApplication": {
        "type": "authorization/sample/price/partner",
        "name": "关联申请名称"
      }
    }
  ],
  "recommendations": [
    "建议1",
    "建议2"
  ],
  "riskAlerts": [
    "风险提醒1",
    "风险提醒2"
  ]
}
\`\`\`

请确保：
1. 任务分解要细致，每个任务有明确的负责人建议
2. 合理设置任务优先级和依赖关系
3. 标注需要申请授权、样机、价格的任务
4. 识别关键时间节点和风险点
5. 提供实用的建议和风险提醒`;

export async function generateTaskPlan(input: TaskPlanningInput): Promise<TaskPlanResult> {
  // 1. 获取文件解读结果
  const interpretation = await db.query.bidDocumentInterpretations.findFirst({
    where: eq(bidDocumentInterpretations.id, input.interpretationId),
  });

  if (!interpretation) {
    throw new Error('文件解读记录不存在');
  }

  // 2. 获取项目团队成员
  let teamMembers: { id: number; name: string; role: string }[] = [];
  const targetProjectId = input.projectId || interpretation.projectId;
  
  if (targetProjectId) {
    const members = await db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, targetProjectId),
      with: {
        user: true,
      },
    });
    
    teamMembers = members.map(m => ({
      id: m.userId,
      name: m.user.realName || m.user.username,
      role: m.role || '成员',
    }));
  }

  // 3. 如果没有团队成员，获取公司成员作为候选人
  if (teamMembers.length === 0) {
    const users = await db.query.users.findMany({
      limit: 10,
    });
    teamMembers = users.map(u => ({
      id: u.id,
      name: u.realName || u.username,
      role: u.position || '员工',
    }));
  }

  // 4. 准备AI提示词
  const basicInfo = JSON.stringify({
    projectName: interpretation.projectName,
    projectCode: interpretation.projectCode,
    tenderOrganization: interpretation.tenderOrganization,
    tenderAgent: interpretation.tenderAgent,
    projectBudget: interpretation.projectBudget,
    expireTime: interpretation.expireTime,
  }, null, 2);

  const timeNodes = JSON.stringify(interpretation.timeNodes || [], null, 2);
  const qualificationRequirements = JSON.stringify(interpretation.qualificationRequirements || [], null, 2);
  const submissionRequirements = JSON.stringify(interpretation.submissionRequirements || {}, null, 2);
  const teamMembersStr = JSON.stringify(teamMembers, null, 2);

  const prompt = TASK_BREAKDOWN_PROMPT
    .replace('{{basicInfo}}', basicInfo)
    .replace('{{timeNodes}}', timeNodes)
    .replace('{{qualificationRequirements}}', qualificationRequirements)
    .replace('{{submissionRequirements}}', submissionRequirements)
    .replace('{{teamMembers}}', teamMembersStr)
    .replace('{{additionalContext}}', input.additionalContext || '无额外上下文');

  // 5. 调用AI进行任务分解
  const llm = getLLM();
  const response = await llm.generate(
    [
      {
        role: 'system',
        content: '你是一个专业的投标项目任务规划专家，擅长将复杂的投标项目分解为可执行的任务，并合理分配给团队成员。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    {
      temperature: 0.7,
      maxTokens: 4000,
    }
  );

  // 6. 解析AI响应
  const content = response.content || '';
  
  // 提取JSON
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    throw new Error('AI响应格式错误，无法解析任务分解结果');
  }

  try {
    const result: TaskPlanResult = JSON.parse(jsonMatch[1]);
    return result;
  } catch (_e) {
    throw new Error('AI响应JSON解析失败');
  }
}

// ============================================
// 获取可用的文件解读列表
// ============================================

export interface InterpretationForPlanning {
  id: number;
  documentName: string;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  expireTime: Date | null;
  status: string;
  createdAt: Date;
}

export async function getAvailableInterpretations(projectId?: number): Promise<InterpretationForPlanning[]> {
  const conditions = [eq(bidDocumentInterpretations.status, 'completed')];
  
  if (projectId) {
    conditions.push(eq(bidDocumentInterpretations.projectId, projectId));
  }

  const interpretations = await db.query.bidDocumentInterpretations.findMany({
    where: and(...conditions),
    columns: {
      id: true,
      documentName: true,
      projectName: true,
      projectCode: true,
      tenderOrganization: true,
      expireTime: true,
      status: true,
      createdAt: true,
    },
    orderBy: [desc(bidDocumentInterpretations.createdAt)],
    limit: 50,
  });

  return interpretations;
}

// ============================================
// 获取解读详情用于任务规划
// ============================================

export interface InterpretationDetailForPlanning {
  id: number;
  documentName: string;
  projectName: string | null;
  projectCode: string | null;
  tenderOrganization: string | null;
  expireTime: Date | null;
  timeNodes: any;
  qualificationRequirements: any;
  submissionRequirements: any;
  feeInfo: any;
}

export async function getInterpretationForPlanning(id: number): Promise<InterpretationDetailForPlanning | null> {
  const interpretation = await db.query.bidDocumentInterpretations.findFirst({
    where: eq(bidDocumentInterpretations.id, id),
    columns: {
      id: true,
      documentName: true,
      projectName: true,
      projectCode: true,
      tenderOrganization: true,
      expireTime: true,
      timeNodes: true,
      qualificationRequirements: true,
      submissionRequirements: true,
      feeInfo: true,
    },
  });

  return interpretation || null;
}

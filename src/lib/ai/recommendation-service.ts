/**
 * AI智能推荐服务
 * 使用大语言模型提供智能推荐功能
 */

import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// ============================================
// 推荐类型
// ============================================

export enum RecommendationType {
  PROJECT_TEMPLATE = 'project_template',
  DOCUMENT_TEMPLATE = 'document_template',
  BEST_PRACTICE = 'best_practice',
  RISK_ASSESSMENT = 'risk_assessment',
  COMPETITIVE_ANALYSIS = 'competitive_analysis',
  OPTIMIZATION_SUGGESTION = 'optimization_suggestion',
}

// ============================================
// 推荐结果
// ============================================

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  content: string;
  confidence: number; // 0-1
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  createdAt: Date;
}

// ============================================
// 项目推荐请求
// ============================================

export interface ProjectRecommendationRequest {
  projectName?: string;
  industry?: string;
  budget?: number;
  deadline?: Date;
  requirements?: string;
  previousProjects?: Array<{
    name: string;
    success: boolean;
  }>;
  teamSize?: number;
  complexity?: 'simple' | 'medium' | 'complex';
}

// ============================================
// 文档模板推荐请求
// ============================================

export interface DocumentTemplateRecommendationRequest {
  documentType: 'bid' | 'contract' | 'proposal' | 'report';
  industry?: string;
  clientType?: 'government' | 'enterprise' | 'individual';
  projectScale?: 'small' | 'medium' | 'large';
  requirements?: string;
}

// ============================================
// 风险评估推荐请求
// ============================================

export interface RiskAssessmentRequest {
  projectId?: string;
  projectDetails?: {
    budget: number;
    timeline: number; // days
    teamSize: number;
    complexity: 'low' | 'medium' | 'high';
  };
  externalFactors?: {
    marketConditions?: string;
    competition?: string;
    regulatory?: string;
  };
}

// ============================================
// AI推荐服务
// ============================================

export class AIRecommendationService {
  private client: LLMClient;

  constructor(customHeaders?: Record<string, string>) {
    const config = new Config();
    this.client = new LLMClient(config, customHeaders);
  }

  /**
   * 生成项目推荐
   */
  async getProjectRecommendations(
    request: ProjectRecommendationRequest,
    limit: number = 5
  ): Promise<Recommendation[]> {
    const systemPrompt = `你是一个专业的投标管理顾问，擅长为企业提供项目推荐和建议。
请根据用户提供的项目信息，给出专业的推荐建议。

输出格式要求：
- 每个推荐包含：标题、描述、详细建议、置信度(0-1)、优先级(low/medium/high/urgent)
- 置信度基于信息完整性和推荐准确性
- 优先级基于推荐的重要性和紧迫性
- 返回JSON数组格式`;

    const userPrompt = this.buildProjectPrompt(request);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: `请为以下项目提供${limit}个推荐建议：\n\n${userPrompt}\n\n请以JSON数组格式返回推荐结果。`,
      },
    ];

    try {
      const response = await this.client.invoke(messages, {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7,
      });

      // 解析响应
      const recommendations = this.parseRecommendations(
        response.content,
        RecommendationType.PROJECT_TEMPLATE
      );

      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('Project recommendations error:', error);
      throw error;
    }
  }

  /**
   * 生成文档模板推荐
   */
  async getDocumentTemplateRecommendations(
    request: DocumentTemplateRecommendationRequest,
    limit: number = 3
  ): Promise<Recommendation[]> {
    const systemPrompt = `你是一个专业的投标文档专家，擅长为企业提供文档模板推荐。
请根据用户需求，推荐最适合的文档模板。

输出格式要求：
- 每个推荐包含：模板名称、适用场景、详细说明、推荐理由、置信度(0-1)
- 返回JSON数组格式`;

    const userPrompt = `文档类型：${request.documentType}\n行业：${request.industry || '不限'}\n客户类型：${request.clientType || '不限'}\n项目规模：${request.projectScale || '不限'}\n需求：${request.requirements || '无特殊需求'}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: `请为以下需求推荐${limit}个文档模板：\n\n${userPrompt}\n\n请以JSON数组格式返回推荐结果。`,
      },
    ];

    try {
      const response = await this.client.invoke(messages, {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7,
      });

      const recommendations = this.parseRecommendations(
        response.content,
        RecommendationType.DOCUMENT_TEMPLATE
      );

      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('Document template recommendations error:', error);
      throw error;
    }
  }

  /**
   * 生成风险评估
   */
  async getRiskAssessment(
    request: RiskAssessmentRequest
  ): Promise<Recommendation[]> {
    const systemPrompt = `你是一个专业的风险管理顾问，擅长识别和评估项目风险。
请根据项目信息，提供全面的风险评估和建议。

风险类型包括：
- 预算风险
- 时间风险
- 资源风险
- 技术风险
- 市场风险
- 法律合规风险

输出格式要求：
- 每个风险包含：风险类型、风险描述、影响程度、发生概率、应对措施、优先级
- 返回JSON数组格式`;

    const userPrompt = this.buildRiskPrompt(request);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: `请对以下项目进行风险评估：\n\n${userPrompt}\n\n请以JSON数组格式返回评估结果。`,
      },
    ];

    try {
      const response = await this.client.invoke(messages, {
        model: 'doubao-seed-2-0-pro-260215',
        thinking: 'enabled',
        temperature: 0.7,
      });

      const recommendations = this.parseRecommendations(
        response.content,
        RecommendationType.RISK_ASSESSMENT
      );

      return recommendations;
    } catch (error) {
      console.error('Risk assessment error:', error);
      throw error;
    }
  }

  /**
   * 获取最佳实践建议
   */
  async getBestPractices(
    context: {
      projectPhase: 'planning' | 'execution' | 'review' | 'delivery';
      industry?: string;
      challenges?: string[];
    },
    limit: number = 5
  ): Promise<Recommendation[]> {
    const systemPrompt = `你是一个专业的项目管理顾问，擅长提供最佳实践建议。
请根据项目阶段和挑战，提供针对性的最佳实践建议。

输出格式要求：
- 每个建议包含：实践名称、适用场景、实施步骤、预期效果、置信度(0-1)
- 返回JSON数组格式`;

    const userPrompt = `项目阶段：${context.projectPhase}\n行业：${context.industry || '通用'}\n挑战：${context.challenges?.join(', ') || '无特定挑战'}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: `请为以下情况提供${limit}个最佳实践建议：\n\n${userPrompt}\n\n请以JSON数组格式返回推荐结果。`,
      },
    ];

    try {
      const response = await this.client.invoke(messages, {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7,
      });

      const recommendations = this.parseRecommendations(
        response.content,
        RecommendationType.BEST_PRACTICE
      );

      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('Best practices error:', error);
      throw error;
    }
  }

  /**
   * 获取优化建议
   */
  async getOptimizationSuggestions(
    context: {
      projectName?: string;
      currentProcess?: string;
      painPoints?: string[];
    },
    limit: number = 5
  ): Promise<Recommendation[]> {
    const systemPrompt = `你是一个专业的流程优化顾问，擅长识别改进机会和提供优化建议。
请根据当前流程和痛点，提供可执行的优化建议。

输出格式要求：
- 每个建议包含：优化点、问题描述、改进方案、预期收益、实施难度、优先级
- 返回JSON数组格式`;

    const userPrompt = `项目：${context.projectName || '通用项目'}\n当前流程：${context.currentProcess || '未提供'}\n痛点：${context.painPoints?.join(', ') || '无特定痛点'}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: `请为以下情况提供${limit}个优化建议：\n\n${userPrompt}\n\n请以JSON数组格式返回推荐结果。`,
      },
    ];

    try {
      const response = await this.client.invoke(messages, {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7,
      });

      const recommendations = this.parseRecommendations(
        response.content,
        RecommendationType.OPTIMIZATION_SUGGESTION
      );

      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('Optimization suggestions error:', error);
      throw error;
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  private buildProjectPrompt(request: ProjectRecommendationRequest): string {
    const parts: string[] = [];

    if (request.projectName) parts.push(`项目名称：${request.projectName}`);
    if (request.industry) parts.push(`行业：${request.industry}`);
    if (request.budget) parts.push(`预算：${request.budget}元`);
    if (request.deadline) parts.push(`截止日期：${request.deadline.toISOString().split('T')[0]}`);
    if (request.teamSize) parts.push(`团队规模：${request.teamSize}人`);
    if (request.complexity) parts.push(`复杂度：${request.complexity}`);
    if (request.requirements) parts.push(`需求：${request.requirements}`);
    if (request.previousProjects?.length) {
      parts.push(`历史项目：\n${request.previousProjects.map(p => `- ${p.name} (${p.success ? '成功' : '失败'})`).join('\n')}`);
    }

    return parts.join('\n');
  }

  private buildRiskPrompt(request: RiskAssessmentRequest): string {
    const parts: string[] = [];

    if (request.projectDetails) {
      const { budget, timeline, teamSize, complexity } = request.projectDetails;
      parts.push(`预算：${budget}元`);
      parts.push(`工期：${timeline}天`);
      parts.push(`团队规模：${teamSize}人`);
      parts.push(`复杂度：${complexity}`);
    }

    if (request.externalFactors) {
      const { marketConditions, competition, regulatory } = request.externalFactors;
      if (marketConditions) parts.push(`市场环境：${marketConditions}`);
      if (competition) parts.push(`竞争情况：${competition}`);
      if (regulatory) parts.push(`法规要求：${regulatory}`);
    }

    return parts.join('\n');
  }

  private parseRecommendations(
    content: string,
    type: RecommendationType
  ): Recommendation[] {
    try {
      // 尝试提取JSON部分
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const data = JSON.parse(jsonMatch[0]);

      return data.map((item: any, index: number) => ({
        id: `${type}_${Date.now()}_${index}`,
        type,
        title: item.title || item.模板名称 || item.实践名称 || item.优化点 || item.风险类型 || '未命名',
        description: item.description || item.适用场景 || item.问题描述 || item.风险描述 || '',
        content: item.content || item.详细建议 || item.实施步骤 || item.改进方案 || item.应对措施 || '',
        confidence: item.confidence || 0.8,
        priority: item.priority || 'medium',
        tags: item.tags || [],
        createdAt: new Date(),
      }));
    } catch (error) {
      console.error('Parse recommendations error:', error);
      return [];
    }
  }
}



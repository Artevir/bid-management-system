/**
 * 投标文档一键生成服务
 * 支持AI生成整篇投标文档，包含审核流程和数据自动填充
 */

import { db } from '@/db';
import {
  bidDocuments,
  bidChapters,
  bidDocumentFramework,
  bidDocumentInterpretations,
  companies,
  companyFiles,
  partnerApplications,
  partnerMaterials,
  projects,
  users,
} from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getLLM, createCozeAdapterWithHeaders, ChatMessage } from '@/lib/llm';
import { getDocumentFramework } from '@/lib/interpretation/service';
import { generationProgressService } from './generation-progress-service';

// ============================================
// 类型定义
// ============================================

export interface OneClickGenerateParams {
  projectId: number;
  documentName: string;
  interpretationId: number; // 招标文件解读ID
  companyIds: number[]; // 投标主体公司ID列表
  partnerApplicationIds?: number[]; // 友司支持申请ID列表
  generateOptions: {
    includeQualification: boolean; // 是否生成资质部分
    includePerformance: boolean; // 是否生成业绩部分
    includeTechnical: boolean; // 是否生成技术方案
    includeBusiness: boolean; // 是否生成商务部分
    style: 'formal' | 'technical' | 'concise';
  };
}

export interface GeneratedChapter {
  chapterId: number;
  title: string;
  content: string;
  wordCount: number;
  source: 'ai_generated' | 'company_data' | 'partner_data' | 'template';
  needsReview: boolean;
  placeholders?: PlaceholderItem[];
}

export interface PlaceholderItem {
  field: string;
  description: string;
  currentValue?: string;
  suggestedValue?: string;
  source: 'company' | 'partner' | 'manual';
}

export interface GenerationResult {
  documentId: number;
  status: 'draft' | 'pending_review' | 'reviewing' | 'approved' | 'rejected';
  totalChapters: number;
  generatedChapters: number;
  totalWordCount: number;
  placeholders: PlaceholderItem[];
  reviewId?: number;
}

export interface DocumentReview {
  id: number;
  documentId: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewerId?: number;
  reviewerName?: string;
  reviewComments?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

// ============================================
// 一键生成服务
// ============================================

export const oneClickGenerateService = {
  /**
   * 一键生成投标文档
   */
  async generateDocument(
    params: OneClickGenerateParams,
    userId: number,
    customHeaders?: Record<string, string>
  ): Promise<GenerationResult> {
    const { projectId, documentName, interpretationId, companyIds, partnerApplicationIds, generateOptions } = params;

    // 1. 获取招标文件解读数据
    const interpretation = await this.getInterpretationData(interpretationId);
    if (!interpretation) {
      throw new Error('招标文件解读不存在');
    }

    // 2. 获取文档框架
    const framework = await getDocumentFramework(interpretationId);
    if (!framework || framework.length === 0) {
      throw new Error('文档框架不存在，请先解析招标文件');
    }

    // 3. 获取公司信息
    const companiesData = await this.getCompaniesData(companyIds);

    // 4. 获取友司支持材料（如果有）
    let partnerMaterialsData: any[] = [];
    if (partnerApplicationIds && partnerApplicationIds.length > 0) {
      partnerMaterialsData = await this.getPartnerMaterials(partnerApplicationIds);
    }

    // 5. 创建投标文档
    const [document] = await db
      .insert(bidDocuments)
      .values({
        projectId,
        name: documentName,
        status: 'draft',
        createdBy: userId,
        totalChapters: 0,
        completedChapters: 0,
        wordCount: 0,
        progress: 0,
      })
      .returning();

    // 6. 初始化生成进度
    generationProgressService.initProgress(document.id, framework.length);

    // 7. 创建审核记录
    const reviewId = await this.createDocumentReview(document.id, userId);

    // 8. 生成章节内容
    const placeholders: PlaceholderItem[] = [];
    let totalWordCount = 0;
    let generatedCount = 0;
    const totalChapters = framework.length;

    for (let i = 0; i < framework.length; i++) {
      const chapter = framework[i];

      // 更新进度：开始章节
      generationProgressService.startChapter(
        document.id,
        chapter.chapterTitle,
        i + 1,
        totalChapters
      );

      try {
        const result = await this.generateChapter(
          document.id,
          chapter,
          {
            interpretation,
            companiesData,
            partnerMaterials: partnerMaterialsData,
            generateOptions,
          },
          userId,
          customHeaders
        );

        if (result) {
          totalWordCount += result.wordCount;
          generatedCount++;

          // 更新进度：完成章节
          generationProgressService.completeChapter(
            document.id,
            chapter.chapterTitle,
            result.wordCount
          );

          if (result.placeholders) {
            placeholders.push(...result.placeholders);
          }
        }
      } catch (error: any) {
        // 记录错误但继续生成
        generationProgressService.recordError(
          document.id,
          chapter.chapterTitle,
          error.message || '生成失败'
        );
      }
    }

    // 9. 标记生成完成
    generationProgressService.completeGeneration(document.id);

    // 10. 更新文档状态
    await db
      .update(bidDocuments)
      .set({
        totalChapters: generatedCount,
        completedChapters: generatedCount,
        wordCount: totalWordCount,
        progress: 100,
        status: 'reviewing', // 进入审核状态
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, document.id));

    return {
      documentId: document.id,
      status: 'reviewing',
      totalChapters: generatedCount,
      generatedChapters: generatedCount,
      totalWordCount,
      placeholders,
      reviewId,
    };
  },

  /**
   * 获取招标文件解读数据
   */
  async getInterpretationData(interpretationId: number) {
    const [interpretation] = await db
      .select()
      .from(bidDocumentInterpretations)
      .where(eq(bidDocumentInterpretations.id, interpretationId))
      .limit(1);

    if (!interpretation) return null;

    // 解析JSON字段
    return {
      ...interpretation,
      basicInfo: interpretation.basicInfo ? JSON.parse(interpretation.basicInfo) : null,
      qualificationRequirements: interpretation.qualificationRequirements
        ? JSON.parse(interpretation.qualificationRequirements)
        : null,
      personnelRequirements: interpretation.personnelRequirements
        ? JSON.parse(interpretation.personnelRequirements)
        : null,
      docRequirements: interpretation.docRequirements
        ? JSON.parse(interpretation.docRequirements)
        : null,
      scoringItems: await this.getScoringItems(interpretationId),
      technicalSpecs: await this.getTechnicalSpecs(interpretationId),
    };
  },

  /**
   * 获取评分项
   */
  async getScoringItems(interpretationId: number) {
    const { bidScoringItems } = await import('@/db/schema');
    return db
      .select()
      .from(bidScoringItems)
      .where(eq(bidScoringItems.interpretationId, interpretationId));
  },

  /**
   * 获取技术规格
   */
  async getTechnicalSpecs(interpretationId: number) {
    const { bidTechnicalSpecs } = await import('@/db/schema');
    return db
      .select()
      .from(bidTechnicalSpecs)
      .where(eq(bidTechnicalSpecs.interpretationId, interpretationId));
  },

  /**
   * 获取公司数据
   */
  async getCompaniesData(companyIds: number[]) {
    const companyList = await db
      .select()
      .from(companies)
      .where(inArray(companies.id, companyIds));

    // 获取每个公司的资质文件
    const companiesWithFiles = await Promise.all(
      companyList.map(async (company) => {
        const files = await db
          .select()
          .from(companyFiles)
          .where(eq(companyFiles.companyId, company.id));

        return {
          ...company,
          files,
        };
      })
    );

    return companiesWithFiles;
  },

  /**
   * 获取友司支持材料
   */
  async getPartnerMaterials(partnerApplicationIds: number[]) {
    const { partnerMaterials: pm } = await import('@/db/schema');

    const applications = await db
      .select()
      .from(partnerApplications)
      .where(inArray(partnerApplications.id, partnerApplicationIds));

    const materials = await db
      .select()
      .from(pm)
      .where(inArray(pm.applicationId, partnerApplicationIds));

    return materials.map((m) => ({
      ...m,
      application: applications.find((a) => a.id === m.applicationId),
    }));
  },

  /**
   * 生成单个章节
   */
  async generateChapter(
    documentId: number,
    chapterData: any,
    context: {
      interpretation: any;
      companiesData: any[];
      partnerMaterials: any[];
      generateOptions: OneClickGenerateParams['generateOptions'];
    },
    userId: number,
    customHeaders?: Record<string, string>
  ): Promise<GeneratedChapter | null> {
    const { interpretation, companiesData, partnerMaterials, generateOptions } = context;

    // 创建章节
    const [chapter] = await db
      .insert(bidChapters)
      .values({
        documentId,
        parentId: null,
        type: this.inferChapterType(chapterData.chapterTitle),
        serialNumber: chapterData.chapterNumber || null,
        title: chapterData.chapterTitle,
        content: '',
        sortOrder: chapterData.sortOrder || 0,
        level: chapterData.level || 1,
        isRequired: true,
        isCompleted: false,
      })
      .returning();

    // 根据章节类型决定生成方式
    const chapterType = this.inferChapterType(chapterData.chapterTitle);
    let content = '';
    let source: GeneratedChapter['source'] = 'ai_generated';
    const placeholders: PlaceholderItem[] = [];

    // 判断是否需要生成此章节
    if (chapterType === 'qualification' && !generateOptions.includeQualification) {
      return null;
    }
    if (chapterType === 'technical' && !generateOptions.includeTechnical) {
      return null;
    }
    if (chapterType === 'business' && !generateOptions.includeBusiness) {
      return null;
    }

    // 资质部分：优先使用公司资质数据
    if (chapterType === 'qualification') {
      const qualResult = await this.generateQualificationContent(
        chapterData,
        interpretation,
        companiesData,
        partnerMaterials,
        generateOptions.style,
        customHeaders
      );
      content = qualResult.content;
      source = qualResult.source;
      placeholders.push(...qualResult.placeholders);
    }
    // 技术方案：AI生成 + 技术规格
    else if (chapterType === 'technical') {
      content = await this.generateTechnicalContent(
        chapterData,
        interpretation,
        generateOptions.style,
        customHeaders
      );
    }
    // 商务部分：AI生成 + 招标要求
    else if (chapterType === 'business') {
      content = await this.generateBusinessContent(
        chapterData,
        interpretation,
        companiesData,
        generateOptions.style,
        customHeaders
      );
    }
    // 其他章节：AI生成
    else {
      content = await this.generateGenericContent(
        chapterData,
        interpretation,
        generateOptions.style,
        customHeaders
      );
    }

    // 更新章节内容
    const wordCount = content.length;
    await db
      .update(bidChapters)
      .set({
        content,
        wordCount,
        isCompleted: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bidChapters.id, chapter.id));

    // 处理子章节
    if (chapterData.children && chapterData.children.length > 0) {
      for (const child of chapterData.children) {
        await this.generateChapter(
          documentId,
          { ...child, parentId: chapter.id, level: (chapterData.level || 1) + 1 },
          context,
          userId,
          customHeaders
        );
      }
    }

    return {
      chapterId: chapter.id,
      title: chapterData.chapterTitle,
      content,
      wordCount,
      source,
      needsReview: source === 'ai_generated',
      placeholders,
    };
  },

  /**
   * 生成资质部分内容
   */
  async generateQualificationContent(
    chapterData: any,
    interpretation: any,
    companiesData: any[],
    partnerMaterials: any[],
    style: string,
    customHeaders?: Record<string, string>
  ): Promise<{ content: string; source: GeneratedChapter['source']; placeholders: PlaceholderItem[] }> {
    const placeholders: PlaceholderItem[] = [];

    // 收集资质要求
    const qualRequirements = interpretation.qualificationRequirements || [];

    // 收集公司资质信息
    let companyQualContent = '';
    for (const company of companiesData) {
      const qualFiles = company.files?.filter(
        (f: any) => f.fileType === 'business_certificate' || f.fileType === 'business_license'
      );

      if (qualFiles && qualFiles.length > 0) {
        companyQualContent += `\n## ${company.name}资质材料\n`;
        qualFiles.forEach((f: any) => {
          companyQualContent += `- ${f.fileName}\n`;
        });
      }
    }

    // 收集友司资质材料
    let partnerQualContent = '';
    const qualMaterials = partnerMaterials.filter(
      (m) => m.category === 'qualification' || m.category === 'basic'
    );
    if (qualMaterials.length > 0) {
      partnerQualContent = '\n## 友司资质材料\n';
      qualMaterials.forEach((m: any) => {
        partnerQualContent += `- ${m.materialName}（来源：${m.application?.partnerCompanyName || '友司'}）\n`;
        if (m.fileUrl) {
          partnerQualContent += `  文件：${m.fileUrl}\n`;
        }
      });
    }

    // AI整合生成
    const llm = customHeaders ? createCozeAdapterWithHeaders(customHeaders) : getLLM();

    const systemPrompt = `你是一个专业的标书编写专家。请根据招标要求和可用资质材料，编写资质响应章节。

要求：
1. 准确响应招标文件中的资质要求
2. 如实列出公司已具备的资质
3. 对于缺少的资质，标注【待补充】
4. 语言专业、规范`;

    const userPrompt = `章节标题：${chapterData.chapterTitle}

招标资质要求：
${JSON.stringify(qualRequirements, null, 2)}

公司资质材料：
${companyQualContent || '暂无'}

友司支持资质材料：
${partnerQualContent || '暂无'}

请编写本章节内容：`;

    let content = '';
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const stream = llm.generateStream(messages, { temperature: 0.7 });
      for await (const chunk of stream) {
        if (!chunk.done && chunk.content) {
          content += chunk.content;
        }
      }
    } catch (error) {
      console.error('AI generate error:', error);
      content = `${chapterData.chapterTitle}\n\n【待生成内容】\n\n资质要求：\n${JSON.stringify(qualRequirements, null, 2)}`;
    }

    // 提取占位符
    const placeholderRegex = /【([^】]+)】/g;
    let match;
    while ((match = placeholderRegex.exec(content)) !== null) {
      placeholders.push({
        field: match[1],
        description: `需要补充：${match[1]}`,
        source: 'manual',
      });
    }

    return {
      content,
      source: companyQualContent || partnerQualContent ? 'company_data' : 'ai_generated',
      placeholders,
    };
  },

  /**
   * 生成技术方案内容
   */
  async generateTechnicalContent(
    chapterData: any,
    interpretation: any,
    style: string,
    customHeaders?: Record<string, string>
  ): Promise<string> {
    const llm = customHeaders ? createCozeAdapterWithHeaders(customHeaders) : getLLM();

    const technicalSpecs = interpretation.technicalSpecs || [];
    const scoringItems = interpretation.scoringItems?.filter(
      (item: any) => item.scoringCategory === 'technical'
    ) || [];

    const systemPrompt = `你是一个专业的技术方案编写专家。请根据招标技术要求和评分标准，编写技术方案章节。

要求：
1. 严格响应招标技术规格要求
2. 突出技术优势和特点
3. 针对评分要点编写，争取高分
4. 语言专业、技术准确`;

    const userPrompt = `章节标题：${chapterData.chapterTitle}

技术规格要求：
${JSON.stringify(technicalSpecs, null, 2)}

技术评分项：
${JSON.stringify(scoringItems, null, 2)}

章节内容要求：
${chapterData.contentRequirement || '按照招标文件要求编写'}

请编写本章节内容：`;

    let content = '';
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const stream = llm.generateStream(messages, { temperature: 0.7 });
      for await (const chunk of stream) {
        if (!chunk.done && chunk.content) {
          content += chunk.content;
        }
      }
    } catch (error) {
      console.error('AI generate error:', error);
      content = `${chapterData.chapterTitle}\n\n【待生成技术内容】`;
    }

    return content;
  },

  /**
   * 生成商务部分内容
   */
  async generateBusinessContent(
    chapterData: any,
    interpretation: any,
    companiesData: any[],
    style: string,
    customHeaders?: Record<string, string>
  ): Promise<string> {
    const llm = customHeaders ? createCozeAdapterWithHeaders(customHeaders) : getLLM();

    // 提取公司基本信息
    const companyInfo = companiesData.map((c) => ({
      name: c.name,
      address: c.registerAddress,
      legalPerson: c.legalPersonName,
      contact: c.contactPersonName,
      phone: c.contactPersonPhone,
    }));

    const systemPrompt = `你是一个专业的商务文件编写专家。请根据招标要求和公司信息，编写商务响应章节。

要求：
1. 准确填写公司信息
2. 响应商务要求
3. 语言正式、规范`;

    const userPrompt = `章节标题：${chapterData.chapterTitle}

投标公司信息：
${JSON.stringify(companyInfo, null, 2)}

招标商务要求：
${JSON.stringify(interpretation.docRequirements || {}, null, 2)}

请编写本章节内容：`;

    let content = '';
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const stream = llm.generateStream(messages, { temperature: 0.7 });
      for await (const chunk of stream) {
        if (!chunk.done && chunk.content) {
          content += chunk.content;
        }
      }
    } catch (error) {
      console.error('AI generate error:', error);
      content = `${chapterData.chapterTitle}\n\n【待生成商务内容】`;
    }

    return content;
  },

  /**
   * 生成通用章节内容
   */
  async generateGenericContent(
    chapterData: any,
    interpretation: any,
    style: string,
    customHeaders?: Record<string, string>
  ): Promise<string> {
    const llm = customHeaders ? createCozeAdapterWithHeaders(customHeaders) : getLLM();

    const systemPrompt = `你是一个专业的标书编写专家。请根据章节要求编写内容。

要求：
1. 内容完整、专业
2. 语言规范
3. 符合招标文件要求`;

    const userPrompt = `章节标题：${chapterData.chapterTitle}

项目名称：${interpretation.projectName || ''}
招标单位：${interpretation.tenderOrganization || ''}

章节内容要求：
${chapterData.contentRequirement || '按照招标文件要求编写'}

请编写本章节内容：`;

    let content = '';
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const stream = llm.generateStream(messages, { temperature: 0.7 });
      for await (const chunk of stream) {
        if (!chunk.done && chunk.content) {
          content += chunk.content;
        }
      }
    } catch (error) {
      console.error('AI generate error:', error);
      content = `${chapterData.chapterTitle}\n\n【待生成内容】`;
    }

    return content;
  },

  /**
   * 推断章节类型
   */
  inferChapterType(title: string): 'cover' | 'toc' | 'business' | 'technical' | 'qualification' | 'price' | 'appendix' | null {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('资质') || titleLower.includes('资格')) {
      return 'qualification';
    }
    if (titleLower.includes('技术')) {
      return 'technical';
    }
    if (titleLower.includes('商务') || titleLower.includes('报价') || titleLower.includes('价格')) {
      return 'business';
    }
    if (titleLower.includes('业绩')) {
      return 'business';
    }
    if (titleLower.includes('附录') || titleLower.includes('附件')) {
      return 'appendix';
    }
    if (titleLower.includes('封面')) {
      return 'cover';
    }
    if (titleLower.includes('目录')) {
      return 'toc';
    }

    return null;
  },

  /**
   * 创建文档审核记录
   */
  async createDocumentReview(documentId: number, userId: number): Promise<number> {
    // 使用现有的审核表创建审核记录
    const { bidDocumentReviews } = await import('@/db/schema');

    const [review] = await db
      .insert(bidDocumentReviews)
      .values({
        documentId,
        reviewType: 'ai_generation',
        status: 'pending',
        submittedBy: userId,
        submittedAt: new Date(),
      })
      .returning();

    return review.id;
  },

  /**
   * 获取待审核的AI生成文档
   */
  async getPendingReviews(projectId?: number) {
    const { bidDocumentReviews } = await import('@/db/schema');

    const conditions = [eq(bidDocumentReviews.status, 'pending')];

    const reviews = await db
      .select({
        review: bidDocumentReviews,
        document: bidDocuments,
      })
      .from(bidDocumentReviews)
      .innerJoin(bidDocuments, eq(bidDocumentReviews.documentId, bidDocuments.id))
      .where(and(...conditions))
      .orderBy(desc(bidDocumentReviews.submittedAt));

    return reviews;
  },

  /**
   * 审核AI生成文档
   */
  async reviewDocument(
    documentId: number,
    reviewId: number,
    params: {
      result: 'approved' | 'rejected';
      comments?: string;
      chapterModifications?: Array<{
        chapterId: number;
        content: string;
      }>;
    },
    reviewerId: number
  ): Promise<void> {
    const { bidDocumentReviews } = await import('@/db/schema');

    // 获取审核人信息
    const [reviewer] = await db
      .select()
      .from(users)
      .where(eq(users.id, reviewerId))
      .limit(1);

    // 更新审核记录
    await db
      .update(bidDocumentReviews)
      .set({
        status: params.result,
        reviewerId,
        reviewerName: reviewer?.realName || '',
        reviewComments: params.comments || null,
        reviewedAt: new Date(),
      })
      .where(eq(bidDocumentReviews.id, reviewId));

    // 如果有章节修改，更新章节内容
    if (params.chapterModifications) {
      for (const mod of params.chapterModifications) {
        await db
          .update(bidChapters)
          .set({
            content: mod.content,
            wordCount: mod.content.length,
            updatedAt: new Date(),
          })
          .where(eq(bidChapters.id, mod.chapterId));
      }
    }

    // 更新文档状态
    const newStatus = params.result === 'approved' ? 'approved' : 'rejected';
    await db
      .update(bidDocuments)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, documentId));
  },

  /**
   * 获取可用的数据源（用于前端选择）
   */
  async getAvailableDataSources(projectId: number) {
    // 获取项目关联的公司
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    // 获取友司支持申请
    const partnerApps = await db
      .select()
      .from(partnerApplications)
      .where(
        and(
          eq(partnerApplications.projectId, projectId),
          eq(partnerApplications.status, 'completed')
        )
      );

    // 获取所有公司
    const allCompanies = await db
      .select()
      .from(companies)
      .where(eq(companies.isActive, true));

    return {
      companies: allCompanies,
      partnerApplications: partnerApps,
    };
  },
};

export default oneClickGenerateService;

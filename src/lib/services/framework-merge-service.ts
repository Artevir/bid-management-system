/**
 * 文档框架合并服务
 * 负责合并多个公司框架与招标文件框架
 */

// ============================================
// 类型定义
// ============================================

// 基础章节类型（用于合并）
export interface BaseChapter {
  id: number;
  frameworkId?: number;
  parentId?: number | null;
  title: string;
  titleNumber?: string | null;
  level: number;
  order: number;
  isRequired: boolean;
  description?: string | null;
  contentTemplate?: string | null;
  children?: BaseChapter[];
}

// 简化的框架类型，用于合并
export interface SimpleFramework {
  id: number;
  name: string;
  chapters: BaseChapter[];
  company?: {
    id: number;
    name: string;
  };
}

export interface FrameworkMergeOptions {
  /** 招标文件框架ID（可选） */
  tenderFrameworkId?: number;
  /** 公司框架ID列表 */
  companyFrameworkIds: number[];
  /** 合并策略 */
  mergeStrategy: 'tender_first' | 'company_first' | 'smart_merge';
  /** 是否保留原始框架来源信息 */
  preserveSource?: boolean;
}

export interface MergedChapter extends BaseChapter {
  /** 来源标识 */
  source?: 'tender' | 'company' | 'merged';
  /** 来源框架ID */
  sourceFrameworkId?: number;
  /** 来源公司名称 */
  sourceCompanyName?: string;
  /** 合并标记 */
  mergeNote?: string;
}

export interface MergedFramework {
  /** 合并后的框架名称 */
  name: string;
  /** 合并后的章节 */
  chapters: MergedChapter[];
  /** 合并统计 */
  stats: {
    totalChapters: number;
    tenderChapters: number;
    companyChapters: number;
    mergedChapters: number;
  };
  /** 合并详情 */
  details: {
    tenderFramework?: { id: number; name: string };
    companyFrameworks: Array<{ id: number; name: string; companyName: string }>;
  };
}

// ============================================
// 框架合并服务
// ============================================

export const frameworkMergeService = {
  /**
   * 合并多个文档框架
   * @param frameworks 框架列表（已包含章节）
   * @param options 合并选项
   */
  async mergeFrameworks(
    frameworks: SimpleFramework[],
    options: FrameworkMergeOptions
  ): Promise<MergedFramework> {
    const { tenderFrameworkId, companyFrameworkIds, mergeStrategy } = options;

    // 分离招标框架和公司框架
    const tenderFramework = frameworks.find(
      (f) => f.id === tenderFrameworkId
    );
    const companyFrameworks = frameworks.filter(
      (f) => companyFrameworkIds.includes(f.id)
    );

    // 根据策略选择合并方法
    let mergedChapters: MergedChapter[];

    switch (mergeStrategy) {
      case 'tender_first':
        mergedChapters = this.mergeTenderFirst(tenderFramework, companyFrameworks);
        break;
      case 'company_first':
        mergedChapters = this.mergeCompanyFirst(tenderFramework, companyFrameworks);
        break;
      case 'smart_merge':
        mergedChapters = this.smartMerge(tenderFramework, companyFrameworks);
        break;
      default:
        mergedChapters = this.mergeTenderFirst(tenderFramework, companyFrameworks);
    }

    // 计算统计
    const stats = this.calculateStats(mergedChapters);

    // 构建详情
    const details = {
      tenderFramework: tenderFramework
        ? { id: tenderFramework.id, name: tenderFramework.name }
        : undefined,
      companyFrameworks: companyFrameworks.map((f) => ({
        id: f.id,
        name: f.name,
        companyName: f.company?.name || '未知公司',
      })),
    };

    // 生成合并后的框架名称
    const name = this.generateMergedFrameworkName(tenderFramework, companyFrameworks);

    return {
      name,
      chapters: mergedChapters,
      stats,
      details,
    };
  },

  /**
   * 招标文件框架优先策略
   * 以招标文件框架为基础，将公司框架的独特章节作为补充
   */
  mergeTenderFirst(
    tenderFramework?: SimpleFramework,
    companyFrameworks: SimpleFramework[] = []
  ): MergedChapter[] {
    if (!tenderFramework) {
      // 没有招标框架，直接合并公司框架
      return this.mergeCompanyFrameworksOnly(companyFrameworks);
    }

    // 以招标框架为基础
    const result: MergedChapter[] = this.cloneChaptersWithSource(
      tenderFramework.chapters,
      'tender',
      tenderFramework.id
    );

    // 收集公司框架的独特章节
    const tenderTitles = this.collectAllTitles(tenderFramework.chapters);

    for (const companyFw of companyFrameworks) {
      const uniqueChapters = this.findUniqueChapters(
        companyFw.chapters,
        tenderTitles
      );

      // 标记来源
      const markedChapters = this.cloneChaptersWithSource(
        uniqueChapters,
        'company',
        companyFw.id,
        companyFw.company?.name
      );

      // 追加到结果
      if (markedChapters.length > 0) {
        // 创建一个分组章节来组织公司独特内容
        result.push({
          id: -Date.now(), // 临时ID
          frameworkId: companyFw.id,
          parentId: null,
          level: 1,
          order: result.length + 1,
          title: `${companyFw.company?.name || '公司'}专属内容`,
          titleNumber: `${result.length + 1}`,
          isRequired: false,
          description: `来自${companyFw.company?.name || '公司'}文档框架的独特章节`,
          source: 'company',
          sourceFrameworkId: companyFw.id,
          sourceCompanyName: companyFw.company?.name,
          children: markedChapters.map((c, idx) => ({
            ...c,
            level: 2,
            order: idx + 1,
            titleNumber: `${result.length + 1}.${idx + 1}`,
          })),
        });
      }
    }

    return result;
  },

  /**
   * 公司框架优先策略
   * 以公司框架为基础，将招标文件框架的要求章节作为前置
   */
  mergeCompanyFirst(
    tenderFramework?: SimpleFramework,
    companyFrameworks: SimpleFramework[] = []
  ): MergedChapter[] {
    if (!companyFrameworks.length && !tenderFramework) {
      return [];
    }

    const result: MergedChapter[] = [];

    // 如果有招标框架，将其必要章节作为前置
    if (tenderFramework) {
      const requiredChapters = this.filterRequiredChapters(tenderFramework.chapters);
      const tenderChapters = this.cloneChaptersWithSource(
        requiredChapters,
        'tender',
        tenderFramework.id
      );
      result.push(...tenderChapters);
    }

    // 合并公司框架
    const mergedCompanyChapters = this.mergeCompanyFrameworksOnly(companyFrameworks);
    result.push(...mergedCompanyChapters);

    return result;
  },

  /**
   * 智能合并策略
   * 根据章节标题相似度智能合并相同主题的章节
   */
  smartMerge(
    tenderFramework?: SimpleFramework,
    companyFrameworks: SimpleFramework[] = []
  ): MergedChapter[] {
    if (!tenderFramework && !companyFrameworks.length) {
      return [];
    }

    if (!tenderFramework) {
      return this.mergeCompanyFrameworksOnly(companyFrameworks);
    }

    // 以招标框架为基础结构
    const result: MergedChapter[] = this.cloneChaptersWithSource(
      tenderFramework.chapters,
      'tender',
      tenderFramework.id
    );

    // 对于每个公司框架，尝试匹配和合并
    for (const companyFw of companyFrameworks) {
      this.mergeCompanyIntoResult(result, companyFw);
    }

    return result;
  },

  /**
   * 将公司框架合并到结果中（智能匹配）
   */
  mergeCompanyIntoResult(
    result: MergedChapter[],
    companyFw: SimpleFramework
  ): void {
    for (const companyChapter of companyFw.chapters) {
      // 尝试在结果中找到相似的章节
      const matchedChapter = this.findSimilarChapter(result, companyChapter);

      if (matchedChapter) {
        // 找到匹配，合并子章节
        if (companyChapter.children && companyChapter.children.length > 0) {
          if (!matchedChapter.children) {
            matchedChapter.children = [];
          }

          for (const childChapter of companyChapter.children) {
            const matchedChild = this.findSimilarChapter(
              matchedChapter.children,
              childChapter
            );

            if (!matchedChild) {
              // 添加公司独有的子章节
              matchedChapter.children.push(
                this.cloneChapterWithSource(
                  childChapter,
                  'company',
                  companyFw.id,
                  companyFw.company?.name
                )
              );
              // 标记为合并章节
              matchedChapter.source = 'merged';
              matchedChapter.mergeNote = '包含招标文件和公司框架内容';
            }
          }
        }
      } else {
        // 没有找到匹配，作为新章节添加
        result.push(
          this.cloneChapterWithSource(
            companyChapter,
            'company',
            companyFw.id,
            companyFw.company?.name
          )
        );
      }
    }
  },

  /**
   * 查找相似章节（基于标题相似度）
   */
  findSimilarChapter(
    chapters: MergedChapter[],
    target: BaseChapter
  ): MergedChapter | null {
    const normalizedTarget = this.normalizeTitle(target.title);

    for (const chapter of chapters) {
      const normalizedChapter = this.normalizeTitle(chapter.title);

      // 精确匹配
      if (normalizedChapter === normalizedTarget) {
        return chapter;
      }

      // 相似度检查（包含关系）
      if (
        normalizedChapter.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedChapter)
      ) {
        // 相似度阈值：较短字符串占较长字符串的比例
        const shorter = Math.min(normalizedChapter.length, normalizedTarget.length);
        const longer = Math.max(normalizedChapter.length, normalizedTarget.length);
        if (shorter / longer > 0.6) {
          return chapter;
        }
      }
    }

    return null;
  },

  /**
   * 标准化标题（用于比较）
   */
  normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '') // 移除标点和空格
      .trim();
  },

  /**
   * 只合并公司框架
   */
  mergeCompanyFrameworksOnly(
    companyFrameworks: SimpleFramework[]
  ): MergedChapter[] {
    if (companyFrameworks.length === 0) return [];
    if (companyFrameworks.length === 1) {
      return this.cloneChaptersWithSource(
        companyFrameworks[0].chapters,
        'company',
        companyFrameworks[0].id,
        companyFrameworks[0].company?.name
      );
    }

    // 多个公司框架合并
    const result: MergedChapter[] = [];
    const seenTitles = new Set<string>();

    for (const companyFw of companyFrameworks) {
      for (const chapter of companyFw.chapters) {
        const normalizedTitle = this.normalizeTitle(chapter.title);

        if (!seenTitles.has(normalizedTitle)) {
          seenTitles.add(normalizedTitle);
          result.push(
            this.cloneChapterWithSource(
              chapter,
              'company',
              companyFw.id,
              companyFw.company?.name
            )
          );
        } else {
          // 标题已存在，合并子章节
          const existingChapter = result.find(
            (c) => this.normalizeTitle(c.title) === normalizedTitle
          );
          if (existingChapter && chapter.children) {
            if (!existingChapter.children) {
              existingChapter.children = [];
            }
            for (const child of chapter.children) {
              const normalizedChildTitle = this.normalizeTitle(child.title);
              if (
                !existingChapter.children.some(
                  (c) => this.normalizeTitle(c.title) === normalizedChildTitle
                )
              ) {
                existingChapter.children.push(
                  this.cloneChapterWithSource(
                    child,
                    'company',
                    companyFw.id,
                    companyFw.company?.name
                  )
                );
              }
            }
            existingChapter.source = 'merged';
          }
        }
      }
    }

    return result;
  },

  /**
   * 克隆章节并标记来源
   */
  cloneChaptersWithSource(
    chapters: BaseChapter[],
    source: 'tender' | 'company' | 'merged',
    sourceFrameworkId: number,
    sourceCompanyName?: string
  ): MergedChapter[] {
    return chapters.map((chapter) =>
      this.cloneChapterWithSource(chapter, source, sourceFrameworkId, sourceCompanyName)
    );
  },

  /**
   * 克隆单个章节并标记来源
   */
  cloneChapterWithSource(
    chapter: BaseChapter,
    source: 'tender' | 'company' | 'merged',
    sourceFrameworkId: number,
    sourceCompanyName?: string
  ): MergedChapter {
    const cloned: MergedChapter = {
      id: -Date.now() - Math.random(), // 生成临时ID
      frameworkId: chapter.frameworkId,
      parentId: chapter.parentId,
      level: chapter.level,
      order: chapter.order,
      title: chapter.title,
      titleNumber: chapter.titleNumber,
      isRequired: chapter.isRequired ?? true,
      description: chapter.description,
      contentTemplate: chapter.contentTemplate,
      source,
      sourceFrameworkId,
      sourceCompanyName,
      children: chapter.children
        ? this.cloneChaptersWithSource(
            chapter.children,
            source,
            sourceFrameworkId,
            sourceCompanyName
          )
        : undefined,
    };
    return cloned;
  },

  /**
   * 收集所有章节标题
   */
  collectAllTitles(chapters: BaseChapter[]): Set<string> {
    const titles = new Set<string>();
    const collect = (chapterList: BaseChapter[]) => {
      for (const chapter of chapterList) {
        titles.add(this.normalizeTitle(chapter.title));
        if (chapter.children) {
          collect(chapter.children);
        }
      }
    };
    collect(chapters);
    return titles;
  },

  /**
   * 查找独特章节（不存在于已有标题集合中）
   */
  findUniqueChapters(
    chapters: BaseChapter[],
    existingTitles: Set<string>
  ): BaseChapter[] {
    const unique: BaseChapter[] = [];

    for (const chapter of chapters) {
      const normalizedTitle = this.normalizeTitle(chapter.title);

      if (!existingTitles.has(normalizedTitle)) {
        unique.push(chapter);
      } else if (chapter.children && chapter.children.length > 0) {
        // 即使标题匹配，也检查子章节
        const uniqueChildren = this.findUniqueChapters(chapter.children, existingTitles);
        if (uniqueChildren.length > 0) {
          unique.push({
            ...chapter,
            children: uniqueChildren,
          });
        }
      }
    }

    return unique;
  },

  /**
   * 过滤必要章节
   */
  filterRequiredChapters(
    chapters: BaseChapter[]
  ): BaseChapter[] {
    return chapters
      .filter((c) => c.isRequired)
      .map((chapter) => ({
        ...chapter,
        children: chapter.children
          ? this.filterRequiredChapters(chapter.children)
          : undefined,
      }));
  },

  /**
   * 计算统计信息
   */
  calculateStats(chapters: MergedChapter[]): {
    totalChapters: number;
    tenderChapters: number;
    companyChapters: number;
    mergedChapters: number;
  } {
    let totalChapters = 0;
    let tenderChapters = 0;
    let companyChapters = 0;
    let mergedChapters = 0;

    const count = (chapterList: MergedChapter[]) => {
      for (const chapter of chapterList) {
        totalChapters++;
        if (chapter.source === 'tender') tenderChapters++;
        else if (chapter.source === 'company') companyChapters++;
        else if (chapter.source === 'merged') mergedChapters++;

        if (chapter.children) {
          count(chapter.children);
        }
      }
    };

    count(chapters);

    return {
      totalChapters,
      tenderChapters,
      companyChapters,
      mergedChapters,
    };
  },

  /**
   * 生成合并后的框架名称
   */
  generateMergedFrameworkName(
    tenderFramework?: SimpleFramework,
    companyFrameworks: SimpleFramework[] = []
  ): string {
    const parts: string[] = [];

    if (tenderFramework) {
      parts.push('招标文件框架');
    }

    if (companyFrameworks.length > 0) {
      const companyNames = companyFrameworks
        .map((f) => f.company?.name || '未知公司')
        .filter((name, idx, arr) => arr.indexOf(name) === idx) // 去重
        .slice(0, 3); // 最多显示3个公司名

      if (companyNames.length > 0) {
        parts.push(`${companyNames.join('+')}框架`);
      }
    }

    if (parts.length === 0) {
      return '合并框架';
    }

    return parts.join(' + ');
  },
};

export default frameworkMergeService;

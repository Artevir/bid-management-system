/**
 * 文档版本对比服务
 * 支持版本间差异对比、变更追踪
 */

import { db } from '@/db';
import { bidDocuments, bidChapters, documentGenerationHistories, users } from '@/db/schema';
import { eq, and as _and, desc, inArray as _inArray } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface DocumentVersion {
  id: number;
  documentId: number;
  version: number;
  name: string;
  description?: string;
  createdBy: number;
  creatorName?: string;
  createdAt: Date;
  totalWordCount: number;
  chapterCount: number;
  chapters: ChapterSnapshot[];
}

export interface ChapterSnapshot {
  chapterId: number;
  title: string;
  content: string;
  wordCount: number;
  version: number;
  createdAt: Date;
}

export interface DiffResult {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  chapterId: number;
  chapterTitle: string;
  changes: TextChange[];
  stats: {
    addedLines: number;
    removedLines: number;
    modifiedLines: number;
    wordCountDiff: number;
  };
}

export interface TextChange {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber: number;
}

export interface CompareResult {
  documentId: number;
  version1: DocumentVersion;
  version2: DocumentVersion;
  summary: {
    addedChapters: number;
    removedChapters: number;
    modifiedChapters: number;
    unchangedChapters: number;
    totalWordCountDiff: number;
  };
  chapterDiffs: DiffResult[];
}

// ============================================
// 版本对比服务
// ============================================

export const versionCompareService = {
  /**
   * 创建版本快照
   */
  async createVersionSnapshot(
    documentId: number,
    name: string,
    description: string | undefined,
    userId: number
  ): Promise<number> {
    // 获取当前文档
    const [document] = await db
      .select()
      .from(bidDocuments)
      .where(eq(bidDocuments.id, documentId))
      .limit(1);

    if (!document) {
      throw new Error('文档不存在');
    }

    // 获取所有章节
    const chapters = await db
      .select()
      .from(bidChapters)
      .where(eq(bidChapters.documentId, documentId))
      .orderBy(bidChapters.sortOrder);

    // 获取最新版本号
    const histories = await db
      .select()
      .from(documentGenerationHistories)
      .where(eq(documentGenerationHistories.documentId, documentId))
      .orderBy(desc(documentGenerationHistories.version))
      .limit(1);

    const newVersion = histories.length > 0 ? (histories[0].version || 0) + 1 : 1;

    // 保存章节快照（存储在generationConfig中）
    const chapterSnapshots: ChapterSnapshot[] = chapters.map((ch) => ({
      chapterId: ch.id,
      title: ch.title,
      content: ch.content || '',
      wordCount: ch.wordCount || 0,
      version: newVersion,
      createdAt: new Date(),
    }));

    // 创建版本记录
    const [history] = await db
      .insert(documentGenerationHistories)
      .values({
        documentId,
        version: newVersion,
        generationConfig: JSON.stringify({
          name,
          description,
          chapters: chapterSnapshots,
          totalWordCount: document.wordCount || 0,
          chapterCount: chapters.length,
        }),
        companyIds: null,
        interpretationId: null,
        status: 'completed',
        totalChapters: chapters.length,
        generatedChapters: chapters.length,
        totalWordCount: document.wordCount || 0,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 0,
        createdBy: userId,
      })
      .returning();

    return history.id;
  },

  /**
   * 获取文档所有版本
   */
  async getDocumentVersions(documentId: number): Promise<DocumentVersion[]> {
    const histories = await db
      .select({
        id: documentGenerationHistories.id,
        documentId: documentGenerationHistories.documentId,
        version: documentGenerationHistories.version,
        generationConfig: documentGenerationHistories.generationConfig,
        totalWordCount: documentGenerationHistories.totalWordCount,
        totalChapters: documentGenerationHistories.totalChapters,
        createdBy: documentGenerationHistories.createdBy,
        createdAt: documentGenerationHistories.createdAt,
        creatorName: users.realName,
      })
      .from(documentGenerationHistories)
      .innerJoin(users, eq(documentGenerationHistories.createdBy, users.id))
      .where(eq(documentGenerationHistories.documentId, documentId))
      .orderBy(desc(documentGenerationHistories.version));

    return histories.map((h) => {
      const config = h.generationConfig ? JSON.parse(h.generationConfig) : {};
      return {
        id: h.id,
        documentId: h.documentId,
        version: h.version || 0,
        name: config.name || `版本 ${h.version}`,
        description: config.description,
        createdBy: h.createdBy,
        creatorName: h.creatorName,
        createdAt: h.createdAt,
        totalWordCount: h.totalWordCount,
        chapterCount: h.totalChapters,
        chapters: config.chapters || [],
      };
    });
  },

  /**
   * 获取特定版本详情
   */
  async getVersionDetail(historyId: number): Promise<DocumentVersion | null> {
    const [history] = await db
      .select({
        id: documentGenerationHistories.id,
        documentId: documentGenerationHistories.documentId,
        version: documentGenerationHistories.version,
        generationConfig: documentGenerationHistories.generationConfig,
        totalWordCount: documentGenerationHistories.totalWordCount,
        totalChapters: documentGenerationHistories.totalChapters,
        createdBy: documentGenerationHistories.createdBy,
        createdAt: documentGenerationHistories.createdAt,
        creatorName: users.realName,
      })
      .from(documentGenerationHistories)
      .innerJoin(users, eq(documentGenerationHistories.createdBy, users.id))
      .where(eq(documentGenerationHistories.id, historyId))
      .limit(1);

    if (!history) return null;

    const config = history.generationConfig ? JSON.parse(history.generationConfig) : {};
    return {
      id: history.id,
      documentId: history.documentId,
      version: history.version || 0,
      name: config.name || `版本 ${history.version}`,
      description: config.description,
      createdBy: history.createdBy,
      creatorName: history.creatorName,
      createdAt: history.createdAt,
      totalWordCount: history.totalWordCount,
      chapterCount: history.totalChapters,
      chapters: config.chapters || [],
    };
  },

  /**
   * 对比两个版本
   */
  async compareVersions(version1Id: number, version2Id: number): Promise<CompareResult> {
    const version1 = await this.getVersionDetail(version1Id);
    const version2 = await this.getVersionDetail(version2Id);

    if (!version1 || !version2) {
      throw new Error('版本不存在');
    }

    if (version1.documentId !== version2.documentId) {
      throw new Error('不能对比不同文档的版本');
    }

    // 创建章节映射
    const chapters1Map = new Map<number, ChapterSnapshot>();
    const chapters2Map = new Map<number, ChapterSnapshot>();

    version1.chapters.forEach((ch) => chapters1Map.set(ch.chapterId, ch));
    version2.chapters.forEach((ch) => chapters2Map.set(ch.chapterId, ch));

    // 收集所有章节ID
    const allChapterIds = new Set([
      ...chapters1Map.keys(),
      ...chapters2Map.keys(),
    ]);

    const chapterDiffs: DiffResult[] = [];
    let addedChapters = 0;
    let removedChapters = 0;
    let modifiedChapters = 0;
    let unchangedChapters = 0;
    let totalWordCountDiff = 0;

    for (const chapterId of allChapterIds) {
      const ch1 = chapters1Map.get(chapterId);
      const ch2 = chapters2Map.get(chapterId);

      if (!ch1 && ch2) {
        // 新增的章节
        addedChapters++;
        totalWordCountDiff += ch2.wordCount;
        chapterDiffs.push({
          type: 'added',
          chapterId,
          chapterTitle: ch2.title,
          changes: ch2.content.split('\n').map((line, index) => ({
            type: 'add' as const,
            content: line,
            lineNumber: index + 1,
          })),
          stats: {
            addedLines: ch2.content.split('\n').length,
            removedLines: 0,
            modifiedLines: 0,
            wordCountDiff: ch2.wordCount,
          },
        });
      } else if (ch1 && !ch2) {
        // 删除的章节
        removedChapters++;
        totalWordCountDiff -= ch1.wordCount;
        chapterDiffs.push({
          type: 'removed',
          chapterId,
          chapterTitle: ch1.title,
          changes: ch1.content.split('\n').map((line, index) => ({
            type: 'remove' as const,
            content: line,
            lineNumber: index + 1,
          })),
          stats: {
            addedLines: 0,
            removedLines: ch1.content.split('\n').length,
            modifiedLines: 0,
            wordCountDiff: -ch1.wordCount,
          },
        });
      } else if (ch1 && ch2) {
        // 对比内容差异
        const diff = this.diffTexts(ch1.content, ch2.content);
        const wordCountDiff = ch2.wordCount - ch1.wordCount;
        totalWordCountDiff += wordCountDiff;

        if (diff.type === 'unchanged') {
          unchangedChapters++;
        } else {
          modifiedChapters++;
        }

        chapterDiffs.push({
          type: diff.type,
          chapterId,
          chapterTitle: ch2.title,
          changes: diff.changes,
          stats: {
            addedLines: diff.stats.added,
            removedLines: diff.stats.removed,
            modifiedLines: diff.stats.modified,
            wordCountDiff,
          },
        });
      }
    }

    return {
      documentId: version1.documentId,
      version1,
      version2,
      summary: {
        addedChapters,
        removedChapters,
        modifiedChapters,
        unchangedChapters,
        totalWordCountDiff,
      },
      chapterDiffs: chapterDiffs.sort((a, b) => a.chapterId - b.chapterId),
    };
  },

  /**
   * 对比两个文本
   */
  diffTexts(
    text1: string,
    text2: string
  ): {
    type: 'added' | 'removed' | 'modified' | 'unchanged';
    changes: TextChange[];
    stats: { added: number; removed: number; modified: number };
  } {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');

    // 简化的差异检测：基于行对比
    const changes: TextChange[] = [];
    let added = 0;
    let removed = 0;
    const _modified = 0;

    // 使用最长公共子序列算法（简化版）
    const lcs = this.computeLCS(lines1, lines2);

    let i = 0,
      j = 0,
      k = 0;

    while (i < lines1.length || j < lines2.length) {
      if (k < lcs.length && i < lines1.length && j < lines2.length && lines1[i] === lcs[k] && lines2[j] === lcs[k]) {
        // 未改变的行
        changes.push({
          type: 'unchanged',
          content: lines1[i],
          lineNumber: j + 1,
        });
        i++;
        j++;
        k++;
      } else if (j < lines2.length && (i >= lines1.length || !lcs.includes(lines2[j]))) {
        // 新增的行
        changes.push({
          type: 'add',
          content: lines2[j],
          lineNumber: j + 1,
        });
        j++;
        added++;
      } else if (i < lines1.length) {
        // 删除的行
        changes.push({
          type: 'remove',
          content: lines1[i],
          lineNumber: i + 1,
        });
        i++;
        removed++;
      }
    }

    const type = added > 0 && removed > 0 ? 'modified' : added > 0 ? 'added' : removed > 0 ? 'removed' : 'unchanged';

    return {
      type,
      changes,
      stats: { added, removed, modified: Math.min(added, removed) },
    };
  },

  /**
   * 计算最长公共子序列
   */
  computeLCS(arr1: string[], arr2: string[]): string[] {
    const m = arr1.length;
    const n = arr2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // 构建DP表
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // 回溯获取LCS
    const lcs: string[] = [];
    let i = m,
      j = n;

    while (i > 0 && j > 0) {
      if (arr1[i - 1] === arr2[j - 1]) {
        lcs.unshift(arr1[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs;
  },

  /**
   * 生成对比报告
   */
  generateCompareReport(result: CompareResult): string {
    const lines: string[] = [
      `# 文档版本对比报告`,
      ``,
      `**文档ID**: ${result.documentId}`,
      `**版本对比**: ${result.version1.name} (v${result.version1.version}) vs ${result.version2.name} (v${result.version2.version})`,
      ``,
      `## 摘要`,
      ``,
      `| 指标 | 数值 |`,
      `|------|------|`,
      `| 新增章节 | ${result.summary.addedChapters} |`,
      `| 删除章节 | ${result.summary.removedChapters} |`,
      `| 修改章节 | ${result.summary.modifiedChapters} |`,
      `| 未变章节 | ${result.summary.unchangedChapters} |`,
      `| 字数变化 | ${result.summary.totalWordCountDiff > 0 ? '+' : ''}${result.summary.totalWordCountDiff} |`,
      ``,
      `## 详细变更`,
      ``,
    ];

    for (const diff of result.chapterDiffs) {
      const statusEmoji = {
        added: '➕',
        removed: '➖',
        modified: '✏️',
        unchanged: '✓',
      }[diff.type];

      lines.push(`### ${statusEmoji} ${diff.chapterTitle}`);
      lines.push(``);
      lines.push(`- 类型: ${diff.type}`);
      lines.push(`- 新增行数: ${diff.stats.addedLines}`);
      lines.push(`- 删除行数: ${diff.stats.removedLines}`);
      lines.push(`- 字数变化: ${diff.stats.wordCountDiff > 0 ? '+' : ''}${diff.stats.wordCountDiff}`);
      lines.push(``);
    }

    return lines.join('\n');
  },

  /**
   * 恢复到指定版本
   */
  async restoreToVersion(documentId: number, historyId: number, userId: number): Promise<boolean> {
    const version = await this.getVersionDetail(historyId);
    if (!version) {
      throw new Error('版本不存在');
    }

    // 先创建当前版本的快照
    await this.createVersionSnapshot(documentId, '恢复前备份', `恢复到版本 ${version.version} 前的备份`, userId);

    // 恢复章节内容
    for (const chapter of version.chapters) {
      await db
        .update(bidChapters)
        .set({
          content: chapter.content,
          wordCount: chapter.wordCount,
          updatedAt: new Date(),
        })
        .where(eq(bidChapters.id, chapter.chapterId));
    }

    // 更新文档统计
    await db
      .update(bidDocuments)
      .set({
        wordCount: version.totalWordCount,
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, documentId));

    return true;
  },
};

export default versionCompareService;

/**
 * 文档导出服务
 * 提供PDF和Word格式导出功能
 */

import { db } from '@/db';
import { bidDocuments, bidChapters } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import * as fs from 'fs';

// ============================================
// 类型定义
// ============================================

export interface ExportOptions {
  format: 'html' | 'markdown' | 'docx' | 'pdf';
  includeToc: boolean;
  includePageNumbers: boolean;
  header?: string;
  footer?: string;
}

export interface ExportResult {
  content: string | Buffer;
  mimeType: string;
  filename: string;
}

interface ChapterNode {
  id: number;
  parentId: number | null;
  serialNumber: string | null;
  title: string;
  type: string | null;
  level: number;
  content: string | null;
  isRequired: boolean;
  isCompleted: boolean;
  children: ChapterNode[];
}

// ============================================
// 导出服务
// ============================================

/**
 * 导出文档
 */
export async function exportDocument(
  documentId: number,
  options: ExportOptions
): Promise<ExportResult> {
  // 获取文档信息
  const doc = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  if (doc.length === 0) {
    throw new Error('文档不存在');
  }

  // 获取所有章节
  const chapters = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId))
    .orderBy(asc(bidChapters.sortOrder));

  const document = doc[0];

  switch (options.format) {
    case 'html':
      return exportAsHtml(document, chapters, options);
    case 'markdown':
      return exportAsMarkdown(document, chapters, options);
    case 'docx':
      return exportAsDocx(document, chapters, options);
    case 'pdf':
      return await exportAsPdf(document, chapters, options);
    default:
      throw new Error('不支持的导出格式');
  }
}

/**
 * 导出为HTML格式
 */
function exportAsHtml(
  document: typeof bidDocuments.$inferSelect,
  chapters: typeof bidChapters.$inferSelect[],
  options: ExportOptions
): ExportResult {
  // 构建章节树
  const chapterTree = buildChapterTree(chapters);

  // 生成目录
  let tocHtml = '';
  if (options.includeToc) {
    tocHtml = generateTocHtml(chapterTree);
  }

  // 生成内容HTML
  const contentHtml = generateContentHtml(chapterTree);

  // 完整HTML文档
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${document.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: "Microsoft YaHei", "SimSun", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 {
      font-size: 24px;
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }
    h2 {
      font-size: 18px;
      margin: 30px 0 15px;
      padding-left: 10px;
      border-left: 4px solid #1890ff;
    }
    h3 {
      font-size: 16px;
      margin: 20px 0 10px;
      padding-left: 10px;
    }
    h4 {
      font-size: 14px;
      margin: 15px 0 10px;
      padding-left: 10px;
    }
    p {
      margin-bottom: 10px;
      text-indent: 2em;
    }
    .toc {
      background: #f5f5f5;
      padding: 20px;
      margin-bottom: 40px;
      border-radius: 4px;
    }
    .toc h2 {
      margin: 0 0 15px;
      padding: 0;
      border: none;
      font-size: 16px;
    }
    .toc ul {
      list-style: none;
    }
    .toc li {
      margin: 5px 0;
    }
    .toc a {
      color: #333;
      text-decoration: none;
    }
    .toc a:hover {
      color: #1890ff;
    }
    .chapter {
      page-break-inside: avoid;
    }
    .chapter-number {
      font-weight: bold;
      margin-right: 10px;
    }
    @media print {
      body {
        padding: 0;
      }
      .toc {
        page-break-after: always;
      }
      h2 {
        page-break-after: avoid;
      }
    }
    @page {
      size: A4;
      margin: 2cm;
      @bottom-center {
        content: counter(page);
      }
    }
  </style>
</head>
<body>
  <h1>${document.name}</h1>
  ${tocHtml}
  ${contentHtml}
</body>
</html>`;

  return {
    content: html,
    mimeType: 'text/html',
    filename: `${document.name}_${new Date().toISOString().slice(0, 10)}.html`,
  };
}

/**
 * 导出为Markdown格式
 */
function exportAsMarkdown(
  document: typeof bidDocuments.$inferSelect,
  chapters: typeof bidChapters.$inferSelect[],
  options: ExportOptions
): ExportResult {
  const chapterTree = buildChapterTree(chapters);

  let markdown = `# ${document.name}\n\n`;

  // 添加文档信息
  markdown += `> 版本: v${document.version}\n`;
  markdown += `> 生成时间: ${new Date().toLocaleString()}\n\n`;

  // 生成目录
  if (options.includeToc) {
    markdown += `## 目录\n\n`;
    markdown += generateTocMarkdown(chapterTree, 0);
    markdown += `\n---\n\n`;
  }

  // 生成内容
  markdown += generateContentMarkdown(chapterTree, 0);

  return {
    content: markdown,
    mimeType: 'text/markdown',
    filename: `${document.name}_${new Date().toISOString().slice(0, 10)}.md`,
  };
}

/**
 * 导出为Word格式（简化版，使用HTML格式）
 */
function exportAsDocx(
  document: typeof bidDocuments.$inferSelect,
  chapters: typeof bidChapters.$inferSelect[],
  options: ExportOptions
): ExportResult {
  // Word可以打开HTML格式，使用mhtml mime类型
  const htmlResult = exportAsHtml(document, chapters, options);
  const htmlContent = typeof htmlResult.content === 'string'
    ? htmlResult.content
    : htmlResult.content.toString();

  // 添加Word特定的命名空间
  const docxHtml = htmlContent.replace(
    '<html lang="zh-CN">',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="zh-CN">'
  );

  return {
    content: docxHtml,
    mimeType: 'application/msword',
    filename: `${document.name}_${new Date().toISOString().slice(0, 10)}.doc`,
  };
}

/**
 * 导出为PDF格式
 */
async function exportAsPdf(
  document: typeof bidDocuments.$inferSelect,
  chapters: typeof bidChapters.$inferSelect[],
  options: ExportOptions
): Promise<ExportResult> {
  const chapterTree = buildChapterTree(chapters);

  // 定义字体
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fonts: any = {
    SimSun: {
      normal: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    },
  };

  // 检查系统字体
  const hasChineseFont = fs.existsSync('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc');
  if (hasChineseFont) {
    fonts.SimSun = {
      normal: '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
      bold: '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PdfPrinter = require('pdfmake');
  const printer = new PdfPrinter(fonts);

  // 构建文档内容
  const docContent: Content[] = [];

  // 添加标题
  docContent.push({
    text: document.name,
    style: 'header',
    alignment: 'center',
    margin: [0, 0, 0, 30] as [number, number, number, number],
  });

  // 添加文档信息
  docContent.push({
    text: [
      { text: '版本: ', bold: true },
      `v${document.version}\n`,
      { text: '生成时间: ', bold: true },
      new Date().toLocaleString('zh-CN'),
    ],
    style: 'info',
    margin: [0, 0, 0, 20] as [number, number, number, number],
  });

  // 添加目录
  if (options.includeToc) {
    docContent.push({
      text: '目录',
      style: 'tocTitle',
      margin: [0, 20, 0, 10] as [number, number, number, number],
    });

    const tocContent = generateTocPdf(chapterTree, 0);
    docContent.push(...tocContent);

    // 目录后分页
    docContent.push({
      text: '',
      pageBreak: 'after',
    });
  }

  // 添加正文内容
  const bodyContent = generateContentPdf(chapterTree, 1);
  docContent.push(...bodyContent);

  // 文档定义
  const docDefinition: TDocumentDefinitions = {
    content: docContent,
    styles: {
      header: {
        fontSize: 24,
        bold: true,
        font: 'SimSun',
      },
      title: {
        fontSize: 18,
        bold: true,
        font: 'SimSun',
        margin: [0, 15, 0, 10] as [number, number, number, number],
      },
      subtitle: {
        fontSize: 16,
        bold: true,
        font: 'SimSun',
        margin: [0, 12, 0, 8] as [number, number, number, number],
      },
      subsubtitle: {
        fontSize: 14,
        bold: true,
        font: 'SimSun',
        margin: [0, 10, 0, 6] as [number, number, number, number],
      },
      body: {
        fontSize: 12,
        font: 'SimSun',
        lineHeight: 1.8,
      },
      tocTitle: {
        fontSize: 16,
        bold: true,
        font: 'SimSun',
      },
      tocItem: {
        fontSize: 11,
        font: 'SimSun',
      },
      info: {
        fontSize: 10,
        font: 'SimSun',
        color: '#666666',
      },
    },
    defaultStyle: {
      font: 'SimSun',
      fontSize: 12,
    },
    pageSize: 'A4',
    pageMargins: [72, 72, 72, 72] as [number, number, number, number],
    footer: options.includePageNumbers
      ? (currentPage, pageCount) => ({
          text: `第 ${currentPage} 页 / 共 ${pageCount} 页`,
          alignment: 'center',
          fontSize: 10,
          font: 'SimSun',
        })
      : undefined,
    header: options.header
      ? () => ({
          text: options.header!,
          alignment: 'center',
          fontSize: 10,
          font: 'SimSun',
          color: '#999999',
        })
      : undefined,
  };

  // 生成PDF
  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    pdfDoc.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    pdfDoc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve({
        content: pdfBuffer,
        mimeType: 'application/pdf',
        filename: `${document.name}_${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    });

    pdfDoc.on('error', (error: Error) => {
      reject(error);
    });

    pdfDoc.end();
  });
}

/**
 * 生成目录PDF内容
 */
function generateTocPdf(chapters: ChapterNode[], depth: number): Content[] {
  const content: Content[] = [];
  const indent = depth * 20;

  chapters.forEach((chapter) => {
    content.push({
      text: `${chapter.serialNumber ? chapter.serialNumber + ' ' : ''}${chapter.title}`,
      style: 'tocItem',
      margin: [indent, 3, 0, 3] as [number, number, number, number],
    });

    if (chapter.children.length > 0) {
      content.push(...generateTocPdf(chapter.children, depth + 1));
    }
  });

  return content;
}

/**
 * 生成正文PDF内容
 */
function generateContentPdf(chapters: ChapterNode[], level: number): Content[] {
  const content: Content[] = [];
  const styleMap: Record<number, string> = {
    1: 'title',
    2: 'subtitle',
    3: 'subsubtitle',
  };

  chapters.forEach((chapter) => {
    // 添加标题
    const style = styleMap[level] || 'body';
    content.push({
      text: `${chapter.serialNumber ? chapter.serialNumber + ' ' : ''}${chapter.title}`,
      style,
    });

    // 添加内容
    if (chapter.content) {
      const paragraphs = chapter.content.split('\n\n');
      paragraphs.forEach((p) => {
        if (p.trim()) {
          content.push({
            text: p.trim(),
            style: 'body',
            margin: [0, 5, 0, 5] as [number, number, number, number],
          });
        }
      });
    }

    // 递归处理子章节
    if (chapter.children.length > 0) {
      content.push(...generateContentPdf(chapter.children, level + 1));
    }
  });

  return content;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 构建章节树
 */
function buildChapterTree(chapters: typeof bidChapters.$inferSelect[]): ChapterNode[] {
  const chapterMap = new Map<number, ChapterNode>();

  // 创建映射
  chapters.forEach((chapter) => {
    chapterMap.set(chapter.id, {
      id: chapter.id,
      parentId: chapter.parentId,
      serialNumber: chapter.serialNumber,
      title: chapter.title,
      type: chapter.type,
      level: chapter.level,
      content: chapter.content,
      isRequired: chapter.isRequired,
      isCompleted: chapter.isCompleted,
      children: [],
    });
  });

  // 构建树结构
  const rootChapters: ChapterNode[] = [];

  chapters.forEach((chapter) => {
    const node = chapterMap.get(chapter.id)!;
    if (chapter.parentId && chapterMap.has(chapter.parentId)) {
      const parent = chapterMap.get(chapter.parentId)!;
      parent.children.push(node);
    } else {
      rootChapters.push(node);
    }
  });

  return rootChapters;
}

/**
 * 生成目录HTML
 */
function generateTocHtml(chapters: ChapterNode[]): string {
  let html = '<div class="toc"><h2>目录</h2><ul>';

  function renderTocItem(chapter: ChapterNode): void {
    const id = `chapter-${chapter.id}`;
    html += `<li><a href="#${id}">${chapter.serialNumber ? chapter.serialNumber + ' ' : ''}${chapter.title}</a></li>`;

    if (chapter.children.length > 0) {
      html += '<ul>';
      chapter.children.forEach(renderTocItem);
      html += '</ul>';
    }
  }

  chapters.forEach(renderTocItem);
  html += '</ul></div>';
  return html;
}

/**
 * 生成内容HTML
 */
function generateContentHtml(chapters: ChapterNode[], level = 1): string {
  let html = '';

  chapters.forEach((chapter) => {
    const id = `chapter-${chapter.id}`;
    const tag = `h${Math.min(level + 1, 6)}`;

    html += `<div class="chapter">`;
    html += `<${tag} id="${id}">`;
    if (chapter.serialNumber) {
      html += `<span class="chapter-number">${chapter.serialNumber}</span>`;
    }
    html += `${chapter.title}</${tag}>`;

    if (chapter.content) {
      // 将内容转换为段落
      const paragraphs = chapter.content.split('\n\n');
      paragraphs.forEach((p) => {
        if (p.trim()) {
          html += `<p>${p.trim()}</p>`;
        }
      });
    }

    // 递归处理子章节
    if (chapter.children.length > 0) {
      html += generateContentHtml(chapter.children, level + 1);
    }

    html += `</div>`;
  });

  return html;
}

/**
 * 生成目录Markdown
 */
function generateTocMarkdown(chapters: ChapterNode[], depth: number): string {
  let markdown = '';
  const indent = '  '.repeat(depth);

  chapters.forEach((chapter) => {
    const id = `chapter-${chapter.id}`;
    markdown += `${indent}- [${chapter.serialNumber ? chapter.serialNumber + ' ' : ''}${chapter.title}](#${id})\n`;

    if (chapter.children.length > 0) {
      markdown += generateTocMarkdown(chapter.children, depth + 1);
    }
  });

  return markdown;
}

/**
 * 生成内容Markdown
 */
function generateContentMarkdown(chapters: ChapterNode[], depth: number): string {
  let markdown = '';

  chapters.forEach((chapter) => {
    const heading = '#'.repeat(Math.min(depth + 2, 6));
    const id = `chapter-${chapter.id}`;

    markdown += `${heading} <a id="${id}"></a>`;
    if (chapter.serialNumber) {
      markdown += ` ${chapter.serialNumber}`;
    }
    markdown += ` ${chapter.title}\n\n`;

    if (chapter.content) {
      markdown += `${chapter.content}\n\n`;
    }

    // 递归处理子章节
    if (chapter.children.length > 0) {
      markdown += generateContentMarkdown(chapter.children, depth + 1);
    }
  });

  return markdown;
}

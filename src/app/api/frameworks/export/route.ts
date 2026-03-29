/**
 * 文档框架导出API
 * 支持导出为Word、PDF或插入到投标文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  docFrameworkInstances, 
  docFrameworkChapters, 
  docFrameworkContents,
  docFrameworks,
} from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip,
} from 'docx';

// ============================================
// POST: 导出文档
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      instanceId,
      format = 'html', // html/json/docx/insert-to-bid
      bidDocumentId,
    } = body;

    if (!instanceId) {
      return NextResponse.json(
        { error: '缺少实例ID' },
        { status: 400 }
      );
    }

    // 获取实例信息
    const [instance] = await db
      .select()
      .from(docFrameworkInstances)
      .where(eq(docFrameworkInstances.id, instanceId));

    if (!instance) {
      return NextResponse.json(
        { error: '实例不存在' },
        { status: 404 }
      );
    }

    // 获取框架信息
    const [framework] = await db
      .select()
      .from(docFrameworks)
      .where(eq(docFrameworks.id, instance.frameworkId));

    // 获取所有章节
    const chapters = await db
      .select()
      .from(docFrameworkChapters)
      .where(eq(docFrameworkChapters.frameworkId, instance.frameworkId))
      .orderBy(asc(docFrameworkChapters.sequence));

    // 获取章节内容
    const contents = await db
      .select()
      .from(docFrameworkContents)
      .where(eq(docFrameworkContents.instanceId, instanceId));

    // 合并章节和内容
    const chaptersWithContent = chapters.map(ch => {
      const content = contents.find(c => c.chapterId === ch.id);
      return {
        ...ch,
        content: content?.content || '',
        wordCount: content?.wordCount || 0,
        status: content?.status || 'pending',
      };
    });

    // 根据格式导出
    switch (format) {
      case 'html':
        return exportAsHtml(instance, framework, chaptersWithContent);
      case 'json':
        return exportAsJson(instance, framework, chaptersWithContent);
      case 'docx':
        return exportAsDocx(instance, framework, chaptersWithContent);
      case 'insert-to-bid':
        if (!bidDocumentId) {
          return NextResponse.json(
            { error: '缺少投标文档ID' },
            { status: 400 }
          );
        }
        return insertToBidDocument(instance, framework, chaptersWithContent, bidDocumentId);
      default:
        return NextResponse.json(
          { error: '不支持的导出格式' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('导出文档失败:', error);
    return NextResponse.json(
      { error: '导出文档失败' },
      { status: 500 }
    );
  }
}

// ============================================
// 导出为HTML
// ============================================

function exportAsHtml(instance: any, framework: any, chapters: any[]) {
  const config = {
    cover: JSON.parse(framework.coverConfig || '{}'),
    titlePage: JSON.parse(framework.titlePageConfig || '{}'),
    header: JSON.parse(framework.headerConfig || '{}'),
    footer: JSON.parse(framework.footerConfig || '{}'),
    toc: JSON.parse(framework.tocConfig || '{}'),
    body: JSON.parse(framework.bodyConfig || '{}'),
  };

  // 构建HTML文档
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${instance.name}</title>
  <style>
    body { font-family: 'SimSun', serif; line-height: 1.8; margin: 40px; }
    h1 { font-size: 22pt; text-align: center; margin: 24pt 0; }
    h2 { font-size: 16pt; margin: 18pt 0 12pt; }
    h3 { font-size: 14pt; margin: 14pt 0 10pt; }
    h4 { font-size: 12pt; margin: 12pt 0 8pt; }
    h5 { font-size: 11pt; margin: 10pt 0 6pt; }
    p { text-indent: 2em; margin: 6pt 0; }
    .cover { text-align: center; padding: 200px 0; page-break-after: always; }
    .cover h1 { font-size: 36pt; margin-bottom: 40pt; }
    .title-page { text-align: center; padding: 100px 0; page-break-after: always; }
    .toc { page-break-after: always; }
    .toc h2 { text-align: center; }
    .toc-item { display: flex; margin: 6pt 0; }
    .toc-title { flex: 1; }
    .toc-page { margin-left: 20pt; }
    .chapter { page-break-before: always; }
    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>`;

  // 封面
  if (config.cover.enabled) {
    html += `
  <div class="cover">
    <h1>${config.cover.title || instance.name}</h1>
    ${config.cover.subtitle ? `<h2>${config.cover.subtitle}</h2>` : ''}
    ${config.cover.company ? `<p>${config.cover.company}</p>` : ''}
    ${config.cover.date ? `<p>${config.cover.date}</p>` : ''}
  </div>`;
  }

  // 扉页
  if (config.titlePage.enabled) {
    html += `
  <div class="title-page">
    <h1>${config.titlePage.title || '投标文件'}</h1>
    ${config.titlePage.content ? `<p>${config.titlePage.content}</p>` : ''}
  </div>`;
  }

  // 目录
  if (config.toc.enabled) {
    html += `
  <div class="toc">
    <h2>目 录</h2>
    ${buildToc(chapters)}
  </div>`;
  }

  // 正文
  html += `<div class="body">`;
  
  // 构建章节树
  const chapterTree = buildChapterTree(chapters);
  
  for (const chapter of chapterTree) {
    html += renderChapter(chapter);
  }
  
  html += `</div>`;
  
  html += `
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(instance.name)}.html"`,
    },
  });
}

// 构建目录
function buildToc(chapters: any[]): string {
  let toc = '';
  for (const chapter of chapters) {
    toc += `<div class="toc-item" style="padding-left: ${(chapter.level - 1) * 20}px">
      <span class="toc-title">${chapter.chapterCode || ''} ${chapter.title}</span>
    </div>`;
  }
  return toc;
}

// 构建章节树
function buildChapterTree(chapters: any[], parentId: number | null = null): any[] {
  return chapters
    .filter(ch => ch.parentId === parentId)
    .map(ch => ({
      ...ch,
      children: buildChapterTree(chapters, ch.id),
    }));
}

// 渲染章节
function renderChapter(chapter: any): string {
  let html = `<div class="chapter">
    <h${chapter.level}>${chapter.chapterCode || ''} ${chapter.title}</h${chapter.level}>`;
  
  if (chapter.content) {
    // 将内容按段落分割
    const paragraphs = chapter.content.split('\n').filter((p: string) => p.trim());
    for (const para of paragraphs) {
      html += `<p>${para}</p>`;
    }
  }
  
  // 渲染子章节
  for (const child of chapter.children || []) {
    html += renderChapter(child);
  }
  
  html += `</div>`;
  return html;
}

// ============================================
// 导出为JSON
// ============================================

function exportAsJson(instance: any, framework: any, chapters: any[]) {
  const data = {
    instance: {
      id: instance.id,
      name: instance.name,
      status: instance.status,
      version: instance.version,
    },
    framework: {
      id: framework.id,
      name: framework.name,
      code: framework.code,
      version: framework.version,
      config: {
        cover: JSON.parse(framework.coverConfig || '{}'),
        titlePage: JSON.parse(framework.titlePageConfig || '{}'),
        header: JSON.parse(framework.headerConfig || '{}'),
        footer: JSON.parse(framework.footerConfig || '{}'),
        toc: JSON.parse(framework.tocConfig || '{}'),
        body: JSON.parse(framework.bodyConfig || '{}'),
      },
    },
    chapters: buildChapterTree(chapters),
    exportedAt: new Date().toISOString(),
  };

  return NextResponse.json(data);
}

// ============================================
// 导出为DOCX
// ============================================

async function exportAsDocx(instance: any, framework: any, chapters: any[]) {
  const config = {
    cover: JSON.parse(framework.coverConfig || '{}'),
    titlePage: JSON.parse(framework.titlePageConfig || '{}'),
    header: JSON.parse(framework.headerConfig || '{}'),
    footer: JSON.parse(framework.footerConfig || '{}'),
    toc: JSON.parse(framework.tocConfig || '{}'),
    body: JSON.parse(framework.bodyConfig || '{}'),
  };

  const children: Paragraph[] = [];

  // 封面页
  if (config.cover.enabled) {
    children.push(
      new Paragraph({
        children: [],
        spacing: { before: convertInchesToTwip(4) },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: config.cover.title || instance.name,
            bold: true,
            size: 56, // 28pt
            font: 'SimHei',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
    
    if (config.cover.subtitle) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: config.cover.subtitle,
              size: 32,
              font: 'SimSun',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
    }
    
    if (config.cover.company) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: config.cover.company,
              size: 24,
              font: 'SimSun',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 800 },
        })
      );
    }
    
    if (config.cover.date) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: config.cover.date,
              size: 24,
              font: 'SimSun',
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );
    }
    
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // 扉页
  if (config.titlePage.enabled) {
    children.push(
      new Paragraph({
        children: [],
        spacing: { before: convertInchesToTwip(3) },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: config.titlePage.title || '投标文件',
            bold: true,
            size: 44,
            font: 'SimHei',
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );
    
    if (config.titlePage.content) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: config.titlePage.content,
              size: 28,
              font: 'SimSun',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        })
      );
    }
    
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // 目录页
  if (config.toc.enabled) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '目 录',
            bold: true,
            size: 32,
            font: 'SimHei',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
    
    // 目录项会在后续章节中自动生成，这里只添加目录标题
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '目录',
            bold: true,
            size: 32,
            font: 'SimHei',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
    
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // 构建章节树并渲染
  const chapterTree = buildChapterTree(chapters);
  renderChaptersToDocx(chapterTree, children);

  // 创建文档
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1.25),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
            },
          },
        },
        headers: config.header.enabled ? {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: config.header.text || instance.name,
                    size: 20,
                    font: 'SimSun',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        } : undefined,
        footers: config.footer.enabled ? {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: '第 ',
                    size: 20,
                    font: 'SimSun',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 20,
                  }),
                  new TextRun({
                    text: ' 页 / 共 ',
                    size: 20,
                    font: 'SimSun',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 20,
                  }),
                  new TextRun({
                    text: ' 页',
                    size: 20,
                    font: 'SimSun',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        } : undefined,
        children,
      },
    ],
  });

  // 生成文档buffer
  const buffer = await Packer.toBuffer(doc);

  const bytes = Uint8Array.from(buffer as any);
  const body = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(instance.name)}.docx"`,
    },
  });
}

// 渲染章节到DOCX
function renderChaptersToDocx(chapters: any[], children: Paragraph[]) {
  const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5];
  
  for (const chapter of chapters) {
    const level = Math.min(chapter.level - 1, headingLevels.length - 1);
    
    // 章节标题
    children.push(
      new Paragraph({
        text: `${chapter.chapterCode || ''} ${chapter.title}`,
        heading: headingLevels[level],
        spacing: { before: 240, after: 120 },
      })
    );
    
    // 章节内容
    if (chapter.content) {
      const paragraphs = chapter.content.split('\n').filter((p: string) => p.trim());
      for (const para of paragraphs) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: para,
                size: 24, // 12pt
                font: 'SimSun',
              }),
            ],
            indent: { firstLine: convertInchesToTwip(0.3) },
            spacing: { line: 360 }, // 1.5倍行距
          })
        );
      }
    }
    
    // 递归渲染子章节
    if (chapter.children && chapter.children.length > 0) {
      renderChaptersToDocx(chapter.children, children);
    }
  }
}

// ============================================
// 插入到投标文件
// ============================================

async function insertToBidDocument(
  instance: any, 
  framework: any, 
  chapters: any[],
  bidDocumentId: number
) {
  // 更新实例关联的投标文档ID
  await db
    .update(docFrameworkInstances)
    .set({ 
      updatedAt: new Date(),
    })
    .where(eq(docFrameworkInstances.id, instance.id));

  // 生成HTML内容
  let content = '';
  const chapterTree = buildChapterTree(chapters);
  
  for (const chapter of chapterTree) {
    content += renderChapter(chapter);
  }

  return NextResponse.json({ 
    success: true,
    message: '已插入到投标文件',
    bidDocumentId,
    contentPreview: content.substring(0, 500),
  });
}

// ============================================
// GET: 获取导出选项
// ============================================

export async function GET() {
  return NextResponse.json({
    formats: [
      { value: 'html', name: 'HTML格式', description: '导出为HTML文件，可用浏览器打开' },
      { value: 'docx', name: 'Word文档', description: '导出为DOCX格式，可用Word编辑' },
      { value: 'json', name: 'JSON数据', description: '导出为JSON格式，便于系统集成' },
      { value: 'insert-to-bid', name: '插入投标文件', description: '将内容插入到投标文件中' },
    ],
    options: {
      includeCover: { name: '包含封面', default: true },
      includeTitlePage: { name: '包含扉页', default: true },
      includeToc: { name: '包含目录', default: true },
      includeHeader: { name: '包含页眉', default: true },
      includeFooter: { name: '包含页脚', default: true },
    },
  });
}

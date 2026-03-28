/**
 * 文档解析API
 * 支持上传文档后识别标题层级
 * 增强版：支持更多标题格式、智能识别、内容提取
 */

import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// ============================================
// 标题识别模式配置
// ============================================

interface TitlePattern {
  regex: RegExp;
  level: number;
  name: string;
  priority: number; // 优先级，数字越小优先级越高
}

const TITLE_PATTERNS: TitlePattern[] = [
  // 一级标题模式
  { regex: /^第[一二三四五六七八九十百千万]+章[\s：:：]?\s*/u, level: 1, name: '中文章节', priority: 1 },
  { regex: /^第[一二三四五六七八九十百千万]+部分[\s：:：]?\s*/u, level: 1, name: '中文部分', priority: 1 },
  { regex: /^[一二三四五六七八九十]+[、.．]\s+/, level: 1, name: '中文数字', priority: 2 },
  { regex: /^1[\s.．、]\s+/, level: 1, name: '阿拉伯数字', priority: 3 },
  { regex: /^#[\s]+/, level: 1, name: 'Markdown H1', priority: 4 },
  { regex: /^一、\s*/, level: 1, name: '中文顿号', priority: 2 },
  { regex: /^PART\s+[IVX]+[\s:：]?\s*/i, level: 1, name: '英文部分', priority: 3 },
  { regex: /^CHAPTER\s+[IVX]+[\s:：]?\s*/i, level: 1, name: '英文章节', priority: 3 },
  
  // 二级标题模式
  { regex: /^第[一二三四五六七八九十]+节[\s：:：]?\s*/u, level: 2, name: '中文小节', priority: 1 },
  { regex: /^第[一二三四五六七八九十]+条[\s：:：]?\s*/u, level: 2, name: '中文条款', priority: 1 },
  { regex: /^\d+[.．]\d+[\s.．、]?\s+/, level: 2, name: '二级编号', priority: 2 },
  { regex: /^[（(][一二三四五六七八九十]+[)）]\s*/, level: 2, name: '括号中文', priority: 2 },
  { regex: /^##[\s]+/, level: 2, name: 'Markdown H2', priority: 4 },
  { regex: /^二、\s*/, level: 2, name: '二级中文顿号', priority: 3 },
  
  // 三级标题模式
  { regex: /^\d+[.．]\d+[.．]\d+[\s.．、]?\s+/, level: 3, name: '三级编号', priority: 2 },
  { regex: /^[（(]\d+[)）]\s*/, level: 3, name: '括号数字', priority: 2 },
  { regex: /^###[\s]+/, level: 3, name: 'Markdown H3', priority: 4 },
  { regex: /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, level: 3, name: '带圈数字', priority: 3 },
  
  // 四级标题模式
  { regex: /^\d+[.．]\d+[.．]\d+[.．]\d+[\s.．、]?\s+/, level: 4, name: '四级编号', priority: 2 },
  { regex: /^[a-zA-Z][.．、]\s+/, level: 4, name: '字母编号', priority: 3 },
  { regex: /^####[\s]+/, level: 4, name: 'Markdown H4', priority: 4 },
  
  // 五级标题模式
  { regex: /^[ivxIVX]+[.．、]\s+/, level: 5, name: '罗马数字', priority: 3 },
  { regex: /^#####[\s]+/, level: 5, name: 'Markdown H5', priority: 4 },
  { regex: /^[a-zA-Z]\)[\s]*/, level: 5, name: '字母括号', priority: 3 },
];

// ============================================
// POST: 解析文档结构
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, content, options } = body;

    let documentContent = content;
    let documentTitle = '';
    let detectedFormat = 'unknown';

    // 如果提供了URL，先获取文档内容
    if (url) {
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const config = new Config();
      const client = new FetchClient(config, customHeaders);

      const response = await client.fetch(url);
      
      if (response.status_code !== 0) {
        return NextResponse.json(
          { error: response.status_message || '获取文档失败' },
          { status: 400 }
        );
      }

      documentTitle = response.title || '';
      
      // 提取文本内容
      const textItems = response.content.filter(item => item.type === 'text');
      documentContent = textItems.map(item => item.text).join('\n');
      
      // 尝试检测文档格式
      detectedFormat = detectFormat(url, response.content);
    }

    if (!documentContent) {
      return NextResponse.json(
        { error: '缺少文档内容' },
        { status: 400 }
      );
    }

    // 解析选项
    const parseOptions = {
      minTitleLength: options?.minTitleLength || 2,
      maxTitleLength: options?.maxTitleLength || 200,
      includeContent: options?.includeContent ?? true,
      detectLists: options?.detectLists ?? true,
      detectTables: options?.detectTables ?? false,
    };

    // 使用增强的正则表达式识别标题层级
    const parseResult = parseDocumentStructureEnhanced(
      documentContent, 
      documentTitle,
      parseOptions
    );

    return NextResponse.json({ 
      title: documentTitle,
      format: detectedFormat,
      chapters: parseResult.chapters,
      statistics: parseResult.statistics,
      rawContent: parseOptions.includeContent ? documentContent.substring(0, 5000) : undefined,
    });
  } catch (error) {
    console.error('解析文档失败:', error);
    return NextResponse.json(
      { error: '解析文档失败' },
      { status: 500 }
    );
  }
}

// ============================================
// 增强版文档结构解析
// ============================================

function parseDocumentStructureEnhanced(
  content: string, 
  title: string,
  options: any
): { chapters: any[]; statistics: any } {
  const chapters: any[] = [];
  const lines = content.split('\n');
  
  // 统计信息
  const statistics = {
    totalLines: lines.length,
    totalCharacters: content.length,
    detectedTitles: 0,
    levelDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    patternUsage: {} as Record<string, number>,
  };

  let sequence = 0;
  const levelCounters: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const parentStack: { level: number; id: number }[] = [];
  let currentParent: number | null = null;
  let lastChapterIndex = -1;
  
  // 用于收集章节内容的缓冲区
  const chapterContents: Map<number, string[]> = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // 空行跳过
    if (!trimmedLine) continue;

    // 检查是否匹配标题模式
    let matched = false;
    
    // 按优先级排序匹配
    const sortedPatterns = [...TITLE_PATTERNS].sort((a, b) => a.priority - b.priority);
    
    for (const pattern of sortedPatterns) {
      if (pattern.regex.test(trimmedLine)) {
        // 提取标题文本
        let titleText = trimmedLine
          .replace(pattern.regex, '')
          .replace(/^[#]+\s*/, '')
          .trim();

        // 标题长度检查
        if (titleText.length < options.minTitleLength) continue;
        if (titleText.length > options.maxTitleLength) {
          titleText = titleText.substring(0, options.maxTitleLength);
        }

        // 更新层级计数器
        levelCounters[pattern.level]++;
        for (let l = pattern.level + 1; l <= 5; l++) {
          levelCounters[l] = 0;
        }

        // 生成章节编码
        const chapterCode = generateChapterCodeEnhanced(levelCounters, pattern.level, pattern.name);

        // 确定父级
        while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= pattern.level) {
          parentStack.pop();
        }
        currentParent = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : null;

        // 更新统计
        statistics.detectedTitles++;
        statistics.levelDistribution[pattern.level as keyof typeof statistics.levelDistribution]++;
        statistics.patternUsage[pattern.name] = (statistics.patternUsage[pattern.name] || 0) + 1;

        // 创建章节
        const chapterId = sequence + 1;
        const chapter: any = {
          id: chapterId,
          title: titleText,
          level: pattern.level,
          sequence: sequence++,
          parentId: currentParent,
          chapterCode,
          contentType: 'text',
          required: false,
          patternName: pattern.name,
        };

        chapters.push(chapter);
        
        // 处理上一章节的内容收集
        if (lastChapterIndex >= 0) {
          const lastChapter = chapters[lastChapterIndex];
          const contentLines = chapterContents.get(lastChapter.id) || [];
          lastChapter.content = contentLines.join('\n').trim();
        }
        
        // 重置内容收集
        chapterContents.set(chapterId, []);
        lastChapterIndex = chapters.length - 1;
        
        parentStack.push({ level: pattern.level, id: chapter.id });
        matched = true;
        break;
      }
    }
    
    // 如果不是标题，收集到当前章节内容中
    if (!matched && lastChapterIndex >= 0) {
      const currentChapter = chapters[lastChapterIndex];
      const contentLines = chapterContents.get(currentChapter.id) || [];
      
      // 检查是否是列表项
      if (options.detectLists && isListItem(trimmedLine)) {
        contentLines.push(trimmedLine);
      } else {
        contentLines.push(trimmedLine);
      }
      
      chapterContents.set(currentChapter.id, contentLines);
    }
  }
  
  // 处理最后一个章节的内容
  if (lastChapterIndex >= 0) {
    const lastChapter = chapters[lastChapterIndex];
    const contentLines = chapterContents.get(lastChapter.id) || [];
    lastChapter.content = contentLines.join('\n').trim();
  }

  // 如果没有识别到任何标题，将整个文档作为一个章节
  if (chapters.length === 0) {
    chapters.push({
      id: 1,
      title: title || '正文',
      level: 1,
      sequence: 0,
      parentId: null,
      chapterCode: '1',
      contentType: 'text',
      required: true,
      content: content.trim(),
    });
    statistics.detectedTitles = 1;
    statistics.levelDistribution[1] = 1;
  }

  return { chapters, statistics };
}

// ============================================
// 生成章节编码（增强版）
// ============================================

function generateChapterCodeEnhanced(
  counters: { [key: number]: number }, 
  level: number,
  patternName: string
): string {
  const parts: string[] = [];
  
  // 根据模式名称选择编码风格
  if (patternName.includes('中文')) {
    // 中文数字编码
    const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    for (let l = 1; l <= level; l++) {
      const num = counters[l];
      if (l === 1) {
        parts.push(`第${chineseNumbers[num - 1] || num}章`);
      } else if (l === 2) {
        parts.push(`第${chineseNumbers[num - 1] || num}节`);
      } else {
        parts.push(num.toString());
      }
    }
  } else {
    // 阿拉伯数字编码
    for (let l = 1; l <= level; l++) {
      parts.push(counters[l].toString());
    }
  }
  
  return parts.join('.');
}

// ============================================
// 检测列表项
// ============================================

function isListItem(line: string): boolean {
  const listPatterns = [
    /^[-•·]\s+/,           // 无序列表
    /^\d+[\)、]\s*/,       // 数字列表
    /^[a-zA-Z][)、]\s*/,   // 字母列表
    /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, // 带圈数字
  ];
  
  return listPatterns.some(pattern => pattern.test(line));
}

// ============================================
// 检测文档格式
// ============================================

function detectFormat(url: string, content: any[]): string {
  if (url.toLowerCase().endsWith('.md')) return 'markdown';
  if (url.toLowerCase().endsWith('.txt')) return 'text';
  if (url.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (url.toLowerCase().match(/\.docx?$/)) return 'word';
  
  // 基于内容检测
  const textContent = content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  
  if (textContent.match(/^[#]+\s/m)) return 'markdown';
  
  return 'unknown';
}

// ============================================
// GET: 获取支持的文档类型
// ============================================

export async function GET() {
  return NextResponse.json({
    supportedFormats: [
      { ext: '.pdf', name: 'PDF文档', description: '支持PDF文档解析，自动提取文本和标题' },
      { ext: '.docx', name: 'Word文档', description: '支持Word 2007+格式，保留文档结构' },
      { ext: '.doc', name: 'Word文档(旧版)', description: '支持Word 97-2003格式' },
      { ext: '.txt', name: '文本文档', description: '支持纯文本文件，自动识别编码' },
      { ext: '.md', name: 'Markdown', description: '支持Markdown格式，识别标题层级' },
      { ext: '.rtf', name: 'RTF文档', description: '支持富文本格式' },
    ],
    titlePatterns: TITLE_PATTERNS.map(p => ({
      name: p.name,
      level: p.level,
      description: getPatternDescription(p.name),
    })),
    parseOptions: {
      minTitleLength: { type: 'number', default: 2, description: '最小标题长度' },
      maxTitleLength: { type: 'number', default: 200, description: '最大标题长度' },
      includeContent: { type: 'boolean', default: true, description: '是否包含章节内容' },
      detectLists: { type: 'boolean', default: true, description: '是否识别列表项' },
      detectTables: { type: 'boolean', default: false, description: '是否识别表格' },
    },
  });
}

// ============================================
// 获取模式描述
// ============================================

function getPatternDescription(name: string): string {
  const descriptions: Record<string, string> = {
    '中文章节': '如：第一章 项目概述',
    '中文部分': '如：第一部分 总体说明',
    '中文数字': '如：一、项目背景',
    '阿拉伯数字': '如：1. 项目背景',
    'Markdown H1': '如：# 标题',
    '中文顿号': '如：一、项目概述',
    '英文部分': '如：PART I Overview',
    '英文章节': '如：CHAPTER 1 Introduction',
    '中文小节': '如：第一节 项目背景',
    '中文条款': '如：第一条 总则',
    '二级编号': '如：1.1 项目目标',
    '括号中文': '如：（一）项目背景',
    'Markdown H2': '如：## 标题',
    '三级编号': '如：1.1.1 总体目标',
    '括号数字': '如：（1）总体目标',
    'Markdown H3': '如：### 标题',
    '带圈数字': '如：① 总体目标',
    '四级编号': '如：1.1.1.1 具体内容',
    '字母编号': '如：a. 具体内容',
    'Markdown H4': '如：#### 标题',
    '罗马数字': '如：i. 具体内容',
    'Markdown H5': '如：##### 标题',
    '字母括号': '如：a) 具体内容',
  };
  
  return descriptions[name] || '通用标题格式';
}

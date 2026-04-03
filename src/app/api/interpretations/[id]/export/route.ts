/**
 * 导出解读结果API
 * GET: 导出解读结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getInterpretationById,
  getTechnicalSpecs,
  getScoringItems,
  getChecklist,
  getDocumentFramework,
} from '@/lib/interpretation/service';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, IParagraphOptions } from 'docx';
import PdfPrinter from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

function buildExportData(interpretation: any, technicalSpecs: any[], scoringItems: any[], checklist: any[], framework: any[]) {
  return {
    interpretation: {
      id: interpretation.id,
      documentName: interpretation.documentName,
      projectName: interpretation.projectName,
      projectCode: interpretation.projectCode,
      tenderOrganization: interpretation.tenderOrganization,
      tenderAgent: interpretation.tenderAgent,
      projectBudget: interpretation.projectBudget,
      status: interpretation.status,
      extractAccuracy: interpretation.extractAccuracy,
      createdAt: interpretation.createdAt,
    },
    basicInfo: interpretation.basicInfo,
    timeNodes: interpretation.timeNodes,
    submissionRequirements: interpretation.submissionRequirements,
    feeInfo: interpretation.feeInfo,
    qualificationRequirements: interpretation.qualificationRequirements,
    personnelRequirements: interpretation.personnelRequirements,
    docRequirements: interpretation.docRequirements,
    otherRequirements: interpretation.otherRequirements,
    technicalSpecs,
    scoringItems,
    checklist,
    framework,
  };
}

function generateExcel(exportData: any, filename: string): Uint8Array {
  const wb = XLSX.utils.book_new();
  
  if (exportData.interpretation) {
    const basicData = [['', '']];
    Object.entries(exportData.interpretation).forEach(([k, v]) => {
      basicData.push([k, String(v ?? '')]);
    });
    if (exportData.basicInfo) {
      Object.entries(exportData.basicInfo).forEach(([k, v]) => {
        basicData.push([k, String(v ?? '')]);
      });
    }
    const ws = XLSX.utils.aoa_to_sheet(basicData);
    XLSX.utils.book_append_sheet(wb, ws, '基本信息');
  }
  
  if (exportData.technicalSpecs?.length) {
    const data = exportData.technicalSpecs.map((item: any) => ({
      类别: item.category || '',
      名称: item.name || '',
      要求: item.requirement || '',
      备注: item.note || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '技术规格');
  }
  
  if (exportData.scoringItems?.length) {
    const data = exportData.scoringItems.map((item: any) => ({
      类别: item.category || '',
      项目: item.itemName || '',
      分值: item.score || '',
      评分标准: item.criteria || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '评分细则');
  }
  
  if (exportData.checklist?.length) {
    const data = exportData.checklist.map((item: any) => ({
      类别: item.category || '',
      项目: item.itemName || '',
      要求: item.requirement || '',
      是否具备: item.isMet ? '是' : '否',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '核对清单');
  }
  
  if (exportData.framework?.length) {
    const data = exportData.framework.map((item: any) => ({
      章节: item.chapter || '',
      标题: item.title || '',
      关键内容: item.keyContent || '',
      页码: item.pageNum || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '文档框架');
  }
  
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })) as unknown as Uint8Array;
}

async function generateWord(exportData: any, filename: string): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [];
  
  children.push(new Paragraph({
    text: exportData.interpretation?.projectName || '标书解读结果',
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  }));
  
  if (exportData.interpretation) {
    children.push(new Paragraph({
      text: '基本信息',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    }));
    
    const infoRows = Object.entries(exportData.interpretation).map(([k, v]) => 
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: String(v ?? '') })] }),
        ],
      })
    );
    
    children.push(new Table({
      rows: infoRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  
  if (exportData.technicalSpecs?.length) {
    children.push(new Paragraph({
      text: '技术规格',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    }));
    
    const specRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '类别', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '名称', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '要求', bold: true })] })] }),
        ],
      }),
      ...exportData.technicalSpecs.map((item: any) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: item.category || '' })] }),
            new TableCell({ children: [new Paragraph({ text: item.name || '' })] }),
            new TableCell({ children: [new Paragraph({ text: item.requirement || '' })] }),
          ],
        })
      ),
    ];
    
    children.push(new Table({
      rows: specRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  
  if (exportData.scoringItems?.length) {
    children.push(new Paragraph({
      text: '评分细则',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    }));
    
    const scoreRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '类别', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '项目', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '分值', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '评分标准', bold: true })] })] }),
        ],
      }),
      ...exportData.scoringItems.map((item: any) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: item.category || '' })] }),
            new TableCell({ children: [new Paragraph({ text: item.itemName || '' })] }),
            new TableCell({ children: [new Paragraph({ text: String(item.score ?? '') })] }),
            new TableCell({ children: [new Paragraph({ text: item.criteria || '' })] }),
          ],
        })
      ),
    ];
    
    children.push(new Table({
      rows: scoreRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  
  if (exportData.checklist?.length) {
    children.push(new Paragraph({
      text: '核对清单',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    }));
    
    const checkRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '项目', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '要求', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '是否具备', bold: true })] })] }),
        ],
      }),
      ...exportData.checklist.map((item: any) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: item.itemName || '' })] }),
            new TableCell({ children: [new Paragraph({ text: item.requirement || '' })] }),
            new TableCell({ children: [new Paragraph({ text: item.isMet ? '是' : '否' })] }),
          ],
        })
      ),
    ];
    
    children.push(new Table({
      rows: checkRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  
  const doc = new Document({
    sections: [{ children }],
  });
  
  return Buffer.from(await Packer.toBuffer(doc)) as unknown as Uint8Array;
}

function generateTxt(exportData: any): string {
  let content = '';
  
  if (exportData.interpretation) {
    content += '=== 基本信息 ===\n';
    Object.entries(exportData.interpretation).forEach(([k, v]) => {
      content += `${k}: ${v}\n`;
    });
    content += '\n';
  }
  
  if (exportData.basicInfo) {
    content += '=== 详细信息 ===\n';
    Object.entries(exportData.basicInfo).forEach(([k, v]) => {
      content += `${k}: ${v}\n`;
    });
    content += '\n';
  }
  
  if (exportData.timeNodes?.length) {
    content += '=== 时间节点 ===\n';
    exportData.timeNodes.forEach((item: any) => {
      content += `- ${item.title}: ${item.time}\n`;
    });
    content += '\n';
  }
  
  if (exportData.technicalSpecs?.length) {
    content += '=== 技术规格 ===\n';
    exportData.technicalSpecs.forEach((item: any) => {
      content += `[${item.category}] ${item.name}: ${item.requirement}\n`;
    });
    content += '\n';
  }
  
  if (exportData.scoringItems?.length) {
    content += '=== 评分细则 ===\n';
    exportData.scoringItems.forEach((item: any) => {
      content += `[${item.category}] ${item.itemName}: ${item.score}分 - ${item.criteria}\n`;
    });
    content += '\n';
  }
  
  if (exportData.checklist?.length) {
    content += '=== 核对清单 ===\n';
    exportData.checklist.forEach((item: any) => {
      content += `[${item.isMet ? '✓' : '✗'}] ${item.itemName}: ${item.requirement}\n`;
    });
    content += '\n';
  }
  
  return content;
}

function generatePdf(exportData: any): Uint8Array {
  (PdfPrinter as any).setFonts({
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  });
  
  const pdfPrinter = new PdfPrinter((PdfPrinter as any).getFonts());
  
  const content: any[] = [];
  
  if (exportData.interpretation) {
    content.push({ text: '基本信息', style: 'header', pageBreak: 'before' });
    const tableRows = Object.entries(exportData.interpretation).map(([k, v]) => [
      { text: k, bold: true },
      String(v ?? ''),
    ]);
    content.push({
      table: { body: tableRows },
      layout: 'lightHorizontalLines',
    });
  }
  
  if (exportData.technicalSpecs?.length) {
    content.push({ text: '技术规格', style: 'header', pageBreak: 'before' });
    const tableRows = [
      [{ text: '类别', bold: true }, { text: '名称', bold: true }, { text: '要求', bold: true }],
      ...exportData.technicalSpecs.map((item: any) => [item.category || '', item.name || '', item.requirement || '']),
    ];
    content.push({ table: { body: tableRows }, layout: 'lightHorizontalLines' });
  }
  
  if (exportData.scoringItems?.length) {
    content.push({ text: '评分细则', style: 'header', pageBreak: 'before' });
    const tableRows = [
      [{ text: '类别', bold: true }, { text: '项目', bold: true }, { text: '分值', bold: true }, { text: '评分标准', bold: true }],
      ...exportData.scoringItems.map((item: any) => [
        item.category || '',
        item.itemName || '',
        String(item.score ?? ''),
        item.criteria || '',
      ]),
    ];
    content.push({ table: { body: tableRows }, layout: 'lightHorizontalLines' });
  }
  
  if (exportData.checklist?.length) {
    content.push({ text: '核对清单', style: 'header', pageBreak: 'before' });
    const tableRows = [
      [{ text: '项目', bold: true }, { text: '要求', bold: true }, { text: '是否具备', bold: true }],
      ...exportData.checklist.map((item: any) => [
        item.itemName || '',
        item.requirement || '',
        item.isMet ? '是' : '否',
      ]),
    ];
    content.push({ table: { body: tableRows }, layout: 'lightHorizontalLines' });
  }
  
  const docDefinition: any = {
    content,
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
    },
    defaultStyle: { fontSize: 10 },
  };
  
  return pdfPrinter.createPdfKitDocument(docDefinition) as unknown as Uint8Array;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const interpretationId = parseInt(id);

    if (isNaN(interpretationId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // json / excel / word
    const modules = searchParams.get('modules')?.split(',') || ['all'];

    // 获取数据
    const [interpretation, technicalSpecs, scoringItems, checklist, framework] = await Promise.all([
      getInterpretationById(interpretationId),
      modules.includes('specs') || modules.includes('all') ? getTechnicalSpecs(interpretationId) : [],
      modules.includes('scoring') || modules.includes('all') ? getScoringItems(interpretationId) : [],
      modules.includes('checklist') || modules.includes('all') ? getChecklist(interpretationId) : [],
      modules.includes('framework') || modules.includes('all') ? getDocumentFramework(interpretationId) : [],
    ]);

    if (!interpretation) {
      return NextResponse.json({ error: '解读记录不存在' }, { status: 404 });
    }

    // 构建导出数据
    const exportData = buildExportData(interpretation, technicalSpecs, scoringItems, checklist, framework);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${interpretation.projectName || interpretation.documentName || '解读结果'}_${timestamp}`;

    if (format === 'json') {
      const jsonStr = JSON.stringify({ success: true, data: exportData }, null, 2);
      return new NextResponse(jsonStr, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      });
    }

    if (format === 'excel') {
      const buffer = generateExcel(exportData, filename);
      const bytes = Uint8Array.from(buffer);
      const body = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    if (format === 'word') {
      const buffer = await generateWord(exportData, filename);
      const bytes = Uint8Array.from(buffer);
      const body = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${filename}.docx"`,
        },
      });
    }

    if (format === 'txt') {
      const content = generateTxt(exportData);
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.txt"`,
        },
      });
    }

    if (format === 'pdf') {
      const buffer = generatePdf(exportData);
      const bytes = Uint8Array.from(buffer);
      const body = new Blob([bytes], { type: 'application/pdf' });
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: '不支持的导出格式' }, { status: 400 });
  } catch (error) {
    console.error('导出解读结果失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出失败' },
      { status: 500 }
    );
  }
}

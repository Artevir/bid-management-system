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
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';

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
    raw: {
      documentName: interpretation.documentName,
      projectName: interpretation.projectName,
      projectCode: interpretation.projectCode,
      tenderOrganization: interpretation.tenderOrganization,
      tenderAgent: interpretation.tenderAgent,
      projectBudget: interpretation.projectBudget,
      tenderNumber: interpretation.tenderNumber,
      tenderCategory: interpretation.tenderCategory,
      announcementType: interpretation.announcementType,
      deliveryAddress: interpretation.deliveryAddress,
      bidBond: interpretation.bidBond,
      budgetAmount: interpretation.budgetAmount,
      basicInfo: interpretation.basicInfo,
      timeNodes: interpretation.timeNodes,
      submissionRequirements: interpretation.submissionRequirements,
      feeInfo: interpretation.feeInfo,
      qualificationRequirements: interpretation.qualificationRequirements,
      personnelRequirements: interpretation.personnelRequirements,
      docRequirements: interpretation.docRequirements,
      otherRequirements: interpretation.otherRequirements,
    },
  };
}

function generateExcel(exportData: any, filename: string): Uint8Array {
  const wb = XLSX.utils.book_new();
  
  if (exportData.raw) {
    const basicData = [['字段', '值']];
    Object.entries(exportData.raw).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        if (typeof v === 'object') {
          basicData.push([k, JSON.stringify(v)]);
        } else {
          basicData.push([k, String(v)]);
        }
      }
    });
    const ws = XLSX.utils.aoa_to_sheet(basicData);
    XLSX.utils.book_append_sheet(wb, ws, '基本信息');
  }
  
  if (exportData.timeNodes?.length) {
    const data = exportData.timeNodes.map((item: any) => ({
      标题: item.title || '',
      时间: item.time || '',
      说明: item.description || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '时间节点');
  }
  
  if (exportData.submissionRequirements?.length) {
    const data = exportData.submissionRequirements.map((item: any) => ({
      要求类型: item.requirementType || '',
      具体要求: item.requirement || '',
      份数: item.copies || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '提交要求');
  }
  
  if (exportData.feeInfo) {
    const feeData = [['费用项目', '金额/说明']];
    Object.entries(exportData.feeInfo).forEach(([k, v]) => {
      feeData.push([k, String(v ?? '')]);
    });
    const ws = XLSX.utils.aoa_to_sheet(feeData);
    XLSX.utils.book_append_sheet(wb, ws, '费用信息');
  }
  
  if (exportData.qualificationRequirements?.length) {
    const data = exportData.qualificationRequirements.map((item: any) => ({
      类别: item.category || '',
      要求: item.requirement || '',
      说明: item.note || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '资质要求');
  }
  
  if (exportData.personnelRequirements?.length) {
    const data = exportData.personnelRequirements.map((item: any) => ({
      岗位: item.position || '',
      数量: item.count || '',
      要求: item.requirement || '',
      备注: item.note || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '人员要求');
  }
  
  if (exportData.docRequirements?.length) {
    const data = exportData.docRequirements.map((item: any) => ({
      文档类型: item.docType || '',
      份数: item.copies || '',
      要求: item.requirement || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '文档要求');
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
  
  if (exportData.raw?.projectName) {
    children.push(new Paragraph({
      text: exportData.raw.projectName,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }));
  } else {
    children.push(new Paragraph({
      text: '标书解读结果',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }));
  }
  
  if (exportData.raw) {
    children.push(new Paragraph({
      text: '基本信息',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    }));
    
    const infoRows = Object.entries(exportData.raw).filter(([k, v]) => v !== null && v !== undefined).map(([k, v]) => 
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: typeof v === 'object' ? JSON.stringify(v) : String(v) })] }),
        ],
      })
    );
    
    if (infoRows.length > 0) {
      children.push(new Table({
        rows: infoRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }));
    }
  }
  
  if (exportData.timeNodes?.length) {
    children.push(new Paragraph({
      text: '时间节点',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    }));
    
    const timeRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '标题', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '时间', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '说明', bold: true })] })] }),
        ],
      }),
      ...exportData.timeNodes.map((item: any) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: item.title || '' })] }),
            new TableCell({ children: [new Paragraph({ text: item.time || '' })] }),
            new TableCell({ children: [new Paragraph({ text: item.description || '' })] }),
          ],
        })
      ),
    ];
    
    children.push(new Table({
      rows: timeRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  
  if (exportData.submissionRequirements?.length) {
    children.push(new Paragraph({
      text: '提交要求',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    }));
    
    const subRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '要求类型', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '具体要求', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '份数', bold: true })] })] }),
        ],
      }),
      ...exportData.submissionRequirements.map((item: any) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: item.requirementType || '' })] }),
            new TableCell({ children: [new Paragraph({ text: item.requirement || '' })] }),
            new TableCell({ children: [new Paragraph({ text: item.copies || '' })] }),
          ],
        })
      ),
    ];
    
    children.push(new Table({
      rows: subRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  
  if (exportData.feeInfo) {
    children.push(new Paragraph({
      text: '费用信息',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    }));
    
    const feeRows = Object.entries(exportData.feeInfo).filter(([k, v]) => v !== null && v !== undefined).map(([k, v]) => 
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ text: String(v) })] }),
        ],
      })
    );
    
    if (feeRows.length > 0) {
      children.push(new Table({
        rows: feeRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }));
    }
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
  
  if (exportData.raw) {
    content += '========================================\n';
    content += '           基本信息\n';
    content += '========================================\n';
    Object.entries(exportData.raw).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        if (typeof v === 'object') {
          content += `${k}: ${JSON.stringify(v)}\n`;
        } else {
          content += `${k}: ${v}\n`;
        }
      }
    });
    content += '\n';
  }
  
  if (exportData.timeNodes?.length) {
    content += '========================================\n';
    content += '           时间节点\n';
    content += '========================================\n';
    exportData.timeNodes.forEach((item: any) => {
      content += `【${item.title}】\n`;
      content += `  时间: ${item.time || '未指定'}\n`;
      if (item.description) content += `  说明: ${item.description}\n`;
      content += '\n';
    });
  }
  
  if (exportData.submissionRequirements?.length) {
    content += '========================================\n';
    content += '           提交要求\n';
    content += '========================================\n';
    exportData.submissionRequirements.forEach((item: any) => {
      content += `- ${item.requirementType || '要求'}: ${item.requirement || ''}\n`;
      if (item.copies) content += `  份数: ${item.copies}\n`;
      content += '\n';
    });
  }
  
  if (exportData.feeInfo) {
    content += '========================================\n';
    content += '           费用信息\n';
    content += '========================================\n';
    Object.entries(exportData.feeInfo).forEach(([k, v]) => {
      content += `${k}: ${v}\n`;
    });
    content += '\n';
  }
  
  if (exportData.qualificationRequirements?.length) {
    content += '========================================\n';
    content += '           资质要求\n';
    content += '========================================\n';
    exportData.qualificationRequirements.forEach((item: any) => {
      content += `【${item.category || '资质'}】\n`;
      content += `  要求: ${item.requirement || ''}\n`;
      if (item.note) content += `  说明: ${item.note}\n`;
      content += '\n';
    });
  }
  
  if (exportData.personnelRequirements?.length) {
    content += '========================================\n';
    content += '           人员要求\n';
    content += '========================================\n';
    exportData.personnelRequirements.forEach((item: any) => {
      content += `【${item.position || '岗位'}】\n`;
      if (item.count) content += `  人数: ${item.count}\n`;
      if (item.requirement) content += `  要求: ${item.requirement}\n`;
      if (item.note) content += `  备注: ${item.note}\n`;
      content += '\n';
    });
  }
  
  if (exportData.docRequirements?.length) {
    content += '========================================\n';
    content += '           文档要求\n';
    content += '========================================\n';
    exportData.docRequirements.forEach((item: any) => {
      content += `- ${item.docType || '文档'}: ${item.requirement || ''}\n`;
      if (item.copies) content += `  份数: ${item.copies}\n`;
      content += '\n';
    });
  }
  
  if (exportData.technicalSpecs?.length) {
    content += '========================================\n';
    content += '           技术规格\n';
    content += '========================================\n';
    exportData.technicalSpecs.forEach((item: any) => {
      content += `【${item.category || '类别'}】${item.name || ''}\n`;
      content += `  要求: ${item.requirement || ''}\n`;
      if (item.note) content += `  备注: ${item.note}\n`;
      content += '\n';
    });
  }
  
  if (exportData.scoringItems?.length) {
    content += '========================================\n';
    content += '           评分细则\n';
    content += '========================================\n';
    exportData.scoringItems.forEach((item: any) => {
      content += `【${item.category || '类别'}】${item.itemName || ''}\n`;
      content += `  分值: ${item.score || 0}分\n`;
      content += `  标准: ${item.criteria || ''}\n`;
      content += '\n';
    });
  }
  
  if (exportData.checklist?.length) {
    content += '========================================\n';
    content += '           核对清单\n';
    content += '========================================\n';
    exportData.checklist.forEach((item: any) => {
      content += `[${item.isMet ? '✓' : '✗'}] ${item.itemName || ''}\n`;
      content += `  要求: ${item.requirement || ''}\n`;
      content += '\n';
    });
  }
  
  if (exportData.framework?.length) {
    content += '========================================\n';
    content += '           文档框架\n';
    content += '========================================\n';
    exportData.framework.forEach((item: any) => {
      content += `${item.chapter || ''} ${item.title || ''}\n`;
      if (item.keyContent) content += `  关键内容: ${item.keyContent.substring(0, 50)}...\n`;
      if (item.pageNum) content += `  页码: ${item.pageNum}\n`;
      content += '\n';
    });
  }
  
  return content;
}

function generatePdf(exportData: any): Uint8Array {
  const pdfmake = require('pdfmake/build/pdfmake') as any;
  
  pdfmake.setFonts({
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  });
  
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
  
  return pdfmake.createPdfKitDocument(docDefinition) as unknown as Uint8Array;
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
      const encoder = new TextEncoder();
      return new NextResponse(encoder.encode(jsonStr), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.json"`,
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
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
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
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.docx"`,
        },
      });
    }

    if (format === 'txt') {
      const content = generateTxt(exportData);
      const encoder = new TextEncoder();
      return new NextResponse(encoder.encode(content), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.txt"`,
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
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.pdf"`,
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

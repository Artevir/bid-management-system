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
    const exportData = {
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

    if (format === 'json') {
      // JSON格式直接返回
      return NextResponse.json({
        success: true,
        data: exportData,
      });
    }

    // 对于Excel和Word格式，返回数据让前端处理
    // 实际项目中可以在服务端使用exceljs或docx库生成文件
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${interpretation.projectName || interpretation.documentName}_解读结果_${timestamp}`;

    if (format === 'excel') {
      // 生成Excel数据结构
      const excelData = {
        filename: `${filename}.xlsx`,
        sheets: [
          {
            name: '基本信息',
            data: [exportData.interpretation],
          },
          {
            name: '技术规格',
            data: technicalSpecs,
          },
          {
            name: '评分细则',
            data: scoringItems,
          },
          {
            name: '核对清单',
            data: checklist,
          },
        ],
      };

      return NextResponse.json({
        success: true,
        data: excelData,
        message: '请在前端使用Excel库生成文件',
      });
    }

    if (format === 'word') {
      // 生成Word文档结构
      const wordData = {
        filename: `${filename}.docx`,
        content: exportData,
      };

      return NextResponse.json({
        success: true,
        data: wordData,
        message: '请在前端使用docx库生成文件',
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

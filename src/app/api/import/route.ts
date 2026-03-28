/**
 * 数据导入 API
 */

import { NextRequest, NextResponse } from 'next/server';
import ImportExportService, { ExportFormat } from '@/lib/export/import-export-service';

// ============================================
// POST - 导入数据
// ============================================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'project'; // project, document, etc.
    const format = (formData.get('format') as ExportFormat) || ExportFormat.EXCEL;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: '请选择要导入的文件',
      }, { status: 400 });
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    // 解析数据
    let data: any[];
    switch (format) {
      case ExportFormat.EXCEL:
        data = await ImportExportService.importFromExcel(buffer);
        break;
      case ExportFormat.CSV:
        data = await ImportExportService.importFromCSV(buffer);
        break;
      case ExportFormat.JSON:
        data = await ImportExportService.importFromJSON(buffer);
        break;
      default:
        return NextResponse.json({
          success: false,
          error: `不支持的导入格式: ${format}`,
        }, { status: 400 });
    }

    // TODO: 根据类型保存数据到数据库
    // 这里只是示例，实际需要根据不同的类型实现不同的保存逻辑

    console.log(`[Import] 导入了 ${data.length} 条 ${type} 数据`);

    return NextResponse.json({
      success: true,
      data: {
        type,
        format,
        importedCount: data.length,
        data: data.slice(0, 10), // 只返回前10条预览
      },
      message: `成功导入 ${data.length} 条数据`,
    });
  } catch (error) {
    console.error('[Import API] 导入失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '导入失败',
    }, { status: 500 });
  }
}

// ============================================
// POST - 验证导入数据
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, schema } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({
        success: false,
        error: '缺少 data 参数或格式不正确',
      }, { status: 400 });
    }

    if (!schema) {
      return NextResponse.json({
        success: false,
        error: '缺少 schema 参数',
      }, { status: 400 });
    }

    // 验证数据
    const result = ImportExportService.validateImportData(data, schema);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Import API] 验证失败:', error);
    return NextResponse.json({
      success: false,
      error: '验证失败',
    }, { status: 500 });
  }
}

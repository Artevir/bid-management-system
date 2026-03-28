/**
 * 数据导出 API
 */

import { NextRequest, NextResponse } from 'next/server';
import ImportExportService, { ExportFormat } from '@/lib/export/import-export-service';
import { db } from '@/db/index';
import { projects } from '@/db/schema/projects';
import { documents } from '@/db/schema/documents';

// ============================================
// GET - 导出数据
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get('type') || 'project'; // project, document, etc.
    const format = (searchParams.get('format') as ExportFormat) || ExportFormat.EXCEL;
    const filename = searchParams.get('filename') || `${type}_export`;

    let data: any[] = [];
    let prefix = type;

    // 根据类型获取数据
    switch (type) {
      case 'project':
        data = await db.query.projects.findMany({
          orderBy: (projects, { desc }) => [desc(projects.createdAt)],
        });
        break;
      
      case 'document':
        data = await db.query.documents.findMany({
          orderBy: (documents, { desc }) => [desc(documents.createdAt)],
        });
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `不支持的导出类型: ${type}`,
        }, { status: 400 });
    }

    // 导出数据
    let buffer: Buffer;
    switch (format) {
      case ExportFormat.EXCEL:
        buffer = await ImportExportService.exportToExcel(data, { format, filename });
        break;
      case ExportFormat.CSV:
        buffer = await ImportExportService.exportToCSV(data, { format, filename });
        break;
      case ExportFormat.JSON:
        buffer = await ImportExportService.exportToJSON(data, { format, filename });
        break;
      default:
        return NextResponse.json({
          success: false,
          error: `不支持的导出格式: ${format}`,
        }, { status: 400 });
    }

    // 生成文件名
    const fullFilename = ImportExportService.generateFilename(prefix, format);
    const mimeType = ImportExportService.getMimeType(format);

    // 返回文件
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fullFilename)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Export API] 导出失败:', error);
    return NextResponse.json({
      success: false,
      error: '导出失败',
    }, { status: 500 });
  }
}

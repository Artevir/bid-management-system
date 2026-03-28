/**
 * 导入导出服务
 * 支持Excel、CSV、PDF等格式的导入导出
 */

import { cache } from '@/lib/cache';

// ============================================
// 导出格式枚举
// ============================================

export enum ExportFormat {
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
  PDF = 'pdf',
}

// ============================================
// 导入导出配置
// ============================================

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeHeaders?: boolean;
  sheetName?: string; // Excel工作表名称
}

export interface ImportOptions {
  format: ExportFormat;
  skipFirstRow?: boolean; // 跳过首行（通常是标题）
  validate?: boolean; // 验证数据
}

// ============================================
// 导入导出服务类
// ============================================

export class ImportExportService {
  /**
   * 导出数据到Excel
   */
  static async exportToExcel(
    data: any[],
    options: ExportOptions = { format: ExportFormat.EXCEL }
  ): Promise<Buffer> {
    try {
      // TODO: 使用实际的Excel库（如exceljs或xlsx）
      // 这里是简化实现，实际应该使用专业库

      if (data.length === 0) {
        throw new Error('没有数据可导出');
      }

      // 获取所有列名
      const columns = Object.keys(data[0]);

      // 生成CSV格式（临时方案）
      const csvContent = this.generateCSV(data, options);

      return Buffer.from(csvContent, 'utf-8');
    } catch (error) {
      console.error('[ImportExport] 导出Excel失败:', error);
      throw error;
    }
  }

  /**
   * 导出数据到CSV
   */
  static async exportToCSV(
    data: any[],
    options: ExportOptions = { format: ExportFormat.CSV }
  ): Promise<Buffer> {
    try {
      if (data.length === 0) {
        throw new Error('没有数据可导出');
      }

      const csvContent = this.generateCSV(data, options);
      return Buffer.from(csvContent, 'utf-8');
    } catch (error) {
      console.error('[ImportExport] 导出CSV失败:', error);
      throw error;
    }
  }

  /**
   * 导出数据到JSON
   */
  static async exportToJSON(
    data: any[],
    options: ExportOptions = { format: ExportFormat.JSON }
  ): Promise<Buffer> {
    try {
      if (data.length === 0) {
        throw new Error('没有数据可导出');
      }

      const jsonContent = JSON.stringify(data, null, 2);
      return Buffer.from(jsonContent, 'utf-8');
    } catch (error) {
      console.error('[ImportExport] 导出JSON失败:', error);
      throw error;
    }
  }

  /**
   * 从Excel导入数据
   */
  static async importFromExcel(
    buffer: Buffer,
    options: ImportOptions = { format: ExportFormat.EXCEL }
  ): Promise<any[]> {
    try {
      // TODO: 使用实际的Excel库（如exceljs或xlsx）
      // 这里是简化实现，先按CSV处理

      const content = buffer.toString('utf-8');
      return this.parseCSV(content, options);
    } catch (error) {
      console.error('[ImportExport] 导入Excel失败:', error);
      throw error;
    }
  }

  /**
   * 从CSV导入数据
   */
  static async importFromCSV(
    buffer: Buffer,
    options: ImportOptions = { format: ExportFormat.CSV }
  ): Promise<any[]> {
    try {
      const content = buffer.toString('utf-8');
      return this.parseCSV(content, options);
    } catch (error) {
      console.error('[ImportExport] 导入CSV失败:', error);
      throw error;
    }
  }

  /**
   * 从JSON导入数据
   */
  static async importFromJSON(
    buffer: Buffer,
    options: ImportOptions = { format: ExportFormat.JSON }
  ): Promise<any[]> {
    try {
      const content = buffer.toString('utf-8');
      const data = JSON.parse(content);

      if (!Array.isArray(data)) {
        throw new Error('JSON数据必须是数组格式');
      }

      return data;
    } catch (error) {
      console.error('[ImportExport] 导入JSON失败:', error);
      throw error;
    }
  }

  /**
   * 生成CSV内容
   */
  private static generateCSV(data: any[], options: ExportOptions): string {
    const columns = Object.keys(data[0]);
    const rows: string[] = [];

    // 添加标题
    if (options.includeHeaders !== false) {
      rows.push(columns.map(col => `"${col}"`).join(','));
    }

    // 添加数据行
    for (const item of data) {
      const row = columns.map(col => {
        let value = item[col];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        value = String(value);
        // 转义引号和换行
        value = value.replace(/"/g, '""');
        return `"${value}"`;
      });
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * 解析CSV内容
   */
  private static parseCSV(content: string, options: ImportOptions): any[] {
    const lines = content.split('\n').filter(line => line.trim());
    const result: any[] = [];

    if (lines.length === 0) {
      return [];
    }

    // 解析标题
    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);

    // 跳过首行
    const startIndex = options.skipFirstRow ? 1 : 0;
    const startIndexForHeaders = startIndex === 0 ? 0 : 1;
    const headersToUse = startIndex === 0 ? headers : headers;

    // 解析数据行
    for (let i = startIndex; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const item: any = {};

      for (let j = 0; j < headersToUse.length; j++) {
        item[headersToUse[j]] = values[j];
      }

      result.push(item);
    }

    return result;
  }

  /**
   * 解析CSV行
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // 转义的引号
          current += '"';
          i++;
        } else {
          // 开启或关闭引号
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // 逗号分隔
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // 添加最后一个值
    result.push(current.trim());

    return result;
  }

  /**
   * 验证导入数据
   */
  static validateImportData(
    data: any[],
    schema: {
      [key: string]: {
        required?: boolean;
        type?: 'string' | 'number' | 'boolean' | 'date';
        enum?: string[];
        min?: number;
        max?: number;
      };
    }
  ): { valid: boolean; errors: Array<{ row: number; field: string; message: string }> } {
    const errors: Array<{ row: number; field: string; message: string }> = [];

    data.forEach((row, index) => {
      Object.keys(schema).forEach(field => {
        const config = schema[field];
        const value = row[field];

        // 检查必填
        if (config.required && (value === null || value === undefined || value === '')) {
          errors.push({
            row: index + 1,
            field,
            message: `${field} 是必填字段`,
          });
          return;
        }

        // 跳过空值（非必填）
        if (value === null || value === undefined || value === '') {
          return;
        }

        // 检查类型
        if (config.type) {
          if (config.type === 'number' && isNaN(Number(value))) {
            errors.push({
              row: index + 1,
              field,
              message: `${field} 必须是数字`,
            });
          }
          if (config.type === 'boolean' && !['true', 'false', '0', '1'].includes(String(value).toLowerCase())) {
            errors.push({
              row: index + 1,
              field,
              message: `${field} 必须是布尔值`,
            });
          }
          if (config.type === 'date' && isNaN(Date.parse(String(value)))) {
            errors.push({
              row: index + 1,
              field,
              message: `${field} 必须是日期`,
            });
          }
        }

        // 检查枚举值
        if (config.enum && !config.enum.includes(String(value))) {
          errors.push({
            row: index + 1,
            field,
            message: `${field} 的值必须是以下之一: ${config.enum.join(', ')}`,
          });
        }

        // 检查范围
        if (config.min !== undefined && Number(value) < config.min) {
          errors.push({
            row: index + 1,
            field,
            message: `${field} 不能小于 ${config.min}`,
          });
        }
        if (config.max !== undefined && Number(value) > config.max) {
          errors.push({
            row: index + 1,
            field,
            message: `${field} 不能大于 ${config.max}`,
          });
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 生成导出文件名
   */
  static generateFilename(prefix: string, format: ExportFormat): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = format === ExportFormat.EXCEL ? '.xlsx' : `.${format}`;
    return `${prefix}_${timestamp}${ext}`;
  }

  /**
   * 获取文件MIME类型
   */
  static getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      [ExportFormat.EXCEL]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [ExportFormat.CSV]: 'text/csv',
      [ExportFormat.JSON]: 'application/json',
      [ExportFormat.PDF]: 'application/pdf',
    };
    return mimeTypes[format];
  }
}

// ============================================
// 导出
// ============================================

export default ImportExportService;

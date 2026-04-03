import type { DocumentExt } from '@/lib/interpretation/service';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractTextFromDocumentBuffer(
  buffer: Buffer,
  ext: DocumentExt
): Promise<string> {
  if (ext === 'pdf') {
    const mod = await import('pdf-parse');
    const pdfParse: any = (mod as any).default || (mod as any);
    const result = await pdfParse(buffer);
    return normalizeWhitespace(String(result?.text || ''));
  }

  if (ext === 'docx') {
    const mammothMod = await import('mammoth');
    const mammoth: any = (mammothMod as any).default || (mammothMod as any);
    const result = await mammoth.extractRawText({ buffer });
    return normalizeWhitespace(String(result?.value || ''));
  }

  if (ext === 'doc') {
    const mod = await import('word-extractor');
    const WordExtractor: any = (mod as any).default || (mod as any);
    const extractor = new WordExtractor();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bid-doc-'));
    const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}.doc`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      const doc = await extractor.extract(tmpPath);
      const text = typeof doc?.getBody === 'function' ? doc.getBody() : '';
      return normalizeWhitespace(String(text || ''));
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }

  if (ext === 'xls' || ext === 'xlsx') {
    const xlsxMod = await import('xlsx');
    const xlsx: any = (xlsxMod as any).default || (xlsxMod as any);
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    const parts: string[] = [];
    const sheetNames: string[] = workbook.SheetNames || [];
    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets?.[sheetName];
      if (!sheet) continue;
      const rows: string[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false }) || [];
      if (rows.length === 0) continue;
      parts.push(`【${sheetName}】`);
      for (const row of rows) {
        const line = (row || []).map((cell) => String(cell ?? '').trim()).filter(Boolean).join('\t');
        if (line) parts.push(line);
      }
      parts.push('');
    }
    return normalizeWhitespace(parts.join('\n'));
  }

  return '';
}

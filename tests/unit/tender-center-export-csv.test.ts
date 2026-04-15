import { describe, expect, it } from 'vitest';
import {
  buildCsvText,
  getTenderCenterExportColumns,
  isTenderCenterExportViewCode,
} from '@/app/api/tender-center/_export';

describe('Tender Center Export CSV', () => {
  it('validates export view codes', () => {
    expect(isTenderCenterExportViewCode('requirements_export_view')).toBe(true);
    expect(isTenderCenterExportViewCode('unknown_view')).toBe(false);
  });

  it('returns stable ordered columns for requirements view', () => {
    const columns = getTenderCenterExportColumns('requirements_export_view');
    expect(columns).toEqual([
      'requirementId',
      'requirementType',
      'title',
      'content',
      'reviewStatus',
      'confidenceScore',
      'sourcePageNo',
    ]);
  });

  it('builds csv by explicit column order', () => {
    const csv = buildCsvText(
      [
        { b: 'B1', a: 'A1' },
        { b: 'B2', a: 'A2' },
      ],
      ['a', 'b']
    );
    expect(csv).toBe('a,b\nA1,B1\nA2,B2');
  });

  it('escapes comma, quotes and newline for csv', () => {
    const csv = buildCsvText([{ a: 'x,1', b: 'line1\n"line2"' }], ['a', 'b']);
    expect(csv).toBe('a,b\n"x,1","line1\n""line2"""');
  });
});

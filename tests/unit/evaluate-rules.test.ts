import { describe, expect, it } from 'vitest';
import { evaluateRuleExpression } from '@/lib/tender-center/evaluate-rules';

describe('evaluateRuleExpression', () => {
  it('matches keyword any mode', () => {
    expect(
      evaluateRuleExpression(
        { kind: 'keyword', keywords: ['废标'], matchMode: 'any' },
        '出现废标情形'
      )
    ).toBe(true);
    expect(evaluateRuleExpression({ kind: 'keyword', keywords: ['废标'] }, '无')).toBe(false);
  });

  it('matches regex pattern', () => {
    expect(
      evaluateRuleExpression({ kind: 'regex', pattern: '开标.*2026' }, '开标时间 2026年1月1日')
    ).toBe(true);
  });
});

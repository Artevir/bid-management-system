import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { ruleDefinitions } from '@/db/schema';

/** 010 约束：规则命中须引用 rule_definition；此处为平台内置最小规则集（可后续在库内扩展）。 */
const BUILTIN_RULE_ROWS = [
  {
    ruleCode: 'TC-HUB-R-001',
    ruleName: '强制性义务表述',
    ruleCategory: 'compliance',
    expressionJson: { kind: 'keyword', keywords: ['必须', '应当', '须', '不得', '严禁'] },
    severityLevel: 'medium' as const,
    note: '用于识别义务强度较高的条款，辅助风险分级。',
  },
  {
    ruleCode: 'TC-HUB-R-002',
    ruleName: '否决与废标风险表述',
    ruleCategory: 'compliance',
    expressionJson: { kind: 'keyword', keywords: ['废标', '否决投标', '无效标', '不予受理'] },
    severityLevel: 'blocker' as const,
    note: '与投标有效性直接相关的表述。',
  },
  {
    ruleCode: 'TC-HUB-R-003',
    ruleName: '保证金与价款金额表述',
    ruleCategory: 'commercial',
    expressionJson: { kind: 'keyword', keywords: ['保证金', '保函', '预算', '控制价', '价款'] },
    severityLevel: 'high' as const,
    note: '金额与担保类条款，需重点核对。',
  },
  {
    ruleCode: 'TC-HUB-R-004',
    ruleName: '时间与递交节点表述',
    ruleCategory: 'schedule',
    expressionJson: { kind: 'keyword', keywords: ['截止', '开标', '递交', '提交', '时间', '日期'] },
    severityLevel: 'high' as const,
    note: '程序性时间节点。',
  },
] as const;

export type HubBuiltinRuleIdMap = ReadonlyMap<string, number>;

/**
 * 幂等：按 rule_code 写入内置规则；返回 code -> id 映射供命中与 risk_item.hit_rule_id 使用。
 */
export async function ensureBuiltinHubRuleDefinitions(): Promise<HubBuiltinRuleIdMap> {
  for (const row of BUILTIN_RULE_ROWS) {
    await db
      .insert(ruleDefinitions)
      .values({
        ruleCode: row.ruleCode,
        ruleName: row.ruleName,
        ruleType: 'keyword',
        ruleCategory: row.ruleCategory,
        expressionJson: row.expressionJson,
        severityLevel: row.severityLevel,
        enabledFlag: true,
        versionNo: '1',
        note: row.note,
      })
      .onConflictDoNothing({ target: ruleDefinitions.ruleCode });
  }

  const codes = BUILTIN_RULE_ROWS.map((r) => r.ruleCode);
  const rows = await db
    .select({ id: ruleDefinitions.id, ruleCode: ruleDefinitions.ruleCode })
    .from(ruleDefinitions)
    .where(inArray(ruleDefinitions.ruleCode, codes));

  return new Map(rows.map((r) => [r.ruleCode, r.id]));
}

export type BuiltinRuleHit = {
  ruleId: number;
  severityLevel: 'info' | 'low' | 'medium' | 'high' | 'blocker';
};

/** 为单条风险描述选择最匹配的内置规则（优先级从高到低）。 */
export function resolveBuiltinRuleHit(
  text: string,
  ids: HubBuiltinRuleIdMap
): BuiltinRuleHit | null {
  const t = text || '';
  const pick = (code: string): BuiltinRuleHit | null => {
    const id = ids.get(code);
    if (!id) return null;
    const meta = BUILTIN_RULE_ROWS.find((r) => r.ruleCode === code);
    return { ruleId: id, severityLevel: meta?.severityLevel ?? 'medium' };
  };
  if (/(废标|否决投标|无效标|不予受理)/.test(t)) {
    const r = pick('TC-HUB-R-002');
    if (r) return r;
  }
  if (/(保证金|保函|预算|控制价|价款)/.test(t)) {
    const r = pick('TC-HUB-R-003');
    if (r) return r;
  }
  if (/(截止|开标|递交|提交).*(时间|日期|年|月|日|时|:)/.test(t)) {
    const r = pick('TC-HUB-R-004');
    if (r) return r;
  }
  if (/(必须|应当|须|不得|严禁)/.test(t)) {
    const r = pick('TC-HUB-R-001');
    if (r) return r;
  }
  return null;
}

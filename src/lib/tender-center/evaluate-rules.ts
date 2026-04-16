/**
 * 010 §九-五：规则定义只来自 DB（rule_definition.expression_json），
 * 本模块负责通用求值；ingestion / parse 等业务入口不得再内嵌规则正文。
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { ruleDefinitions } from '@/db/schema';

export type HubRuleEvaluationHit = {
  ruleId: number;
  ruleCode: string;
  severityLevel: 'info' | 'low' | 'medium' | 'high' | 'blocker';
};

const SEVERITY_RANK: Record<string, number> = {
  blocker: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function severityRank(level: string): number {
  return SEVERITY_RANK[level] ?? 0;
}

function readPriority(expressionJson: unknown): number {
  if (!expressionJson || typeof expressionJson !== 'object') return 0;
  const p = (expressionJson as { priority?: unknown }).priority;
  return typeof p === 'number' && Number.isFinite(p) ? p : 0;
}

/**
 * 根据 expression_json 对正文求值；未知 kind 返回 false。
 */
export function evaluateRuleExpression(expressionJson: unknown, text: string): boolean {
  if (!expressionJson || typeof expressionJson !== 'object') return false;
  const expr = expressionJson as {
    kind?: string;
    keywords?: unknown;
    matchMode?: string;
    pattern?: unknown;
    flags?: unknown;
  };
  const t = text || '';

  if (expr.kind === 'keyword') {
    const keywords = Array.isArray(expr.keywords)
      ? expr.keywords.filter((k): k is string => typeof k === 'string' && k.length > 0)
      : [];
    if (keywords.length === 0) return false;
    const mode = expr.matchMode === 'all' ? 'all' : 'any';
    if (mode === 'all') {
      return keywords.every((k) => t.includes(k));
    }
    return keywords.some((k) => t.includes(k));
  }

  if (expr.kind === 'regex') {
    if (typeof expr.pattern !== 'string' || !expr.pattern) return false;
    const flags = typeof expr.flags === 'string' ? expr.flags : '';
    try {
      return new RegExp(expr.pattern, flags || undefined).test(t);
    } catch {
      return false;
    }
  }

  return false;
}

async function loadActiveHubRules() {
  return db
    .select({
      id: ruleDefinitions.id,
      ruleCode: ruleDefinitions.ruleCode,
      expressionJson: ruleDefinitions.expressionJson,
      severityLevel: ruleDefinitions.severityLevel,
    })
    .from(ruleDefinitions)
    .where(and(eq(ruleDefinitions.enabledFlag, true), eq(ruleDefinitions.isDeleted, false)));
}

/**
 * 对给定正文，在已启用的 rule_definition 中求值，返回优先级与严重度最优的一条命中。
 * 若无规则或未命中，返回 null（调用方不得回退到硬编码规则表）。
 */
export async function evaluateBestMatchingHubRule(
  text: string
): Promise<HubRuleEvaluationHit | null> {
  const rules = await loadActiveHubRules();
  if (rules.length === 0) return null;

  const matches: Array<{
    id: number;
    ruleCode: string;
    severityLevel: HubRuleEvaluationHit['severityLevel'];
    priority: number;
  }> = [];

  for (const r of rules) {
    if (!evaluateRuleExpression(r.expressionJson, text)) continue;
    const sev = r.severityLevel;
    if (
      sev !== 'info' &&
      sev !== 'low' &&
      sev !== 'medium' &&
      sev !== 'high' &&
      sev !== 'blocker'
    ) {
      continue;
    }
    matches.push({
      id: r.id,
      ruleCode: r.ruleCode,
      severityLevel: sev,
      priority: readPriority(r.expressionJson),
    });
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return severityRank(b.severityLevel) - severityRank(a.severityLevel);
  });

  const top = matches[0];
  return {
    ruleId: top.id,
    ruleCode: top.ruleCode,
    severityLevel: top.severityLevel,
  };
}

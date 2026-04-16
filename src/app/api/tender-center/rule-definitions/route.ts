import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { assertTenderHubRuleManage } from '@/lib/auth/tender-hub';
import { AppError } from '@/lib/api/error-handler';
import { db } from '@/db';
import { ruleDefinitions } from '@/db/schema';

const RULE_TYPES = new Set(['expression', 'keyword', 'llm', 'composite', 'threshold']);

const SEVERITY_LEVELS = new Set([
  'info',
  'warning',
  'high',
  'critical',
  // legacy兼容
  'low',
  'medium',
  'blocker',
]);

function mapRuleRow(r: typeof ruleDefinitions.$inferSelect) {
  return {
    ruleDefinitionId: r.id,
    ruleCode: r.ruleCode,
    ruleName: r.ruleName,
    ruleType: r.ruleType,
    ruleCategory: r.ruleCategory,
    expressionJson: r.expressionJson,
    severityLevel: r.severityLevel,
    versionNo: r.versionNo,
    note: r.note,
    enabledFlag: r.enabledFlag,
    updatedAt: r.updatedAt,
  };
}

/**
 * 040: GET /api/tender-center/rule-definitions
 * 中枢规则资产只读列表（运行期求值见 evaluate-rules；不在此写业务规则正文）。
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const rows = await db.query.ruleDefinitions.findMany({
      where: and(eq(ruleDefinitions.enabledFlag, true), eq(ruleDefinitions.isDeleted, false)),
      orderBy: [asc(ruleDefinitions.ruleCode)],
    });
    const data = rows.map((r) => mapRuleRow(r));
    return NextResponse.json({ success: true, data });
  });
}

/**
 * 运营：新增 rule_definition（内置种子仍由 contracts JSON 管理；此处供运营扩展规则）。
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    await assertTenderHubRuleManage(userId);

    const body = await req.json().catch(() => ({}));
    const ruleCode = typeof body.ruleCode === 'string' ? body.ruleCode.trim().slice(0, 200) : '';
    const ruleName = typeof body.ruleName === 'string' ? body.ruleName.trim().slice(0, 500) : '';
    if (!ruleCode || !ruleName) {
      throw AppError.badRequest('ruleCode、ruleName 必填');
    }

    const ruleTypeRaw = typeof body.ruleType === 'string' ? body.ruleType.trim() : 'expression';
    if (!RULE_TYPES.has(ruleTypeRaw)) {
      throw AppError.badRequest('ruleType 非法');
    }
    const ruleType = ruleTypeRaw as 'expression' | 'keyword' | 'llm' | 'composite' | 'threshold';

    let expressionJson: Record<string, unknown> = {};
    if (body.expressionJson !== undefined && body.expressionJson !== null) {
      if (typeof body.expressionJson !== 'object' || Array.isArray(body.expressionJson)) {
        throw AppError.badRequest('expressionJson 须为对象');
      }
      expressionJson = body.expressionJson as Record<string, unknown>;
    }

    const sevRaw = typeof body.severityLevel === 'string' ? body.severityLevel.trim() : 'warning';
    if (!SEVERITY_LEVELS.has(sevRaw)) {
      throw AppError.badRequest('severityLevel 非法');
    }
    const severityLevel = sevRaw as
      | 'info'
      | 'warning'
      | 'high'
      | 'critical'
      | 'low'
      | 'medium'
      | 'blocker';

    const ruleCategory =
      body.ruleCategory === undefined || body.ruleCategory === null
        ? null
        : String(body.ruleCategory).trim().slice(0, 200) || null;
    const versionNo =
      body.versionNo === undefined || body.versionNo === null
        ? 'v1'
        : String(body.versionNo).trim().slice(0, 64) || 'v1';
    const note =
      body.note === undefined || body.note === null
        ? null
        : String(body.note).trim().slice(0, 2000) || null;
    const enabledFlag = body.enabledFlag === false ? false : true;

    try {
      const inserted = await db
        .insert(ruleDefinitions)
        .values({
          ruleCode,
          ruleName,
          ruleType,
          ruleCategory,
          expressionJson,
          severityLevel,
          enabledFlag,
          versionNo,
          note,
        })
        .returning();
      const r = inserted[0];
      if (!r) throw AppError.internal('创建规则失败');
      return NextResponse.json({ success: true, data: mapRuleRow(r) });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23505') {
        throw AppError.conflict('ruleCode + versionNo 已存在');
      }
      throw e;
    }
  });
}

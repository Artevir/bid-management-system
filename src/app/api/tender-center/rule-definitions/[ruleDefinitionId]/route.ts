import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { assertTenderHubRuleManage } from '@/lib/auth/tender-hub';
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

// 运营：更新 rule_definition（不允许改 ruleCode，避免外键与命中记录语义漂移）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleDefinitionId: string }> }
) {
  const { ruleDefinitionId } = await params;
  const id = parseResourceId(ruleDefinitionId, '规则');

  return withAuth(request, async (req, userId) => {
    await assertTenderHubRuleManage(userId);

    const existing = await db.query.ruleDefinitions.findFirst({
      where: and(eq(ruleDefinitions.id, id), eq(ruleDefinitions.isDeleted, false)),
    });
    if (!existing) {
      throw AppError.notFound('规则');
    }

    const body = await req.json().catch(() => ({}));
    const patch: Partial<typeof ruleDefinitions.$inferInsert> = {};

    if (typeof body.ruleName === 'string') {
      const v = body.ruleName.trim().slice(0, 500);
      if (!v) throw AppError.badRequest('ruleName 不能为空');
      patch.ruleName = v;
    }
    if (typeof body.ruleType === 'string') {
      const v = body.ruleType.trim();
      if (!RULE_TYPES.has(v)) throw AppError.badRequest('ruleType 非法');
      patch.ruleType = v as 'expression' | 'keyword' | 'llm' | 'composite' | 'threshold';
    }
    if (body.ruleCategory !== undefined) {
      patch.ruleCategory =
        body.ruleCategory === null ? null : String(body.ruleCategory).trim().slice(0, 200) || null;
    }
    if (body.expressionJson !== undefined) {
      if (body.expressionJson === null) {
        patch.expressionJson = null;
      } else if (typeof body.expressionJson === 'object' && !Array.isArray(body.expressionJson)) {
        patch.expressionJson = body.expressionJson as Record<string, unknown>;
      } else {
        throw AppError.badRequest('expressionJson 须为对象或 null');
      }
    }
    if (typeof body.severityLevel === 'string') {
      const v = body.severityLevel.trim();
      if (!SEVERITY_LEVELS.has(v)) throw AppError.badRequest('severityLevel 非法');
      patch.severityLevel = v as
        | 'info'
        | 'warning'
        | 'high'
        | 'critical'
        | 'low'
        | 'medium'
        | 'blocker';
    }
    if (body.versionNo !== undefined) {
      if (body.versionNo === null) {
        throw AppError.badRequest('versionNo 不能为空');
      }
      patch.versionNo = String(body.versionNo).trim().slice(0, 64) || 'v1';
    }
    if (body.note !== undefined) {
      patch.note = body.note === null ? null : String(body.note).trim().slice(0, 2000) || null;
    }
    if (typeof body.enabledFlag === 'boolean') {
      patch.enabledFlag = body.enabledFlag;
    }

    if (Object.keys(patch).length === 0) {
      throw AppError.badRequest('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const rows = await db
      .update(ruleDefinitions)
      .set(patch)
      .where(and(eq(ruleDefinitions.id, id), eq(ruleDefinitions.isDeleted, false)))
      .returning();
    const row = rows[0];
    if (!row) throw AppError.notFound('规则');
    return NextResponse.json({ success: true, data: mapRuleRow(row) });
  });
}

// 运营：软删除规则（停用并标记删除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleDefinitionId: string }> }
) {
  const { ruleDefinitionId } = await params;
  const id = parseResourceId(ruleDefinitionId, '规则');

  return withAuth(request, async (_req, userId) => {
    await assertTenderHubRuleManage(userId);

    const rows = await db
      .update(ruleDefinitions)
      .set({
        enabledFlag: false,
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(and(eq(ruleDefinitions.id, id), eq(ruleDefinitions.isDeleted, false)))
      .returning();
    const row = rows[0];
    if (!row) {
      throw AppError.notFound('规则');
    }
    return NextResponse.json({ success: true, data: { ruleDefinitionId: row.id } });
  });
}

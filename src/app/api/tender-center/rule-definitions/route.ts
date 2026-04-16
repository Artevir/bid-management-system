import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { ruleDefinitions } from '@/db/schema';

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
    const data = rows.map((r) => ({
      ruleDefinitionId: r.id,
      ruleCode: r.ruleCode,
      ruleName: r.ruleName,
      ruleType: r.ruleType,
      ruleCategory: r.ruleCategory,
      expressionJson: r.expressionJson,
      severityLevel: r.severityLevel,
      versionNo: r.versionNo,
      note: r.note,
      updatedAt: r.updatedAt,
    }));
    return NextResponse.json({ success: true, data });
  });
}

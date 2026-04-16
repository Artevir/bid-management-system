/**
 * 中枢内置规则：仅从 contracts/tender-center-builtin-rules.json 写入 rule_definition。
 * 与业务 service 解耦；运行期由 evaluate-rules 读取 expression_json 解释执行。
 */
import fs from 'fs/promises';
import path from 'path';
import { db } from './index';
import { ruleDefinitions } from './schema';

type HubRuleSeedFile = {
  version: string;
  rules: Array<{
    ruleCode: string;
    ruleName: string;
    ruleCategory?: string | null;
    ruleType: 'expression' | 'keyword' | 'llm' | 'composite' | 'threshold';
    expressionJson: Record<string, unknown>;
    severityLevel: 'info' | 'low' | 'medium' | 'high' | 'blocker';
    versionNo?: string | null;
    note?: string | null;
  }>;
};

export async function seedTenderCenterHubRulesFromContract(): Promise<void> {
  const filePath = path.resolve(process.cwd(), 'contracts', 'tender-center-builtin-rules.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw) as HubRuleSeedFile;
  if (!data?.rules?.length) {
    console.log('   ⚠ tender-center-builtin-rules.json 无 rules 数组，跳过');
    return;
  }

  for (const r of data.rules) {
    await db
      .insert(ruleDefinitions)
      .values({
        ruleCode: r.ruleCode,
        ruleName: r.ruleName,
        ruleType: r.ruleType,
        ruleCategory: r.ruleCategory ?? null,
        expressionJson: r.expressionJson,
        severityLevel: r.severityLevel,
        enabledFlag: true,
        versionNo: r.versionNo ?? data.version,
        note: r.note ?? null,
      })
      .onConflictDoNothing({ target: [ruleDefinitions.ruleCode, ruleDefinitions.versionNo] });
  }

  console.log(`   ✓ 中枢内置规则种子：${data.rules.length} 条（幂等 rule_code + version_no）`);
}

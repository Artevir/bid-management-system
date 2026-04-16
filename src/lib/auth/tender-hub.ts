import { AppError } from '@/lib/api/error-handler';
import { hasPermission } from '@/lib/auth/permission';

export async function assertTenderHubRuleManage(userId: number): Promise<void> {
  if (!(await hasPermission(userId, 'tender_hub:rule_manage'))) {
    throw AppError.forbidden('仅运营角色可管理中枢规则');
  }
}

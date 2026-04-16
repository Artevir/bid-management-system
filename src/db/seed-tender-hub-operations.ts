import { eq } from 'drizzle-orm';
import { db } from './index';
import { permissions, rolePermissions, roles } from './schema';

/** 运营角色 + 中枢规则管理权限（幂等；每次 seed 可执行） */
export async function seedTenderHubRuleManageCapability(): Promise<void> {
  await db
    .insert(permissions)
    .values({
      name: '招标文件中枢-规则管理',
      code: 'tender_hub:rule_manage',
      resource: 'tender_hub',
      action: 'rule_manage',
      type: 'api',
      description: '创建/更新/停用中枢规则定义（运营）',
    })
    .onConflictDoNothing({ target: permissions.code });

  await db
    .insert(roles)
    .values({
      name: '运营',
      code: 'operations',
      description: '招标文件智能审阅中枢运营',
      isSystem: true,
      level: 2,
    })
    .onConflictDoNothing({ target: roles.code });

  const permRow = await db.query.permissions.findFirst({
    where: eq(permissions.code, 'tender_hub:rule_manage'),
  });
  const opsRole = await db.query.roles.findFirst({
    where: eq(roles.code, 'operations'),
  });
  const superRole = await db.query.roles.findFirst({
    where: eq(roles.code, 'super_admin'),
  });

  if (permRow && opsRole) {
    await db
      .insert(rolePermissions)
      .values({ roleId: opsRole.id, permissionId: permRow.id })
      .onConflictDoNothing();
  }
  if (permRow && superRole) {
    await db
      .insert(rolePermissions)
      .values({ roleId: superRole.id, permissionId: permRow.id })
      .onConflictDoNothing();
  }

  console.log('   OK tender_hub:rule_manage + operations role (idempotent)');
}

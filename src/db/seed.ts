/**
 * 数据库种子数据脚本
 * 仅用于开发和测试环境，初始化基础数据
 *
 * 使用方式：
 * - 开发环境: pnpm db:seed
 * - 测试环境: 自动执行
 * - 生产环境: 禁止执行（会有安全检查）
 */

import { db } from './index';
import {
  departments,
  roles,
  permissions,
  users,
  userRoles,
  rolePermissions,
  companies,
  knowledgeCategories,
  promptCategories,
  projects,
  bidDocumentInterpretations,
  bidTechnicalSpecs,
  bidScoringItems,
  bidRequirementChecklist,
  bidInterpretationLogs,
} from './schema';
import { hash } from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { seedTenderCenterHubRulesFromContract } from './seed-hub-rules';

// 环境安全检查
function checkEnvironment() {
  const nodeEnv = process.env.NODE_ENV;
  const allowSeed = process.env.ALLOW_SEED_DATA === 'true';

  if (nodeEnv === 'production' && !allowSeed) {
    console.error('❌ 禁止在生产环境执行种子数据脚本！');
    console.error('如需强制执行，请设置环境变量: ALLOW_SEED_DATA=true');
    process.exit(1);
  }

  console.log(`🌱 当前环境: ${nodeEnv || 'development'}`);
  console.log('✅ 环境检查通过，开始执行种子数据初始化...\n');
}

// 检查是否已初始化
async function checkInitialized(): Promise<boolean> {
  const existingUsers = await db.select().from(users).limit(1);
  return existingUsers.length > 0;
}

// 初始化部门
async function seedDepartments() {
  console.log('📋 初始化部门数据...');

  const depts = [
    { name: '总公司', code: 'HQ', level: 1, sortOrder: 0 },
    { name: '技术部', code: 'TECH', level: 2, sortOrder: 1 },
    { name: '商务部', code: 'BIZ', level: 2, sortOrder: 2 },
    { name: '财务部', code: 'FIN', level: 2, sortOrder: 3 },
    { name: '人力行政部', code: 'HR', level: 2, sortOrder: 4 },
  ];

  for (const dept of depts) {
    await db.insert(departments).values(dept).onConflictDoNothing();
  }

  console.log(`   ✓ 已创建 ${depts.length} 个部门`);
  return await db.select().from(departments);
}

// 初始化角色
async function seedRoles() {
  console.log('👥 初始化角色数据...');

  const rolesData = [
    { name: '超级管理员', code: 'super_admin', level: 1, isSystem: true },
    { name: '管理员', code: 'admin', level: 2, isSystem: true },
    { name: '项目经理', code: 'project_manager', level: 3, isSystem: false },
    { name: '商务专员', code: 'business', level: 4, isSystem: false },
    { name: '技术专员', code: 'technical', level: 4, isSystem: false },
    { name: '普通用户', code: 'user', level: 5, isSystem: false },
  ];

  for (const role of rolesData) {
    await db.insert(roles).values(role).onConflictDoNothing();
  }

  console.log(`   ✓ 已创建 ${rolesData.length} 个角色`);
  return await db.select().from(roles);
}

// 初始化权限
async function seedPermissions() {
  console.log('🔐 初始化权限数据...');

  const perms = [
    // 项目权限
    { name: '查看项目', code: 'project:read', resource: 'project', action: 'read' },
    { name: '创建项目', code: 'project:create', resource: 'project', action: 'create' },
    { name: '编辑项目', code: 'project:update', resource: 'project', action: 'update' },
    { name: '删除项目', code: 'project:delete', resource: 'project', action: 'delete' },

    // 文档权限
    { name: '查看文档', code: 'document:read', resource: 'document', action: 'read' },
    { name: '创建文档', code: 'document:create', resource: 'document', action: 'create' },
    { name: '编辑文档', code: 'document:update', resource: 'document', action: 'update' },
    { name: '删除文档', code: 'document:delete', resource: 'document', action: 'delete' },
    { name: '导出文档', code: 'document:export', resource: 'document', action: 'export' },

    // 文件权限
    { name: '上传文件', code: 'file:upload', resource: 'file', action: 'upload' },
    { name: '下载文件', code: 'file:download', resource: 'file', action: 'download' },
    { name: '删除文件', code: 'file:delete', resource: 'file', action: 'delete' },

    // 用户权限
    { name: '查看用户', code: 'user:read', resource: 'user', action: 'read' },
    { name: '创建用户', code: 'user:create', resource: 'user', action: 'create' },
    { name: '编辑用户', code: 'user:update', resource: 'user', action: 'update' },
    { name: '删除用户', code: 'user:delete', resource: 'user', action: 'delete' },

    // 系统权限
    { name: '系统配置', code: 'system:config', resource: 'system', action: 'config' },
    { name: '审计日志', code: 'system:audit', resource: 'system', action: 'audit' },
  ];

  let count = 0;
  for (const perm of perms) {
    const result = await db.insert(permissions).values(perm).onConflictDoNothing();
    if (result.rowCount && result.rowCount > 0) count++;
  }

  console.log(`   ✓ 已创建 ${perms.length} 个权限`);
  return await db.select().from(permissions);
}

// 初始化管理员用户
async function seedAdminUsers(depts: any[]) {
  console.log('👤 初始化管理员用户...');

  const hqDept = depts.find((d) => d.code === 'HQ');
  const _techDept = depts.find((d) => d.code === 'TECH');

  if (!hqDept) {
    throw new Error('找不到总公司部门');
  }

  const passwordHash = await hash('Admin@123', 10);

  const adminUsers = [
    {
      username: 'admin',
      email: 'admin@company.com',
      passwordHash,
      realName: '系统管理员',
      departmentId: hqDept.id,
      position: '系统管理员',
      status: 'active' as const,
    },
    {
      username: 'superadmin',
      email: 'superadmin@company.com',
      passwordHash,
      realName: '超级管理员',
      departmentId: hqDept.id,
      position: '超级管理员',
      status: 'active' as const,
    },
  ];

  for (const user of adminUsers) {
    await db.insert(users).values(user).onConflictDoNothing();
  }

  console.log(`   ✓ 已创建 ${adminUsers.length} 个管理员用户`);
  console.log('   ⚠️  默认密码: Admin@123 (请登录后立即修改)');

  return await db.select().from(users);
}

// 分配角色
async function assignRoles(usersList: any[], rolesList: any[]) {
  console.log('🔗 分配用户角色...');

  const adminUser = usersList.find((u) => u.username === 'admin');
  const superAdminUser = usersList.find((u) => u.username === 'superadmin');
  const adminRole = rolesList.find((r) => r.code === 'admin');
  const superAdminRole = rolesList.find((r) => r.code === 'super_admin');

  if (adminUser && adminRole) {
    await db
      .insert(userRoles)
      .values({
        userId: adminUser.id,
        roleId: adminRole.id,
      })
      .onConflictDoNothing();
  }

  if (superAdminUser && superAdminRole) {
    await db
      .insert(userRoles)
      .values({
        userId: superAdminUser.id,
        roleId: superAdminRole.id,
      })
      .onConflictDoNothing();
  }

  console.log('   ✓ 角色分配完成');
}

// 分配角色权限
async function assignPermissions(rolesList: any[], permsList: any[]) {
  console.log('🔗 分配角色权限...');

  const superAdminRole = rolesList.find((r) => r.code === 'super_admin');
  const adminRole = rolesList.find((r) => r.code === 'admin');

  // 超级管理员拥有所有权限
  if (superAdminRole) {
    for (const perm of permsList) {
      await db
        .insert(rolePermissions)
        .values({
          roleId: superAdminRole.id,
          permissionId: perm.id,
        })
        .onConflictDoNothing();
    }
    console.log('   ✓ 超级管理员已分配所有权限');
  }

  // 管理员拥有大部分权限（排除系统配置）
  if (adminRole) {
    const adminPerms = permsList.filter((p) => !p.code.includes('system:config'));
    for (const perm of adminPerms) {
      await db
        .insert(rolePermissions)
        .values({
          roleId: adminRole.id,
          permissionId: perm.id,
        })
        .onConflictDoNothing();
    }
    console.log('   ✓ 管理员已分配权限');
  }
}

// 初始化知识分类
async function seedKnowledgeCategories() {
  console.log('📚 初始化知识分类...');

  const categories = [
    { name: '公司资质', code: 'qualification', icon: 'award' },
    { name: '业绩案例', code: 'performance', icon: 'briefcase' },
    { name: '技术方案', code: 'technical', icon: 'code' },
    { name: '商务模板', code: 'business', icon: 'file-text' },
    { name: '管理制度', code: 'policy', icon: 'book' },
  ];

  for (const cat of categories) {
    await db
      .insert(knowledgeCategories)
      .values({
        name: cat.name,
        code: cat.code,
        icon: cat.icon,
      })
      .onConflictDoNothing();
  }

  console.log(`   ✓ 已创建 ${categories.length} 个知识分类`);
}

// 初始化提示词分类
async function seedPromptCategories() {
  console.log('🤖 初始化提示词分类...');

  const categories = [
    { name: '技术方案', code: 'technical', type: 'technical' },
    { name: '商务标书', code: 'business', type: 'business' },
    { name: '资质证明', code: 'qualification', type: 'qualification' },
    { name: '投标建议书', code: 'proposal', type: 'proposal' },
    { name: '摘要生成', code: 'summary', type: 'summary' },
  ];

  for (const cat of categories) {
    await db
      .insert(promptCategories)
      .values({
        name: cat.name,
        code: cat.code,
        type: cat.type as any,
      })
      .onConflictDoNothing();
  }

  console.log(`   ✓ 已创建 ${categories.length} 个提示词分类`);
}

// 初始化示例公司
async function seedCompanies() {
  console.log('🏢 初始化示例公司...');

  const companiesData = [
    {
      name: '示例科技有限公司',
      shortName: '示例科技',
      creditCode: '91110000MA00XXXXX',
      registerAddress: '北京市海淀区中关村大街1号',
      legalPersonName: '张三',
      contactPersonName: '王五',
      isDefault: true,
    },
    {
      name: '示例信息技术有限公司',
      shortName: '示例信息',
      creditCode: '91110000MA00YYYYY',
      registerAddress: '北京市朝阳区建国门外大街2号',
      legalPersonName: '李四',
      contactPersonName: '赵六',
      isDefault: false,
    },
  ];

  for (const company of companiesData) {
    await db.insert(companies).values(company).onConflictDoNothing();
  }

  console.log(`   ✓ 已创建 ${companiesData.length} 个示例公司`);
}

type W8ScenarioSeedResult = {
  scenario: 'complete' | 'conflict' | 'replay';
  projectCode: string;
  projectId: number;
  interpretationId: number;
};

async function resolveSeedContext() {
  const [allUsers, allDepartments] = await Promise.all([
    db.select().from(users),
    db.select().from(departments),
  ]);
  const owner = allUsers.find((u) => u.username === 'admin') || allUsers[0];
  const ownerDepartment =
    allDepartments.find((d) => d.id === owner?.departmentId) ||
    allDepartments.find((d) => d.code === 'HQ') ||
    allDepartments[0];

  if (!owner || !ownerDepartment) {
    throw new Error('缺少示例项目种子所需的用户/部门上下文');
  }

  return { owner, ownerDepartment };
}

async function ensureScenarioProject(params: {
  code: string;
  name: string;
  status:
    | 'draft'
    | 'parsing'
    | 'preparing'
    | 'reviewing'
    | 'approved'
    | 'submitted'
    | 'awarded'
    | 'lost'
    | 'completed'
    | 'archived';
  ownerId: number;
  departmentId: number;
  description: string;
}) {
  const now = new Date();
  await db
    .insert(projects)
    .values({
      name: params.name,
      code: params.code,
      tenderCode: `${params.code}-TENDER`,
      status: params.status,
      tenderOrganization: '示例招标单位',
      tenderAgent: '示例招标代理机构',
      tenderMethod: '公开招标',
      budget: '12000000',
      publishDate: now,
      submissionDeadline: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      openBidDate: new Date(now.getTime() + 8 * 24 * 3600 * 1000),
      ownerId: params.ownerId,
      departmentId: params.departmentId,
      description: params.description,
      progress: params.status === 'completed' ? 100 : params.status === 'parsing' ? 55 : 80,
      tags: JSON.stringify(['tc3-w8-002', params.code.toLowerCase()]),
      updatedAt: now,
    })
    .onConflictDoNothing();

  const [project] = await db.select().from(projects).where(eq(projects.code, params.code)).limit(1);
  if (!project) {
    throw new Error(`示例项目写入失败: ${params.code}`);
  }
  return project;
}

async function ensureScenarioInterpretation(params: {
  projectId: number;
  ownerId: number;
  scenario: 'complete' | 'conflict' | 'replay';
  documentName: string;
  status: 'pending' | 'parsing' | 'completed' | 'failed';
  reviewStatus: 'pending' | 'approved' | 'rejected';
  parseProgress: number;
  parseError: string | null;
  extractAccuracy: number;
  checklistCount: number;
}) {
  const md5 = `w8-${params.scenario}-20260415-md5`;
  await db
    .insert(bidDocumentInterpretations)
    .values({
      documentName: params.documentName,
      documentUrl: `/seed/${params.scenario}.pdf`,
      documentExt: 'pdf',
      documentSize: 1024 * 128,
      documentMd5: md5,
      documentPageCount: 42,
      projectName: params.documentName.replace('招标文件', '项目'),
      projectCode: `TC3-W8-002-${params.scenario.toUpperCase()}`,
      tenderOrganization: '示例招标单位',
      tenderAgent: '示例招标代理机构',
      projectBudget: '12000000',
      tenderMethod: '公开招标',
      tenderScope: '示例范围',
      status: params.status,
      parseProgress: params.parseProgress,
      parseError: params.parseError,
      extractAccuracy: params.extractAccuracy,
      reviewStatus: params.reviewStatus,
      checklistCount: params.checklistCount,
      specCount: 2,
      scoringCount: 2,
      uploaderId: params.ownerId,
      projectId: params.projectId,
      tags: JSON.stringify(['tc3-w8-002', params.scenario]),
    })
    .onConflictDoNothing();

  const [interpretation] = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(
      and(
        eq(bidDocumentInterpretations.projectId, params.projectId),
        eq(bidDocumentInterpretations.documentMd5, md5)
      )
    )
    .limit(1);
  if (!interpretation) {
    throw new Error(`示例解读写入失败: ${params.scenario}`);
  }
  return interpretation;
}

async function seedScenarioObjects(params: {
  interpretationId: number;
  ownerId: number;
  scenario: 'complete' | 'conflict' | 'replay';
}) {
  const checkStatus =
    params.scenario === 'complete'
      ? 'compliant'
      : params.scenario === 'conflict'
        ? 'non_compliant'
        : 'partial';

  await db
    .insert(bidRequirementChecklist)
    .values({
      interpretationId: params.interpretationId,
      checklistCategory: 'qualification',
      itemName: `资质核对-${params.scenario}`,
      requirementDetail: '需提供有效资质证书',
      requiredValue: '甲级资质',
      requiredDocuments: JSON.stringify(['资质证书', '营业执照']),
      checkStatus,
      actualValue: params.scenario === 'conflict' ? '乙级资质' : '甲级资质',
      isMandatory: true,
      improvementSuggestion: params.scenario === 'conflict' ? '补齐甲级资质或调整投标范围' : '维持',
      pageNumber: 12,
      checkedBy: params.ownerId,
    })
    .onConflictDoNothing();

  await db
    .insert(bidTechnicalSpecs)
    .values({
      interpretationId: params.interpretationId,
      specCategory: 'performance_requirement',
      specName: `响应时间-${params.scenario}`,
      specRequirement: '系统故障 2 小时内响应',
      isMandatory: true,
      responseStatus: params.scenario === 'complete' ? 'compliant' : 'partial',
      pageNumber: 18,
    })
    .onConflictDoNothing();

  await db
    .insert(bidScoringItems)
    .values({
      interpretationId: params.interpretationId,
      scoringCategory: '技术分',
      itemName: `技术能力评分-${params.scenario}`,
      maxScore: 30,
      scoringCriteria: '响应完整性与风险控制',
      responseStatus: params.scenario === 'complete' ? 'responded' : 'pending',
      pageNumber: 24,
    })
    .onConflictDoNothing();

  await db
    .insert(bidInterpretationLogs)
    .values({
      interpretationId: params.interpretationId,
      operationType:
        params.scenario === 'replay' ? 'batch_replay_triggered' : 'batch_seed_initialized',
      operationContent: JSON.stringify({
        scenario: params.scenario,
        note:
          params.scenario === 'complete'
            ? '标准完整场景'
            : params.scenario === 'conflict'
              ? '高风险冲突场景'
              : '部分成功补跑场景',
        triggeredAt: new Date().toISOString(),
      }),
      operatorId: params.ownerId,
      operatorName: 'seed-script',
    })
    .onConflictDoNothing();
}

async function seedW8SampleProjects(): Promise<W8ScenarioSeedResult[]> {
  console.log('🧪 初始化 TC3-W8-002 三类示例项目（完整/冲突/补跑）...');
  const { owner, ownerDepartment } = await resolveSeedContext();
  const scenarios: Array<{
    scenario: 'complete' | 'conflict' | 'replay';
    code: string;
    projectName: string;
    projectStatus: 'completed' | 'reviewing' | 'parsing';
    interpretationStatus: 'completed' | 'parsing';
    reviewStatus: 'approved' | 'pending';
    parseProgress: number;
    parseError: string | null;
    extractAccuracy: number;
    checklistCount: number;
  }> = [
    {
      scenario: 'complete',
      code: 'TC3-W8-002-COMPLETE-20260415',
      projectName: 'W8示例-标准完整场景',
      projectStatus: 'completed',
      interpretationStatus: 'completed',
      reviewStatus: 'approved',
      parseProgress: 100,
      parseError: null,
      extractAccuracy: 96,
      checklistCount: 8,
    },
    {
      scenario: 'conflict',
      code: 'TC3-W8-002-CONFLICT-20260415',
      projectName: 'W8示例-高风险冲突场景',
      projectStatus: 'reviewing',
      interpretationStatus: 'completed',
      reviewStatus: 'pending',
      parseProgress: 100,
      parseError: null,
      extractAccuracy: 88,
      checklistCount: 6,
    },
    {
      scenario: 'replay',
      code: 'TC3-W8-002-REPLAY-20260415',
      projectName: 'W8示例-部分成功补跑场景',
      projectStatus: 'parsing',
      interpretationStatus: 'parsing',
      reviewStatus: 'pending',
      parseProgress: 65,
      parseError: '上轮批次部分任务超时，已触发补跑',
      extractAccuracy: 79,
      checklistCount: 4,
    },
  ];

  const seeded: W8ScenarioSeedResult[] = [];
  for (const item of scenarios) {
    const project = await ensureScenarioProject({
      code: item.code,
      name: item.projectName,
      status: item.projectStatus,
      ownerId: owner.id,
      departmentId: ownerDepartment.id,
      description: `TC3-W8-002 ${item.scenario} 示例数据`,
    });
    const interpretation = await ensureScenarioInterpretation({
      projectId: project.id,
      ownerId: owner.id,
      scenario: item.scenario,
      documentName: `${item.projectName}-招标文件`,
      status: item.interpretationStatus,
      reviewStatus: item.reviewStatus,
      parseProgress: item.parseProgress,
      parseError: item.parseError,
      extractAccuracy: item.extractAccuracy,
      checklistCount: item.checklistCount,
    });
    await seedScenarioObjects({
      interpretationId: interpretation.id,
      ownerId: owner.id,
      scenario: item.scenario,
    });
    seeded.push({
      scenario: item.scenario,
      projectCode: project.code,
      projectId: project.id,
      interpretationId: interpretation.id,
    });
  }

  for (const item of seeded) {
    console.log(
      `   ✓ ${item.scenario}: projectCode=${item.projectCode}, projectId=${item.projectId}, interpretationId=${item.interpretationId}`
    );
  }
  return seeded;
}

// 主函数
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('       投标管理系统 - 数据库种子数据初始化');
  console.log('═══════════════════════════════════════════════════\n');

  // 环境检查
  checkEnvironment();

  // 检查是否已初始化
  const initialized = await checkInitialized();
  if (initialized) {
    console.log('⚠️  基础数据已存在，跳过基础初始化步骤');
  }

  try {
    if (!initialized) {
      // 按顺序初始化基础数据
      const depts = await seedDepartments();
      const rolesList = await seedRoles();
      const permsList = await seedPermissions();
      const usersList = await seedAdminUsers(depts);

      await assignRoles(usersList, rolesList);
      await assignPermissions(rolesList, permsList);

      await seedKnowledgeCategories();
      await seedPromptCategories();
      await seedCompanies();
    }

    const w8ScenarioIds = await seedW8SampleProjects();

    await seedTenderCenterHubRulesFromContract();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ 种子数据初始化完成！');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n🧪 TC3-W8-002 示例项目ID清单:');
    for (const item of w8ScenarioIds) {
      console.log(
        `   ├─ ${item.scenario}: projectId=${item.projectId}, interpretationId=${item.interpretationId}, code=${item.projectCode}`
      );
    }
    console.log('\n📝 默认管理员账号信息:');
    console.log('   ├─ 用户名: admin');
    console.log('   ├─ 密码: Admin@123');
    console.log('   └─ 邮箱: admin@company.com');
    console.log('\n⚠️  请登录后立即修改默认密码！');
    console.log('');
  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    process.exit(1);
  }
}

// 执行
main().catch(console.error);

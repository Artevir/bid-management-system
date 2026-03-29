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
} from './schema';
import { hash } from 'bcryptjs';
import { eq as _eq } from 'drizzle-orm';

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
    if (result.rowCount && result.rowCount > 0) _count++;
  }
  
  console.log(`   ✓ 已创建 ${perms.length} 个权限`);
  return await db.select().from(permissions);
}

// 初始化管理员用户
async function seedAdminUsers(depts: any[]) {
  console.log('👤 初始化管理员用户...');
  
  const hqDept = depts.find(d => d.code === 'HQ');
  const _techDept = depts.find(d => d.code === 'TECH');
  
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
  
  const adminUser = usersList.find(u => u.username === 'admin');
  const superAdminUser = usersList.find(u => u.username === 'superadmin');
  const adminRole = rolesList.find(r => r.code === 'admin');
  const superAdminRole = rolesList.find(r => r.code === 'super_admin');

  if (adminUser && adminRole) {
    await db.insert(userRoles).values({
      userId: adminUser.id,
      roleId: adminRole.id,
    }).onConflictDoNothing();
  }

  if (superAdminUser && superAdminRole) {
    await db.insert(userRoles).values({
      userId: superAdminUser.id,
      roleId: superAdminRole.id,
    }).onConflictDoNothing();
  }
  
  console.log('   ✓ 角色分配完成');
}

// 分配角色权限
async function assignPermissions(rolesList: any[], permsList: any[]) {
  console.log('🔗 分配角色权限...');
  
  const superAdminRole = rolesList.find(r => r.code === 'super_admin');
  const adminRole = rolesList.find(r => r.code === 'admin');

  // 超级管理员拥有所有权限
  if (superAdminRole) {
    for (const perm of permsList) {
      await db.insert(rolePermissions).values({
        roleId: superAdminRole.id,
        permissionId: perm.id,
      }).onConflictDoNothing();
    }
    console.log('   ✓ 超级管理员已分配所有权限');
  }

  // 管理员拥有大部分权限（排除系统配置）
  if (adminRole) {
    const adminPerms = permsList.filter(p => 
      !p.code.includes('system:config')
    );
    for (const perm of adminPerms) {
      await db.insert(rolePermissions).values({
        roleId: adminRole.id,
        permissionId: perm.id,
      }).onConflictDoNothing();
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
    await db.insert(knowledgeCategories).values({
      name: cat.name,
      code: cat.code,
      icon: cat.icon,
    }).onConflictDoNothing();
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
    await db.insert(promptCategories).values({
      name: cat.name,
      code: cat.code,
      type: cat.type as any,
    }).onConflictDoNothing();
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
    console.log('⚠️  数据库已有数据，跳过初始化');
    console.log('   如需重新初始化，请先清空数据库');
    return;
  }

  try {
    // 按顺序初始化
    const depts = await seedDepartments();
    const rolesList = await seedRoles();
    const permsList = await seedPermissions();
    const usersList = await seedAdminUsers(depts);
    
    await assignRoles(usersList, rolesList);
    await assignPermissions(rolesList, permsList);
    
    await seedKnowledgeCategories();
    await seedPromptCategories();
    await seedCompanies();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ 种子数据初始化完成！');
    console.log('═══════════════════════════════════════════════════');
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

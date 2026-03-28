/**
 * 电子签章服务
 * 提供签章配置、印章管理、签署任务管理等功能
 * 
 * 支持的电子签章服务商：
 * 1. 法大大 (fadada) - 国内领先，对接简单
 * 2. e签宝 (esign) - 政府采购常用
 * 3. 契约锁 (qiyuesuo) - 企业级安全
 * 4. 数字宝 (shujubao) - 性价比高
 */

import { db } from '@/db';
import {
  sealConfigs,
  seals,
  signTasks,
  signers,
  signLogs,
  type SealConfig,
  type NewSealConfig,
  type Seal,
  type NewSeal,
  type SignTask,
  type NewSignTask,
  type Signer,
  type NewSigner,
  type SignLog,
  type NewSignLog,
} from '@/db/schema';
import { eq, and, desc, sql, lte, gte, inArray, isNull, or } from 'drizzle-orm';

// ============================================
// 签章配置管理
// ============================================

export async function createSealConfig(data: NewSealConfig): Promise<SealConfig> {
  const [config] = await db.insert(sealConfigs).values(data).returning();
  return config;
}

export async function getSealConfigs(filters?: {
  provider?: string;
  companyId?: number;
  isActive?: boolean;
}): Promise<SealConfig[]> {
  const conditions = [];
  if (filters?.provider) {
    conditions.push(eq(sealConfigs.provider, filters.provider as any));
  }
  if (filters?.companyId) {
    conditions.push(eq(sealConfigs.companyId, filters.companyId));
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(sealConfigs.isActive, filters.isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select()
    .from(sealConfigs)
    .where(whereClause)
    .orderBy(desc(sealConfigs.createdAt));
}

export async function getSealConfigById(id: number): Promise<SealConfig | null> {
  const [config] = await db
    .select()
    .from(sealConfigs)
    .where(eq(sealConfigs.id, id))
    .limit(1);
  return config || null;
}

export async function getDefaultSealConfig(companyId: number): Promise<SealConfig | null> {
  const [config] = await db
    .select()
    .from(sealConfigs)
    .where(
      and(
        eq(sealConfigs.companyId, companyId),
        eq(sealConfigs.isActive, true),
        eq(sealConfigs.isDefault, true)
      )
    )
    .limit(1);
  return config || null;
}

export async function updateSealConfig(id: number, data: Partial<NewSealConfig>): Promise<SealConfig> {
  const [config] = await db
    .update(sealConfigs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sealConfigs.id, id))
    .returning();
  return config;
}

export async function deleteSealConfig(id: number): Promise<void> {
  await db.delete(sealConfigs).where(eq(sealConfigs.id, id));
}

// ============================================
// 电子印章管理
// ============================================

export async function createSeal(data: NewSeal): Promise<Seal> {
  const [seal] = await db.insert(seals).values(data).returning();
  return seal;
}

export async function getSeals(filters?: {
  configId?: number;
  companyId?: number;
  type?: string;
  status?: string;
}): Promise<Seal[]> {
  const conditions = [];
  if (filters?.configId) {
    conditions.push(eq(seals.configId, filters.configId));
  }
  if (filters?.companyId) {
    conditions.push(eq(seals.companyId, filters.companyId));
  }
  if (filters?.type) {
    conditions.push(eq(seals.type, filters.type as any));
  }
  if (filters?.status) {
    conditions.push(eq(seals.status, filters.status as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select()
    .from(seals)
    .where(whereClause)
    .orderBy(desc(seals.createdAt));
}

export async function getSealById(id: number): Promise<Seal | null> {
  const [seal] = await db
    .select()
    .from(seals)
    .where(eq(seals.id, id))
    .limit(1);
  return seal || null;
}

export async function updateSeal(id: number, data: Partial<NewSeal>): Promise<Seal> {
  const [seal] = await db
    .update(seals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(seals.id, id))
    .returning();
  return seal;
}

export async function deleteSeal(id: number): Promise<void> {
  await db.delete(seals).where(eq(seals.id, id));
}

export async function incrementSealUseCount(id: number): Promise<void> {
  await db
    .update(seals)
    .set({
      useCount: sql`${seals.useCount} + 1`,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(seals.id, id));
}

// ============================================
// 签署任务管理
// ============================================

export async function createSignTask(data: NewSignTask): Promise<SignTask> {
  const [task] = await db.insert(signTasks).values(data).returning();
  return task;
}

export async function getSignTasks(filters?: {
  projectId?: number;
  configId?: number;
  status?: string;
  createdBy?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ data: SignTask[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters?.projectId) {
    conditions.push(eq(signTasks.projectId, filters.projectId));
  }
  if (filters?.configId) {
    conditions.push(eq(signTasks.configId, filters.configId));
  }
  if (filters?.status) {
    conditions.push(eq(signTasks.status, filters.status as any));
  }
  if (filters?.createdBy) {
    conditions.push(eq(signTasks.createdBy, filters.createdBy));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(signTasks)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select()
    .from(signTasks)
    .where(whereClause)
    .orderBy(desc(signTasks.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total };
}

export async function getSignTaskById(id: number): Promise<SignTask | null> {
  const [task] = await db
    .select()
    .from(signTasks)
    .where(eq(signTasks.id, id))
    .limit(1);
  return task || null;
}

export async function updateSignTask(id: number, data: Partial<NewSignTask>): Promise<SignTask> {
  const [task] = await db
    .update(signTasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(signTasks.id, id))
    .returning();
  return task;
}

export async function cancelSignTask(id: number): Promise<SignTask> {
  return updateSignTask(id, { status: 'cancelled' });
}

// ============================================
// 签署者管理
// ============================================

export async function createSigner(data: NewSigner): Promise<Signer> {
  const [signer] = await db.insert(signers).values(data).returning();
  return signer;
}

export async function getSignersByTaskId(taskId: number): Promise<Signer[]> {
  return db
    .select()
    .from(signers)
    .where(eq(signers.taskId, taskId))
    .orderBy(signers.sortOrder);
}

export async function updateSigner(id: number, data: Partial<NewSigner>): Promise<Signer> {
  const [signer] = await db
    .update(signers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(signers.id, id))
    .returning();
  return signer;
}

export async function markSignerSigned(id: number): Promise<Signer> {
  return updateSigner(id, {
    status: 'signed',
    signedAt: new Date(),
  });
}

// ============================================
// 签署日志
// ============================================

export async function createSignLog(data: NewSignLog): Promise<SignLog> {
  const [log] = await db.insert(signLogs).values(data).returning();
  return log;
}

export async function getSignLogsByTaskId(taskId: number): Promise<SignLog[]> {
  return db
    .select()
    .from(signLogs)
    .where(eq(signLogs.taskId, taskId))
    .orderBy(desc(signLogs.createdAt));
}

// ============================================
// 签署流程操作
// ============================================

/**
 * 发起签署任务
 */
export async function initiateSignTask(taskId: number): Promise<SignTask> {
  const task = await getSignTaskById(taskId);
  if (!task) {
    throw new Error('签署任务不存在');
  }

  if (task.status !== 'draft') {
    throw new Error('只有草稿状态的签署任务可以发起');
  }

  // 获取签署者列表
  const signers = await getSignersByTaskId(taskId);

  if (signers.length === 0) {
    throw new Error('签署任务没有签署者');
  }

  // 获取签章配置
  const config = await getSealConfigById(task.configId);
  if (!config) {
    throw new Error('签章配置不存在');
  }

  // 调用第三方签署服务
  try {
    // 根据不同服务商调用不同的API
    const externalFlowId = await callThirdPartySignService(config, task, signers);

    // 更新任务状态
    const updatedTask = await updateSignTask(taskId, {
      status: 'signing',
      externalFlowId,
    });

    // 记录日志
    await createSignLog({
      taskId,
      action: 'initiate',
      detail: JSON.stringify({ signersCount: signers.length }),
    });

    return updatedTask;
  } catch (error) {
    // 记录错误日志
    await createSignLog({
      taskId,
      action: 'initiate_failed',
      detail: JSON.stringify({ error: error instanceof Error ? error.message : '未知错误' }),
    });
    throw error;
  }
}

/**
 * 签署回调处理
 */
export async function handleSignCallback(data: {
  flowId: string;
  signerId?: string;
  status: string;
  signedAt?: string;
  documentUrl?: string;
}): Promise<void> {
  // 查找签署任务
  const [task] = await db
    .select()
    .from(signTasks)
    .where(eq(signTasks.externalFlowId, data.flowId))
    .limit(1);

  if (!task) {
    throw new Error('签署任务不存在');
  }

  // 如果是单个签署者完成签署
  if (data.signerId) {
    const [signer] = await db
      .select()
      .from(signers)
      .where(eq(signers.externalAccountId, data.signerId))
      .limit(1);

    if (signer) {
      await markSignerSigned(signer.id);

      await createSignLog({
        taskId: task.id,
        signerId: signer.id,
        action: 'sign',
        detail: JSON.stringify({ signedAt: data.signedAt }),
      });
    }
  }

  // 如果所有签署者都完成签署
  if (data.status === 'completed' && data.documentUrl) {
    await updateSignTask(task.id, {
      status: 'completed',
      signedDocumentUrl: data.documentUrl,
      completedAt: new Date(),
    });

    await createSignLog({
      taskId: task.id,
      action: 'complete',
      detail: JSON.stringify({ documentUrl: data.documentUrl }),
    });
  }
}

/**
 * 调用第三方签署服务
 */
async function callThirdPartySignService(
  config: SealConfig,
  task: SignTask,
  signers: Signer[]
): Promise<string> {
  // 根据不同服务商调用不同的API
  switch (config.provider) {
    case 'fadada':
      return callFadadaService(config, task, signers);
    case 'esign':
      return callEsignService(config, task, signers);
    case 'qiyuesuo':
      return callQiyuesuoService(config, task, signers);
    default:
      throw new Error(`不支持的签章服务商: ${config.provider}`);
  }
}

/**
 * 调用法大大签署服务
 */
async function callFadadaService(
  config: SealConfig,
  task: SignTask,
  signers: Signer[]
): Promise<string> {
  // TODO: 实现法大大API调用
  // 1. 创建签署流程
  // 2. 添加签署者
  // 3. 上传文档
  // 4. 发起签署
  
  // 模拟返回流程ID
  return `fadada_${Date.now()}_${task.id}`;
}

/**
 * 调用e签宝签署服务
 */
async function callEsignService(
  config: SealConfig,
  task: SignTask,
  signers: Signer[]
): Promise<string> {
  // TODO: 实现e签宝API调用
  // 1. 创建签署流程
  // 2. 添加签署者
  // 3. 上传文档
  // 4. 发起签署
  
  // 模拟返回流程ID
  return `esign_${Date.now()}_${task.id}`;
}

/**
 * 调用契约锁签署服务
 */
async function callQiyuesuoService(
  config: SealConfig,
  task: SignTask,
  signers: Signer[]
): Promise<string> {
  // TODO: 实现契约锁API调用
  // 1. 创建签署流程
  // 2. 添加签署者
  // 3. 上传文档
  // 4. 发起签署
  
  // 模拟返回流程ID
  return `qiyuesuo_${Date.now()}_${task.id}`;
}

// ============================================
// 电子签章服务商信息
// ============================================

export const SEAL_PROVIDERS = {
  fadada: {
    name: '法大大',
    description: '国内领先的电子合同平台，对接简单，服务稳定',
    features: ['实名认证', '电子签名', '合同管理', '存证出证'],
    pricing: '按签署次数计费，适合中小企业',
    website: 'https://www.fadada.com',
    apiDocs: 'https://www.fadada.com/openplatform',
  },
  esign: {
    name: 'e签宝',
    description: '政府采购常用平台，安全合规，支持多种签署方式',
    features: ['实名认证', '电子签名', '合同管理', '存证出证', '企业认证'],
    pricing: '按年付费或按次计费，适合大型企业',
    website: 'https://www.esign.cn',
    apiDocs: 'https://open.esign.cn',
  },
  qiyuesuo: {
    name: '契约锁',
    description: '企业级电子签约平台，安全性高，支持私有化部署',
    features: ['实名认证', '电子签名', '印章管理', '合同管理', '存证出证'],
    pricing: '支持私有化部署，适合对安全要求高的企业',
    website: 'https://www.qiyuesuo.com',
    apiDocs: 'https://open.qiyuesuo.com',
  },
  shujubao: {
    name: '数字宝',
    description: '性价比高的电子签章平台，功能完善',
    features: ['实名认证', '电子签名', '合同管理'],
    pricing: '价格优惠，适合预算有限的企业',
    website: 'https://www.shujubao.com',
    apiDocs: 'https://open.shujubao.com',
  },
};

// ============================================
// 统计分析
// ============================================

export async function getSignStatistics(companyId?: number): Promise<{
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalSeals: number;
  activeSeals: number;
}> {
  const conditions = companyId ? [eq(signTasks.configId, sealConfigs.id), eq(sealConfigs.companyId, companyId)] : [];

  const tasks = await db
    .select()
    .from(signTasks);

  const sealConditions = companyId ? [eq(seals.companyId, companyId)] : [];
  const allSeals = await db
    .select()
    .from(seals)
    .where(sealConditions.length > 0 ? and(...sealConditions) : undefined);

  return {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    pendingTasks: tasks.filter(t => t.status === 'signing' || t.status === 'pending').length,
    totalSeals: allSeals.length,
    activeSeals: allSeals.filter(s => s.status === 'active').length,
  };
}

/**
 * 工作流引擎服务
 * 提供工作流定义、实例管理、任务处理等功能
 */

import { db } from '@/db';
import {
  workflowDefinitions,
  workflowNodes,
  workflowTransitions,
  workflowInstances,
  workflowTasks,
  workflowTaskActions,
  users,
} from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowTransition,
  WorkflowInstance,
  WorkflowTask,
  WorkflowTaskAction,
  WorkflowStatus,
  WorkflowInstanceStatus,
  WorkflowNodeType,
  WorkflowTaskStatus,
  WorkflowAssigneeType,
} from '@/db/schema';

export interface CreateWorkflowParams {
  name: string;
  code: string;
  description?: string;
  category?: string;
  businessType?: string;
  config?: Record<string, unknown>;
  createdBy: number;
}

export interface CreateNodeParams {
  definitionId: number;
  nodeKey: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
  assigneeType?: string;
  assigneeValue?: string;
  multiApproveType?: string;
  approvePercent?: number;
  timeoutHours?: number;
  timeoutAction?: string;
  notifyConfig?: Record<string, unknown>;
  sortOrder?: number;
  positionX?: number;
  positionY?: number;
}

export interface CreateTransitionParams {
  definitionId: number;
  sourceNodeId: number;
  targetNodeId: number;
  condition?: Record<string, unknown>;
  conditionType?: string;
  sortOrder?: number;
}

export interface StartWorkflowParams {
  definitionId: number;
  businessType: string;
  businessId: number;
  businessTitle?: string;
  variables?: Record<string, unknown>;
  createdBy: number;
}

export interface CompleteTaskParams {
  taskId: number;
  action: 'approve' | 'reject' | 'transfer';
  comment?: string;
  transferTo?: number; // 转办目标用户ID
  operatorId: number;
}

export interface TaskListParams {
  assigneeId?: number;
  status?: string;
  businessType?: string;
  priority?: number;
  page?: number;
  pageSize?: number;
}

// ============================================
// 工作流定义服务
// ============================================

/**
 * 创建工作流定义
 */
export async function createWorkflowDefinition(
  params: CreateWorkflowParams
): Promise<{ id: number }> {
  const [definition] = await db
    .insert(workflowDefinitions)
    .values({
      name: params.name,
      code: params.code,
      description: params.description,
      category: params.category,
      businessType: params.businessType,
      config: params.config ? JSON.stringify(params.config) : null,
      status: 'draft',
      createdBy: params.createdBy,
    })
    .returning();

  return { id: definition.id };
}

/**
 * 获取工作流定义详情
 */
export async function getWorkflowDefinition(definitionId: number) {
  const [definition] = await db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.id, definitionId))
    .limit(1);

  if (!definition) return null;

  // 获取节点
  const nodes = await db
    .select()
    .from(workflowNodes)
    .where(eq(workflowNodes.definitionId, definitionId))
    .orderBy(workflowNodes.sortOrder);

  // 获取转换
  const transitions = await db
    .select()
    .from(workflowTransitions)
    .where(eq(workflowTransitions.definitionId, definitionId))
    .orderBy(workflowTransitions.sortOrder);

  return {
    ...definition,
    config: definition.config ? JSON.parse(definition.config) : null,
    nodes: nodes.map((n) => ({
      ...n,
      config: n.config ? JSON.parse(n.config) : null,
      notifyConfig: n.notifyConfig ? JSON.parse(n.notifyConfig) : null,
    })),
    transitions: transitions.map((t) => ({
      ...t,
      condition: t.condition ? JSON.parse(t.condition) : null,
    })),
  };
}

/**
 * 获取工作流定义列表
 */
export async function getWorkflowDefinitionList(params: {
  category?: string;
  businessType?: string;
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  const { page = 1, pageSize = 20 } = params;

  const conditions = [];

  if (params.category) {
    conditions.push(eq(workflowDefinitions.category, params.category));
  }
  if (params.businessType) {
    conditions.push(eq(workflowDefinitions.businessType, params.businessType));
  }
  if (params.status) {
    conditions.push(eq(workflowDefinitions.status, params.status as any));
  }

  // 查询总数
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workflowDefinitions)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const total = Number(count);

  // 查询列表
  const query = db
    .select({
      id: workflowDefinitions.id,
      name: workflowDefinitions.name,
      code: workflowDefinitions.code,
      description: workflowDefinitions.description,
      category: workflowDefinitions.category,
      businessType: workflowDefinitions.businessType,
      status: workflowDefinitions.status,
      version: workflowDefinitions.version,
      instanceCount: workflowDefinitions.instanceCount,
      createdAt: workflowDefinitions.createdAt,
      updatedAt: workflowDefinitions.updatedAt,
      creatorName: users.realName,
    })
    .from(workflowDefinitions)
    .leftJoin(users, eq(workflowDefinitions.createdBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(workflowDefinitions.createdAt))
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  const items = await query;

  // 关键词过滤
  let filteredItems = items;
  if (params.keyword) {
    filteredItems = items.filter(
      (item) =>
        item.name.toLowerCase().includes(params.keyword!.toLowerCase()) ||
        item.code.toLowerCase().includes(params.keyword!.toLowerCase())
    );
  }

  return {
    data: filteredItems,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 更新工作流定义
 */
export async function updateWorkflowDefinition(
  definitionId: number,
  data: Partial<{
    name: string;
    description: string;
    category: string;
    businessType: string;
    config: Record<string, unknown>;
    status: string;
  }>
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category) updateData.category = data.category;
  if (data.businessType) updateData.businessType = data.businessType;
  if (data.config) updateData.config = JSON.stringify(data.config);
  if (data.status) updateData.status = data.status;

  await db
    .update(workflowDefinitions)
    .set(updateData)
    .where(eq(workflowDefinitions.id, definitionId));

  return true;
}

/**
 * 删除工作流定义
 */
export async function deleteWorkflowDefinition(definitionId: number): Promise<boolean> {
  // 检查是否有运行中的实例
  const [runningInstance] = await db
    .select()
    .from(workflowInstances)
    .where(
      and(
        eq(workflowInstances.definitionId, definitionId),
        eq(workflowInstances.status, 'running')
      )
    )
    .limit(1);

  if (runningInstance) {
    throw new Error('存在运行中的流程实例，无法删除');
  }

  // 删除节点和转换（级联删除）
  await db.delete(workflowNodes).where(eq(workflowNodes.definitionId, definitionId));
  await db.delete(workflowTransitions).where(eq(workflowTransitions.definitionId, definitionId));
  
  // 删除定义
  await db.delete(workflowDefinitions).where(eq(workflowDefinitions.id, definitionId));

  return true;
}

// ============================================
// 工作流节点服务
// ============================================

/**
 * 创建工作流节点
 */
export async function createWorkflowNode(params: CreateNodeParams): Promise<{ id: number }> {
  const [node] = await db
    .insert(workflowNodes)
    .values({
      definitionId: params.definitionId,
      nodeKey: params.nodeKey,
      name: params.name,
      type: params.type as any,
      config: params.config ? JSON.stringify(params.config) : null,
      assigneeType: params.assigneeType as any,
      assigneeValue: params.assigneeValue,
      multiApproveType: params.multiApproveType,
      approvePercent: params.approvePercent,
      timeoutHours: params.timeoutHours,
      timeoutAction: params.timeoutAction,
      notifyConfig: params.notifyConfig ? JSON.stringify(params.notifyConfig) : null,
      sortOrder: params.sortOrder || 0,
      positionX: params.positionX,
      positionY: params.positionY,
    })
    .returning();

  return { id: node.id };
}

/**
 * 批量保存节点和转换（用于流程设计器）
 */
export async function saveWorkflowDesign(
  definitionId: number,
  nodes: CreateNodeParams[],
  transitions: CreateTransitionParams[]
): Promise<boolean> {
  // 使用事务
  await db.transaction(async (tx) => {
    // 删除现有节点和转换
    await tx.delete(workflowTransitions).where(eq(workflowTransitions.definitionId, definitionId));
    await tx.delete(workflowNodes).where(eq(workflowNodes.definitionId, definitionId));

    // 插入新节点
    for (const node of nodes) {
      await tx.insert(workflowNodes).values({
        definitionId,
        nodeKey: node.nodeKey,
        name: node.name,
        type: node.type as any,
        config: node.config ? JSON.stringify(node.config) : null,
        assigneeType: node.assigneeType as any,
        assigneeValue: node.assigneeValue,
        multiApproveType: node.multiApproveType,
        approvePercent: node.approvePercent,
        timeoutHours: node.timeoutHours,
        timeoutAction: node.timeoutAction,
        notifyConfig: node.notifyConfig ? JSON.stringify(node.notifyConfig) : null,
        sortOrder: node.sortOrder || 0,
        positionX: node.positionX,
        positionY: node.positionY,
      });
    }

    // 获取节点ID映射
    const dbNodes = await tx
      .select({ id: workflowNodes.id, nodeKey: workflowNodes.nodeKey })
      .from(workflowNodes)
      .where(eq(workflowNodes.definitionId, definitionId));

    const nodeKeyMap = new Map(dbNodes.map((n) => [n.nodeKey, n.id]));

    // 插入新转换
    for (const transition of transitions) {
      const sourceNodeId = nodeKeyMap.get(transition.sourceNodeId as any) || transition.sourceNodeId;
      const targetNodeId = nodeKeyMap.get(transition.targetNodeId as any) || transition.targetNodeId;

      await tx.insert(workflowTransitions).values({
        definitionId,
        sourceNodeId,
        targetNodeId,
        condition: transition.condition ? JSON.stringify(transition.condition) : null,
        conditionType: transition.conditionType,
        sortOrder: transition.sortOrder || 0,
      });
    }

    // 更新定义的版本号
    await tx
      .update(workflowDefinitions)
      .set({
        version: sql`${workflowDefinitions.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(workflowDefinitions.id, definitionId));
  });

  return true;
}

// ============================================
// 工作流实例服务
// ============================================

/**
 * 启动工作流实例
 */
export async function startWorkflowInstance(
  params: StartWorkflowParams
): Promise<{ instanceId: number; taskId?: number }> {
  // 获取工作流定义
  const definition = await getWorkflowDefinition(params.definitionId);
  if (!definition) {
    throw new Error('工作流定义不存在');
  }

  if (definition.status !== 'active') {
    throw new Error('工作流未启用');
  }

  // 查找开始节点
  const startNode = definition.nodes.find((n) => n.type === 'start');
  if (!startNode) {
    throw new Error('工作流缺少开始节点');
  }

  // 查找开始节点后的第一个审批节点
  const firstTransition = definition.transitions.find(
    (t) => t.sourceNodeId === startNode.id
  );
  if (!firstTransition) {
    throw new Error('工作流配置错误');
  }

  const firstApprovalNode = definition.nodes.find(
    (n) => n.id === firstTransition.targetNodeId
  );

  const now = new Date();

  // 创建实例
  const [instance] = await db
    .insert(workflowInstances)
    .values({
      definitionId: params.definitionId,
      definitionVersion: definition.version,
      businessType: params.businessType,
      businessId: params.businessId,
      businessTitle: params.businessTitle,
      status: 'running',
      currentNodeId: firstApprovalNode?.id || null,
      variables: params.variables ? JSON.stringify(params.variables) : null,
      startedAt: now,
      createdBy: params.createdBy,
    })
    .returning();

  // 更新定义的实例数量
  await db
    .update(workflowDefinitions)
    .set({
      instanceCount: sql`${workflowDefinitions.instanceCount} + 1`,
      updatedAt: now,
    })
    .where(eq(workflowDefinitions.id, params.definitionId));

  // 创建第一个任务
  let taskId: number | undefined;
  if (firstApprovalNode && firstApprovalNode.type === 'approval') {
    const assigneeId = await resolveAssignee(firstApprovalNode, params.createdBy, params.variables || {});
    
    const [task] = await db
      .insert(workflowTasks)
      .values({
        instanceId: instance.id,
        nodeId: firstApprovalNode.id,
        nodeKey: firstApprovalNode.nodeKey,
        nodeName: firstApprovalNode.name,
        title: `${params.businessTitle || '工作流任务'} - ${firstApprovalNode.name}`,
        assigneeType: firstApprovalNode.assigneeType || 'user',
        assigneeId,
        status: 'pending',
        dueTime: firstApprovalNode.timeoutHours
          ? new Date(now.getTime() + firstApprovalNode.timeoutHours * 60 * 60 * 1000)
          : null,
        startedAt: now,
      })
      .returning();

    taskId = task.id;

    // 发送通知
    // TODO: 调用消息中心发送通知
  }

  return { instanceId: instance.id, taskId };
}

/**
 * 完成任务
 */
export async function completeTask(params: CompleteTaskParams): Promise<{ success: boolean; nextTaskId?: number }> {
  const { taskId, action, comment, transferTo, operatorId } = params;

  // 获取任务信息
  const [task] = await db
    .select()
    .from(workflowTasks)
    .where(eq(workflowTasks.id, taskId))
    .limit(1);

  if (!task) {
    throw new Error('任务不存在');
  }

  if (task.status !== 'pending') {
    throw new Error('任务已处理');
  }

  // 验证操作人
  if (task.assigneeId !== operatorId) {
    throw new Error('无权处理此任务');
  }

  const now = new Date();

  // 转办处理
  if (action === 'transfer') {
    if (!transferTo) {
      throw new Error('请指定转办目标用户');
    }

    await db
      .update(workflowTasks)
      .set({
        status: 'transferred',
        transferredFrom: operatorId,
        transferredAt: now,
        transferReason: comment,
        updatedAt: now,
      })
      .where(eq(workflowTasks.id, taskId));

    // 创建新任务
    const [newTask] = await db
      .insert(workflowTasks)
      .values({
        instanceId: task.instanceId,
        nodeId: task.nodeId,
        nodeKey: task.nodeKey,
        nodeName: task.nodeName,
        title: task.title,
        assigneeType: 'user',
        assigneeId: transferTo,
        status: 'pending',
        dueTime: task.dueTime,
        startedAt: now,
      })
      .returning();

    // 记录操作
    await db.insert(workflowTaskActions).values({
      taskId,
      instanceId: task.instanceId,
      action: 'transfer',
      comment,
      operatorId,
      beforeStatus: 'pending',
      afterStatus: 'transferred',
    });

    return { success: true, nextTaskId: newTask.id };
  }

  // 审批处理
  const newStatus = action === 'approve' ? 'completed' : 'rejected';
  const result = action === 'approve' ? 'approved' : 'rejected';

  // 更新任务状态
  await db
    .update(workflowTasks)
    .set({
      status: newStatus,
      result,
      comment,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(workflowTasks.id, taskId));

  // 记录操作
  await db.insert(workflowTaskActions).values({
    taskId,
    instanceId: task.instanceId,
    action,
    comment,
    operatorId,
    beforeStatus: 'pending',
    afterStatus: newStatus,
  });

  // 如果拒绝，结束流程
  if (action === 'reject') {
    await db
      .update(workflowInstances)
      .set({
        status: 'rejected',
        result: 'rejected',
        resultComment: comment,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowInstances.id, task.instanceId));

    return { success: true };
  }

  // 流转到下一个节点
  return await flowToNextNode(task.instanceId, task.nodeId, operatorId, comment);
}

/**
 * 流转到下一个节点
 */
async function flowToNextNode(
  instanceId: number,
  currentNodeId: number,
  operatorId: number,
  comment?: string
): Promise<{ success: boolean; nextTaskId?: number }> {
  // 获取实例
  const [instance] = await db
    .select()
    .from(workflowInstances)
    .where(eq(workflowInstances.id, instanceId))
    .limit(1);

  if (!instance) {
    throw new Error('实例不存在');
  }

  // 获取工作流定义
  const definition = await getWorkflowDefinition(instance.definitionId);
  if (!definition) {
    throw new Error('工作流定义不存在');
  }

  // 查找下一个转换
  const transitions = definition.transitions.filter(
    (t) => t.sourceNodeId === currentNodeId
  );

  if (transitions.length === 0) {
    // 没有后续节点，流程结束
    await db
      .update(workflowInstances)
      .set({
        status: 'completed',
        result: 'approved',
        resultComment: comment,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflowInstances.id, instanceId));

    return { success: true };
  }

  // 处理第一个转换（简化处理，条件分支待完善）
  const nextTransition = transitions[0];
  const nextNode = definition.nodes.find((n) => n.id === nextTransition.targetNodeId);

  if (!nextNode) {
    throw new Error('下一节点不存在');
  }

  const now = new Date();

  // 如果是结束节点
  if (nextNode.type === 'end') {
    await db
      .update(workflowInstances)
      .set({
        status: 'completed',
        result: 'approved',
        resultComment: comment,
        currentNodeId: nextNode.id,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowInstances.id, instanceId));

    return { success: true };
  }

  // 更新当前节点
  await db
    .update(workflowInstances)
    .set({
      currentNodeId: nextNode.id,
      updatedAt: now,
    })
    .where(eq(workflowInstances.id, instanceId));

  // 创建下一个任务
  const variables = instance.variables ? JSON.parse(instance.variables) : {};
  const assigneeId = await resolveAssignee(nextNode, operatorId, variables);

  const [newTask] = await db
    .insert(workflowTasks)
    .values({
      instanceId,
      nodeId: nextNode.id,
      nodeKey: nextNode.nodeKey,
      nodeName: nextNode.name,
      title: `${instance.businessTitle || '工作流任务'} - ${nextNode.name}`,
      assigneeType: nextNode.assigneeType || 'user',
      assigneeId,
      status: 'pending',
      dueTime: nextNode.timeoutHours
        ? new Date(now.getTime() + nextNode.timeoutHours * 60 * 60 * 1000)
        : null,
      startedAt: now,
    })
    .returning();

  return { success: true, nextTaskId: newTask.id };
}

/**
 * 解析审批人
 */
async function resolveAssignee(
  node: any,
  creatorId: number,
  _variables: Record<string, unknown>
): Promise<number> {
  switch (node.assigneeType) {
    case 'user':
      return parseInt(node.assigneeValue);
    case 'creator':
      return creatorId;
    case 'role':
      // 根据角色查找用户
      const [roleUser] = await db
        .select({ userId: users.id })
        .from(users)
        .innerJoin(
          sql`user_roles ur`,
          sql`ur.user_id = ${users.id}`
        )
        .where(sql`ur.role_id = ${parseInt(node.assigneeValue)}`)
        .limit(1);
      return roleUser?.userId || creatorId;
    case 'department':
      // 查找部门主管
      // TODO: 实现部门主管逻辑
      return creatorId;
    case 'expression':
      // 表达式解析
      // TODO: 实现表达式解析
      return creatorId;
    default:
      return creatorId;
  }
}

// ============================================
// 任务查询服务
// ============================================

/**
 * 获取用户的待办任务列表
 */
export async function getTodoTaskList(params: TaskListParams) {
  const { page = 1, pageSize = 20 } = params;

  const conditions = [eq(workflowTasks.status, 'pending')];

  if (params.assigneeId) {
    conditions.push(eq(workflowTasks.assigneeId, params.assigneeId));
  }

  // 查询总数
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workflowTasks)
    .where(and(...conditions));

  const total = Number(count);

  // 查询列表
  const items = await db
    .select({
      id: workflowTasks.id,
      instanceId: workflowTasks.instanceId,
      title: workflowTasks.title,
      nodeName: workflowTasks.nodeName,
      priority: workflowTasks.priority,
      status: workflowTasks.status,
      dueTime: workflowTasks.dueTime,
      createdAt: workflowTasks.createdAt,
      // 关联实例信息
      businessType: workflowInstances.businessType,
      businessId: workflowInstances.businessId,
      businessTitle: workflowInstances.businessTitle,
      instanceStatus: workflowInstances.status,
      // 关联创建人信息
      creatorName: users.realName,
    })
    .from(workflowTasks)
    .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
    .leftJoin(users, eq(workflowInstances.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(workflowTasks.priority), desc(workflowTasks.createdAt))
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  return {
    data: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取用户的已办任务列表
 */
export async function getDoneTaskList(params: TaskListParams) {
  const { page = 1, pageSize = 20 } = params;

  const conditions = [
    or(
      eq(workflowTasks.status, 'completed'),
      eq(workflowTasks.status, 'rejected'),
      eq(workflowTasks.status, 'transferred')
    ),
  ];

  if (params.assigneeId) {
    conditions.push(eq(workflowTasks.assigneeId, params.assigneeId));
  }

  // 查询总数
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workflowTasks)
    .where(and(...conditions));

  const total = Number(count);

  // 查询列表
  const items = await db
    .select({
      id: workflowTasks.id,
      instanceId: workflowTasks.instanceId,
      title: workflowTasks.title,
      nodeName: workflowTasks.nodeName,
      status: workflowTasks.status,
      result: workflowTasks.result,
      comment: workflowTasks.comment,
      completedAt: workflowTasks.completedAt,
      // 关联实例信息
      businessType: workflowInstances.businessType,
      businessId: workflowInstances.businessId,
      businessTitle: workflowInstances.businessTitle,
      instanceStatus: workflowInstances.status,
    })
    .from(workflowTasks)
    .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
    .where(and(...conditions))
    .orderBy(desc(workflowTasks.completedAt))
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  return {
    data: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取任务详情
 */
export async function getTaskDetail(taskId: number) {
  const [task] = await db
    .select({
      id: workflowTasks.id,
      instanceId: workflowTasks.instanceId,
      nodeId: workflowTasks.nodeId,
      nodeKey: workflowTasks.nodeKey,
      nodeName: workflowTasks.nodeName,
      title: workflowTasks.title,
      description: workflowTasks.description,
      assigneeType: workflowTasks.assigneeType,
      assigneeId: workflowTasks.assigneeId,
      status: workflowTasks.status,
      priority: workflowTasks.priority,
      dueTime: workflowTasks.dueTime,
      startedAt: workflowTasks.startedAt,
      completedAt: workflowTasks.completedAt,
      result: workflowTasks.result,
      comment: workflowTasks.comment,
      createdAt: workflowTasks.createdAt,
      // 关联实例信息
      definitionId: workflowInstances.definitionId,
      businessType: workflowInstances.businessType,
      businessId: workflowInstances.businessId,
      businessTitle: workflowInstances.businessTitle,
      variables: workflowInstances.variables,
      instanceStatus: workflowInstances.status,
      instanceResult: workflowInstances.result,
    })
    .from(workflowTasks)
    .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
    .where(eq(workflowTasks.id, taskId))
    .limit(1);

  if (!task) return null;

  // 获取操作记录
  const actions = await db
    .select({
      id: workflowTaskActions.id,
      action: workflowTaskActions.action,
      comment: workflowTaskActions.comment,
      operatorId: workflowTaskActions.operatorId,
      operatorName: users.realName,
      createdAt: workflowTaskActions.createdAt,
    })
    .from(workflowTaskActions)
    .leftJoin(users, eq(workflowTaskActions.operatorId, users.id))
    .where(eq(workflowTaskActions.instanceId, task.instanceId))
    .orderBy(workflowTaskActions.createdAt);

  return {
    ...task,
    variables: task.variables ? JSON.parse(task.variables) : null,
    actions,
  };
}

/**
 * 获取流程实例详情
 */
export async function getInstanceDetail(instanceId: number) {
  const [instance] = await db
    .select()
    .from(workflowInstances)
    .where(eq(workflowInstances.id, instanceId))
    .limit(1);

  if (!instance) return null;

  // 获取所有任务
  const tasks = await db
    .select({
      id: workflowTasks.id,
      nodeId: workflowTasks.nodeId,
      nodeKey: workflowTasks.nodeKey,
      nodeName: workflowTasks.nodeName,
      title: workflowTasks.title,
      assigneeId: workflowTasks.assigneeId,
      assigneeName: users.realName,
      status: workflowTasks.status,
      result: workflowTasks.result,
      comment: workflowTasks.comment,
      startedAt: workflowTasks.startedAt,
      completedAt: workflowTasks.completedAt,
    })
    .from(workflowTasks)
    .leftJoin(users, eq(workflowTasks.assigneeId, users.id))
    .where(eq(workflowTasks.instanceId, instanceId))
    .orderBy(workflowTasks.createdAt);

  // 获取所有操作记录
  const actions = await db
    .select({
      id: workflowTaskActions.id,
      taskId: workflowTaskActions.taskId,
      action: workflowTaskActions.action,
      comment: workflowTaskActions.comment,
      operatorId: workflowTaskActions.operatorId,
      operatorName: users.realName,
      beforeStatus: workflowTaskActions.beforeStatus,
      afterStatus: workflowTaskActions.afterStatus,
      createdAt: workflowTaskActions.createdAt,
    })
    .from(workflowTaskActions)
    .leftJoin(users, eq(workflowTaskActions.operatorId, users.id))
    .where(eq(workflowTaskActions.instanceId, instanceId))
    .orderBy(workflowTaskActions.createdAt);

  return {
    ...instance,
    variables: instance.variables ? JSON.parse(instance.variables) : null,
    tasks,
    actions,
  };
}

/**
 * 取消工作流实例
 */
export async function cancelWorkflowInstance(
  instanceId: number,
  operatorId: number,
  reason?: string
): Promise<boolean> {
  const [instance] = await db
    .select()
    .from(workflowInstances)
    .where(eq(workflowInstances.id, instanceId))
    .limit(1);

  if (!instance) {
    throw new Error('实例不存在');
  }

  if (instance.status !== 'running') {
    throw new Error('只有运行中的流程可以取消');
  }

  // 验证权限：只有创建人可以取消
  if (instance.createdBy !== operatorId) {
    throw new Error('只有流程发起人可以取消');
  }

  const now = new Date();

  // 更新实例状态
  await db
    .update(workflowInstances)
    .set({
      status: 'cancelled',
      result: 'cancelled',
      resultComment: reason,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(workflowInstances.id, instanceId));

  // 取消所有待处理任务
  await db
    .update(workflowTasks)
    .set({
      status: 'cancelled',
      updatedAt: now,
    })
    .where(
      and(
        eq(workflowTasks.instanceId, instanceId),
        eq(workflowTasks.status, 'pending')
      )
    );

  return true;
}

/**
 * 获取用户任务统计
 */
export async function getUserTaskStats(userId: number) {
  // 待办数量
  const [{ todoCount }] = await db
    .select({ todoCount: sql<number>`count(*)` })
    .from(workflowTasks)
    .where(
      and(
        eq(workflowTasks.assigneeId, userId),
        eq(workflowTasks.status, 'pending')
      )
    );

  // 已办数量
  const [{ doneCount }] = await db
    .select({ doneCount: sql<number>`count(*)` })
    .from(workflowTasks)
    .where(
      and(
        eq(workflowTasks.assigneeId, userId),
        or(
          eq(workflowTasks.status, 'completed'),
          eq(workflowTasks.status, 'rejected'),
          eq(workflowTasks.status, 'transferred')
        )
      )
    );

  // 超时任务数量
  const [{ overdueCount }] = await db
    .select({ overdueCount: sql<number>`count(*)` })
    .from(workflowTasks)
    .where(
      and(
        eq(workflowTasks.assigneeId, userId),
        eq(workflowTasks.status, 'pending'),
        sql`${workflowTasks.dueTime} < now()`
      )
    );

  // 我发起的流程数量
  const [{ myInstanceCount }] = await db
    .select({ myInstanceCount: sql<number>`count(*)` })
    .from(workflowInstances)
    .where(eq(workflowInstances.createdBy, userId));

  return {
    todoCount: Number(todoCount),
    doneCount: Number(doneCount),
    overdueCount: Number(overdueCount),
    myInstanceCount: Number(myInstanceCount),
  };
}

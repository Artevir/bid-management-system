/**
 * 工作流引擎
 * 支持可配置工作流、条件分支、并行任务、审批流转
 */

import { db } from '@/db/index';
import { cache } from '@/lib/cache';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// 工作流节点类型
// ============================================

export enum WorkflowNodeType {
  START = 'start',
  END = 'end',
  APPROVAL = 'approval',
  TASK = 'task',
  CONDITION = 'condition',
  PARALLEL = 'parallel',
  MERGE = 'merge',
  NOTIFICATION = 'notification',
}

// ============================================
// 工作流状态
// ============================================

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

// ============================================
// 工作流实例状态
// ============================================

export enum WorkflowInstanceStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// ============================================
// 工作流节点接口
// ============================================

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  config?: {
    // 审批节点配置
    approvers?: string[];
    approvalType?: 'any' | 'all' | 'sequence';
    timeout?: number; // 超时时间（秒）

    // 条件节点配置
    conditions?: Array<{
      field: string;
      operator: 'eq' | 'ne' | 'gt' | 'lt' | 'ge' | 'le' | 'in' | 'contains';
      value: any;
      nextNode: string;
    }>;
    defaultNext?: string;

    // 任务节点配置
    assignee?: string;
    taskType?: string;
    deadline?: Date;

    // 通知节点配置
    recipients?: string[];
    template?: string;
  };
  nextNodes?: string[]; // 下一节点ID列表
  position?: { x: number; y: number }; // 可视化位置
}

// ============================================
// 工作流定义接口
// ============================================

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: Map<string, WorkflowNode>;
  startNodeId: string;
  endNodeId?: string;
  variables?: Record<string, any>;
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============================================
// 工作流实例接口
// ============================================

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: WorkflowInstanceStatus;
  currentNodes: string[];
  variables: Record<string, any>;
  history: Array<{
    nodeId: string;
    nodeName: string;
    status: 'completed' | 'failed' | 'skipped';
    startedAt: Date;
    completedAt?: Date;
    result?: any;
    error?: string;
  }>;
  context: {
    userId: string;
    resourceId?: string;
    resourceType?: string;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================
// 工作流引擎类
// ============================================

export class WorkflowEngine {
  private static definitions: Map<string, WorkflowDefinition> = new Map();
  private static instances: Map<string, WorkflowInstance> = new Map();

  /**
   * 创建工作流定义
   */
  static async createDefinition(
    name: string,
    nodes: WorkflowNode[],
    userId: string
  ): Promise<string> {
    const workflowId = `workflow_${uuidv4()}`;

    // 查找开始和结束节点
    const startNode = nodes.find(n => n.type === WorkflowNodeType.START);
    const endNode = nodes.find(n => n.type === WorkflowNodeType.END);

    if (!startNode) {
      throw new Error('工作流必须包含开始节点');
    }

    const nodesMap = new Map<string, WorkflowNode>();
    nodes.forEach(node => {
      nodesMap.set(node.id, node);
    });

    const definition: WorkflowDefinition = {
      id: workflowId,
      name,
      version: 1,
      nodes: nodesMap,
      startNodeId: startNode.id,
      endNodeId: endNode?.id,
      status: WorkflowStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    };

    this.definitions.set(workflowId, definition);

    // 持久化到数据库
    // TODO: 保存到数据库

    console.log(`[Workflow] 创建工作流定义: ${workflowId}`);
    return workflowId;
  }

  /**
   * 启动工作流实例
   */
  static async startInstance(
    workflowId: string,
    context: {
      userId: string;
      resourceId?: string;
      resourceType?: string;
    },
    initialVariables?: Record<string, any>
  ): Promise<string> {
    const definition = this.definitions.get(workflowId);
    if (!definition) {
      throw new Error(`工作流定义不存在: ${workflowId}`);
    }

    if (definition.status !== WorkflowStatus.ACTIVE) {
      throw new Error(`工作流未激活: ${workflowId}`);
    }

    const instanceId = `instance_${uuidv4()}`;
    const instance: WorkflowInstance = {
      id: instanceId,
      workflowId,
      workflowVersion: definition.version,
      status: WorkflowInstanceStatus.RUNNING,
      currentNodes: [definition.startNodeId],
      variables: { ...definition.variables, ...initialVariables },
      history: [],
      context,
      createdAt: new Date(),
      startedAt: new Date(),
    };

    this.instances.set(instanceId, instance);

    // 缓存实例
    await cache.set(`workflow:instance:${instanceId}`, JSON.stringify(instance), 86400);

    // 执行工作流
    this.executeWorkflow(instanceId).catch(error => {
      console.error(`[Workflow] 工作流执行失败:`, error);
    });

    console.log(`[Workflow] 启动工作流实例: ${instanceId}`);
    return instanceId;
  }

  /**
   * 执行工作流
   */
  private static async executeWorkflow(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    const definition = this.definitions.get(instance.workflowId);
    if (!definition) return;

    try {
      // 执行当前节点
      for (const nodeId of instance.currentNodes) {
        const node = definition.nodes.get(nodeId);
        if (!node) continue;

        const result = await this.executeNode(instanceId, nodeId, instance);

        // 记录历史
        instance.history.push({
          nodeId,
          nodeName: node.name,
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          result,
        });

        // 更新变量
        if (result) {
          instance.variables = { ...instance.variables, ...result };
        }
      }

      // 计算下一节点
      const nextNodes = await this.calculateNextNodes(instanceId);

      if (nextNodes.length === 0) {
        // 工作流完成
        instance.status = WorkflowInstanceStatus.COMPLETED;
        instance.completedAt = new Date();
        instance.currentNodes = [];
        console.log(`[Workflow] 工作流实例完成: ${instanceId}`);
      } else {
        // 继续执行
        instance.currentNodes = nextNodes;
        this.executeWorkflow(instanceId).catch(error => {
          console.error(`[Workflow] 工作流执行失败:`, error);
        });
      }

      // 更新缓存
      await cache.set(`workflow:instance:${instanceId}`, JSON.stringify(instance), 86400);
    } catch (error) {
      instance.status = WorkflowInstanceStatus.FAILED;
      instance.completedAt = new Date();
      console.error(`[Workflow] 工作流实例失败: ${instanceId}`, error);
    }
  }

  /**
   * 执行节点
   */
  private static async executeNode(
    instanceId: string,
    nodeId: string,
    instance: WorkflowInstance
  ): Promise<any> {
    const instanceWorkflow = this.instances.get(instanceId);
    if (!instanceWorkflow) return null;

    const definition = this.definitions.get(instanceWorkflow.workflowId);
    if (!definition) return null;

    const node = definition.nodes.get(nodeId);
    if (!node) return null;

    console.log(`[Workflow] 执行节点: ${nodeId} (${node.name})`);

    switch (node.type) {
      case WorkflowNodeType.APPROVAL:
        return await this.executeApprovalNode(instanceId, node, instance);

      case WorkflowNodeType.TASK:
        return await this.executeTaskNode(instanceId, node, instance);

      case WorkflowNodeType.CONDITION:
        return await this.executeConditionNode(instanceId, node, instance);

      case WorkflowNodeType.NOTIFICATION:
        return await this.executeNotificationNode(instanceId, node, instance);

      case WorkflowNodeType.START:
      case WorkflowNodeType.END:
        return null;

      default:
        console.warn(`[Workflow] 未知节点类型: ${node.type}`);
        return null;
    }
  }

  /**
   * 执行审批节点
   */
  private static async executeApprovalNode(
    instanceId: string,
    node: WorkflowNode,
    instance: WorkflowInstance
  ): Promise<any> {
    // TODO: 实现审批逻辑
    // 1. 发送审批通知
    // 2. 等待审批结果
    // 3. 处理审批超时
    console.log(`[Workflow] 审批节点: ${node.name}, 审批人: ${node.config?.approvers}`);
    return { approved: true, approver: instance.context.userId };
  }

  /**
   * 执行任务节点
   */
  private static async executeTaskNode(
    instanceId: string,
    node: WorkflowNode,
    instance: WorkflowInstance
  ): Promise<any> {
    // TODO: 实现任务执行逻辑
    console.log(`[Workflow] 任务节点: ${node.name}, 执行人: ${node.config?.assignee}`);
    return { completed: true, executor: instance.context.userId };
  }

  /**
   * 执行条件节点
   */
  private static async executeConditionNode(
    instanceId: string,
    node: WorkflowNode,
    instance: WorkflowInstance
  ): Promise<any> {
    if (!node.config?.conditions || node.config.conditions.length === 0) {
      return {};
    }

    // TODO: 实现条件判断逻辑
    const conditions = node.config.conditions;
    const variables = instance.variables;

    for (const condition of conditions) {
      const value = variables[condition.field];
      let matched = false;

      switch (condition.operator) {
        case 'eq':
          matched = value === condition.value;
          break;
        case 'ne':
          matched = value !== condition.value;
          break;
        case 'gt':
          matched = value > condition.value;
          break;
        case 'lt':
          matched = value < condition.value;
          break;
        case 'in':
          matched = Array.isArray(condition.value) && condition.value.includes(value);
          break;
        case 'contains':
          matched = String(value).includes(String(condition.value));
          break;
      }

      if (matched) {
        return { matched: true, nextNode: condition.nextNode };
      }
    }

    // 默认路径
    return { matched: false, nextNode: node.config?.defaultNext };
  }

  /**
   * 执行通知节点
   */
  private static async executeNotificationNode(
    instanceId: string,
    node: WorkflowNode,
    instance: WorkflowInstance
  ): Promise<any> {
    // TODO: 实现通知发送逻辑
    console.log(`[Workflow] 通知节点: ${node.name}, 收件人: ${node.config?.recipients}`);
    return { notified: true, recipients: node.config?.recipients };
  }

  /**
   * 计算下一节点
   */
  private static async calculateNextNodes(instanceId: string): Promise<string[]> {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];

    const definition = this.definitions.get(instance.workflowId);
    if (!definition) return [];

    const nextNodes: string[] = [];

    // 从最后一个执行的结果中获取下一节点
    const lastResult = instance.history[instance.history.length - 1]?.result;
    if (lastResult?.nextNode) {
      nextNodes.push(lastResult.nextNode);
    } else {
      // 否则从当前节点的 nextNodes 获取
      for (const nodeId of instance.currentNodes) {
        const node = definition.nodes.get(nodeId);
        if (node?.nextNodes) {
          nextNodes.push(...node.nextNodes);
        }
      }
    }

    // 去重
    return Array.from(new Set(nextNodes));
  }

  /**
   * 获取工作流实例状态
   */
  static async getInstanceStatus(instanceId: string): Promise<WorkflowInstance | null> {
    // 先从缓存获取
    const cached = await cache.get(`workflow:instance:${instanceId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // 从内存获取
    return this.instances.get(instanceId) || null;
  }

  /**
   * 取消工作流实例
   */
  static async cancelInstance(instanceId: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;

    if (instance.status === WorkflowInstanceStatus.RUNNING) {
      instance.status = WorkflowInstanceStatus.CANCELLED;
      instance.completedAt = new Date();
      await cache.set(`workflow:instance:${instanceId}`, JSON.stringify(instance), 86400);
      return true;
    }

    return false;
  }
}

// ============================================
// 导出
// ============================================

export default WorkflowEngine;

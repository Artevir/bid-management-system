'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge as _Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover as _Popover,
  PopoverContent as _PopoverContent,
  PopoverTrigger as _PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea as _Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Save,
  Play,
  Plus as _Plus,
  MousePointer,
  Trash2 as _Trash2,
  Circle,
  Square,
  Diamond,
  Bell,
  Zap,
  GitBranch,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

// 节点类型定义
interface WorkflowNode {
  id: string;
  nodeKey: string;
  name: string;
  type: 'start' | 'end' | 'approval' | 'parallel' | 'condition' | 'notify' | 'auto';
  x: number;
  y: number;
  assigneeType?: string;
  assigneeValue?: string;
  timeoutHours?: number;
  config?: Record<string, unknown>;
}

// 连线类型定义
interface WorkflowTransition {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: Record<string, unknown>;
}

// 工作流定义
interface WorkflowDefinition {
  id: number;
  name: string;
  code: string;
  status: string;
  nodes: WorkflowNode[];
  transitions: WorkflowTransition[];
}

// 节点类型配置
const NODE_TYPES = [
  { type: 'start', name: '开始', icon: Circle, color: 'bg-green-500' },
  { type: 'end', name: '结束', icon: Circle, color: 'bg-red-500' },
  { type: 'approval', name: '审批', icon: Square, color: 'bg-blue-500' },
  { type: 'parallel', name: '并行', icon: Square, color: 'bg-purple-500' },
  { type: 'condition', name: '条件', icon: Diamond, color: 'bg-yellow-500' },
  { type: 'notify', name: '通知', icon: Bell, color: 'bg-cyan-500' },
  { type: 'auto', name: '自动', icon: Zap, color: 'bg-gray-500' },
];

export default function WorkflowDesignerPage() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id as string;

  const canvasRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);

  // 交互状态
  const [mode, setMode] = useState<'select' | 'add' | 'connect'>('select');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    nodeId: string;
    startX: number;
    startY: number;
  } | null>(null);
  const [addNodeType, setAddNodeType] = useState<string>('approval');

  // 对话框状态
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<WorkflowNode | null>(null);
  const [nodeForm, setNodeForm] = useState({
    name: '',
    assigneeType: 'user',
    assigneeValue: '',
    timeoutHours: 24,
  });

  // 加载工作流数据
  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`/api/workflows/${workflowId}`);
        if (!response.ok) throw new Error('获取工作流失败');

        const data = await response.json();
        setWorkflow(data);

        // 转换节点数据
        const loadedNodes: WorkflowNode[] = (data.nodes || []).map((n: any) => ({
          id: n.id.toString(),
          nodeKey: n.nodeKey,
          name: n.name,
          type: n.type,
          x: n.positionX || 100,
          y: n.positionY || 100,
          assigneeType: n.assigneeType,
          assigneeValue: n.assigneeValue,
          timeoutHours: n.timeoutHours,
          config: n.config,
        }));

        // 转换连线数据
        const loadedTransitions: WorkflowTransition[] = (data.transitions || []).map((t: any) => ({
          id: t.id.toString(),
          sourceNodeId: t.sourceNodeId.toString(),
          targetNodeId: t.targetNodeId.toString(),
          condition: t.condition,
        }));

        setNodes(loadedNodes);
        setTransitions(loadedTransitions);
      } catch (error) {
        console.error('加载工作流失败:', error);
        setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
        toast.error('加载工作流失败');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]);

  // 保存设计
  const handleSave = async () => {
    if (!workflow) return;

    try {
      setSaving(true);

      // 准备节点数据
      const nodesData = nodes.map((node) => ({
        nodeKey: node.nodeKey,
        name: node.name,
        type: node.type,
        positionX: node.x,
        positionY: node.y,
        assigneeType: node.assigneeType,
        assigneeValue: node.assigneeValue,
        timeoutHours: node.timeoutHours,
        config: node.config,
      }));

      // 准备连线数据
      const transitionsData = transitions.map((t) => ({
        sourceNodeId: t.sourceNodeId,
        targetNodeId: t.targetNodeId,
        condition: t.condition,
      }));

      const response = await fetch(`/api/workflows/${workflowId}/design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodesData,
          transitions: transitionsData,
        }),
      });

      if (!response.ok) throw new Error('保存失败');

      toast.success('保存成功');
    } catch (error) {
      console.error('保存失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 发布工作流
  const handlePublish = async () => {
    if (!workflow) return;

    // 检查是否有开始和结束节点
    const hasStart = nodes.some((n) => n.type === 'start');
    const hasEnd = nodes.some((n) => n.type === 'end');

    if (!hasStart || !hasEnd) {
      toast.error('工作流必须包含开始和结束节点');
      return;
    }

    try {
      // 先保存
      await handleSave();

      // 更新状态为启用
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      if (!response.ok) throw new Error('发布失败');

      toast.success('发布成功');
      router.push('/workflows');
    } catch (error) {
      console.error('发布失败:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
      toast.error('发布失败');
    }
  };

  // 添加节点
  const handleAddNode = useCallback(
    (x: number, y: number) => {
      const nodeType = NODE_TYPES.find((t) => t.type === addNodeType);
      if (!nodeType) return;

      const newNode: WorkflowNode = {
        id: `node_${Date.now()}`,
        nodeKey: `node_${nodes.length + 1}`,
        name: nodeType.name,
        type: nodeType.type as any,
        x,
        y,
      };

      setNodes([...nodes, newNode]);
      setSelectedNode(newNode.id);
      setMode('select');
    },
    [nodes, addNodeType]
  );

  // 删除节点
  const handleDeleteNode = (nodeId: string) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setTransitions(
      transitions.filter((t) => t.sourceNodeId !== nodeId && t.targetNodeId !== nodeId)
    );
    setSelectedNode(null);
  };

  // 添加连线
  const handleAddTransition = (sourceId: string, targetId: string) => {
    // 检查是否已存在
    const exists = transitions.some(
      (t) => t.sourceNodeId === sourceId && t.targetNodeId === targetId
    );
    if (exists) return;

    const newTransition: WorkflowTransition = {
      id: `trans_${Date.now()}`,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
    };

    setTransitions([...transitions, newTransition]);
    setConnectingFrom(null);
    setMode('select');
  };

  // 删除连线
  const handleDeleteTransition = (transitionId: string) => {
    setTransitions(transitions.filter((t) => t.id !== transitionId));
    setSelectedTransition(null);
  };

  // 编辑节点
  const handleEditNode = (node: WorkflowNode) => {
    setEditingNode(node);
    setNodeForm({
      name: node.name,
      assigneeType: node.assigneeType || 'user',
      assigneeValue: node.assigneeValue || '',
      timeoutHours: node.timeoutHours || 24,
    });
    setNodeDialogOpen(true);
  };

  // 保存节点编辑
  const handleSaveNode = () => {
    if (!editingNode) return;

    setNodes(
      nodes.map((n) =>
        n.id === editingNode.id
          ? {
              ...n,
              name: nodeForm.name,
              assigneeType: nodeForm.assigneeType,
              assigneeValue: nodeForm.assigneeValue,
              timeoutHours: nodeForm.timeoutHours,
            }
          : n
      )
    );

    setNodeDialogOpen(false);
    setEditingNode(null);
  };

  // Canvas点击处理
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (mode === 'add' && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      handleAddNode(x, y);
    }
  };

  // 节点点击处理
  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();

    if (mode === 'connect') {
      if (connectingFrom && connectingFrom !== nodeId) {
        handleAddTransition(connectingFrom, nodeId);
      } else {
        setConnectingFrom(nodeId);
      }
    } else {
      setSelectedNode(nodeId);
      setSelectedTransition(null);
    }
  };

  // 节点双击编辑
  const handleNodeDoubleClick = (e: React.MouseEvent, node: WorkflowNode) => {
    e.stopPropagation();
    handleEditNode(node);
  };

  // 节点拖拽
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (mode !== 'select') return;
    e.stopPropagation();

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setDragging({
      nodeId,
      startX: e.clientX - node.x,
      startY: e.clientY - node.y,
    });
    setSelectedNode(nodeId);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;

      setNodes(
        nodes.map((n) =>
          n.id === dragging.nodeId
            ? {
                ...n,
                x: Math.max(0, e.clientX - dragging.startX),
                y: Math.max(0, e.clientY - dragging.startY),
              }
            : n
        )
      );
    },
    [dragging, nodes]
  );

  const handleMouseUp = () => {
    setDragging(null);
  };

  // 绘制连线
  const renderTransitions = () => {
    return transitions.map((transition) => {
      const sourceNode = nodes.find((n) => n.id === transition.sourceNodeId);
      const targetNode = nodes.find((n) => n.id === transition.targetNodeId);
      if (!sourceNode || !targetNode) return null;

      const x1 = sourceNode.x + 60;
      const y1 = sourceNode.y + 30;
      const x2 = targetNode.x + 60;
      const y2 = targetNode.y + 30;

      return (
        <g
          key={transition.id}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTransition(transition.id);
            setSelectedNode(null);
          }}
          style={{ cursor: 'pointer' }}
        >
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={selectedTransition === transition.id ? '#3b82f6' : '#94a3b8'}
            strokeWidth={selectedTransition === transition.id ? 3 : 2}
            markerEnd="url(#arrowhead)"
          />
          {selectedTransition === transition.id && (
            <circle
              cx={(x1 + x2) / 2}
              cy={(y1 + y2) / 2}
              r={12}
              fill="white"
              stroke="#ef4444"
              strokeWidth={2}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTransition(transition.id);
              }}
            />
          )}
        </g>
      );
    });
  };

  // 绘制节点
  const renderNodes = () => {
    return nodes.map((node) => {
      const nodeType = NODE_TYPES.find((t) => t.type === node.type);
      const Icon = nodeType?.icon || Square;
      const color = nodeType?.color || 'bg-gray-500';
      const isSelected = selectedNode === node.id;

      return (
        <div
          key={node.id}
          className={`absolute cursor-move select-none ${
            isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
          }`}
          style={{
            left: node.x,
            top: node.y,
          }}
          onClick={(e) => handleNodeClick(e, node.id)}
          onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
        >
          <div className={`${color} text-white rounded-lg shadow-lg p-2 min-w-[120px] text-center`}>
            <div className="flex items-center justify-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{node.name}</span>
            </div>
          </div>
          {isSelected && (
            <button
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNode(node.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      );
    });
  };

  if (error) {
    return <ListStateBlock state="error" error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-4">
          <Link href="/workflows">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">{workflow?.name}</h1>
            <p className="text-xs text-gray-500">
              {workflow?.code} · {workflow?.status === 'active' ? '已启用' : '草稿'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '保存中...' : '保存'}
          </Button>
          {workflow?.status !== 'active' && (
            <Button onClick={handlePublish}>
              <Play className="h-4 w-4 mr-2" />
              发布
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧工具面板 */}
        <div className="w-64 border-r bg-gray-50 p-4">
          <h2 className="font-medium mb-4">工具</h2>

          {/* 模式选择 */}
          <div className="space-y-2 mb-6">
            <Button
              variant={mode === 'select' ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => setMode('select')}
            >
              <MousePointer className="h-4 w-4 mr-2" />
              选择
            </Button>
            <Button
              variant={mode === 'connect' ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => {
                setMode('connect');
                setConnectingFrom(null);
              }}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              连线
            </Button>
          </div>

          <h2 className="font-medium mb-4">节点</h2>

          {/* 节点类型选择 */}
          <div className="space-y-2">
            {NODE_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = addNodeType === type.type;

              return (
                <Button
                  key={type.type}
                  variant={isSelected && mode === 'add' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => {
                    setAddNodeType(type.type);
                    setMode('add');
                  }}
                >
                  <Icon className={`h-4 w-4 mr-2 ${type.color}`} />
                  {type.name}
                </Button>
              );
            })}
          </div>

          {/* 提示 */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            <p className="font-medium mb-1">操作提示</p>
            <ul className="list-disc list-inside space-y-1">
              <li>点击节点类型后，在画布上点击添加节点</li>
              <li>双击节点可编辑属性</li>
              <li>选择连线模式后，依次点击两个节点完成连线</li>
              <li>拖拽节点可调整位置</li>
            </ul>
          </div>
        </div>

        {/* 画布区域 */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-white"
          style={{
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* SVG层绘制连线 */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
            <g className="pointer-events-auto">{renderTransitions()}</g>
          </svg>

          {/* 节点层 */}
          {renderNodes()}

          {/* 连线起点提示 */}
          {mode === 'connect' && connectingFrom && (
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
              请点击目标节点完成连线
            </div>
          )}
        </div>
      </div>

      {/* 节点编辑对话框 */}
      <Dialog open={nodeDialogOpen} onOpenChange={setNodeDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>编辑节点</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nodeName">节点名称</Label>
              <Input
                id="nodeName"
                value={nodeForm.name}
                onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
              />
            </div>
            {editingNode?.type === 'approval' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="assigneeType">审批人类型</Label>
                  <Select
                    value={nodeForm.assigneeType}
                    onValueChange={(value) => setNodeForm({ ...nodeForm, assigneeType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">指定用户</SelectItem>
                      <SelectItem value="role">指定角色</SelectItem>
                      <SelectItem value="creator">创建人</SelectItem>
                      <SelectItem value="department">部门主管</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {nodeForm.assigneeType === 'user' && (
                  <div className="grid gap-2">
                    <Label htmlFor="assigneeValue">用户ID</Label>
                    <Input
                      id="assigneeValue"
                      value={nodeForm.assigneeValue}
                      onChange={(e) => setNodeForm({ ...nodeForm, assigneeValue: e.target.value })}
                      placeholder="输入用户ID"
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="timeoutHours">超时时间（小时）</Label>
                  <Input
                    id="timeoutHours"
                    type="number"
                    value={nodeForm.timeoutHours}
                    onChange={(e) =>
                      setNodeForm({
                        ...nodeForm,
                        timeoutHours: parseInt(e.target.value) || 24,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNodeDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveNode}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

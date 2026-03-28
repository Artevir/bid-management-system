/**
 * 图片生成相关常量
 * 可安全在客户端和服务端使用
 */

// ============================================
// 图片类型配置
// ============================================

export const IMAGE_TYPE_CONFIG: Record<string, {
  label: string;
  category: string;
  description: string;
  difficulty: number; // 1-5
  defaultPrompt?: string;
}> = {
  // 组织管理类
  org_chart: { label: '组织架构图', category: '组织管理', description: '公司/项目团队/投标小组架构', difficulty: 1 },
  dept_chart: { label: '部门分工图', category: '组织管理', description: '部门职责分工展示', difficulty: 1 },
  role_chart: { label: '人员职责分配图', category: '组织管理', description: '岗位职责分配', difficulty: 1 },
  
  // 逻辑梳理类
  mind_map: { label: '思维导图', category: '逻辑梳理', description: '技术方案框架、施工流程等', difficulty: 1 },
  flowchart: { label: '流程图', category: '逻辑梳理', description: '通用流程图', difficulty: 1 },
  
  // 流程图专项
  flowchart_it_ops: { label: 'IT运维流程图', category: '流程图', description: '故障响应、巡检流程等', difficulty: 2 },
  flowchart_bidding: { label: '投标流程图', category: '流程图', description: '投标报名、编制、评审流程', difficulty: 2 },
  flowchart_project: { label: '项目流程图', category: '流程图', description: '立项、进展、验收流程', difficulty: 2 },
  flowchart_construction: { label: '施工流程图', category: '流程图', description: '工序、验收、管控流程', difficulty: 2 },
  flowchart_approval: { label: '审批流程图', category: '流程图', description: '审批、协作流程', difficulty: 2 },
  
  // 项目进度类
  gantt_chart: { label: '甘特图', category: '项目进度', description: '项目进度规划、时间轴', difficulty: 2 },
  milestone_chart: { label: '里程碑图', category: '项目进度', description: '关键节点展示', difficulty: 2 },
  progress_chart: { label: '进度对比图', category: '项目进度', description: '计划与实际对比', difficulty: 2 },
  
  // 技术架构类
  topology: { label: '拓扑图', category: '技术架构', description: '网络/系统架构拓扑', difficulty: 3 },
  architecture: { label: '系统架构图', category: '技术架构', description: '软件/硬件系统架构', difficulty: 3 },
  device_layout: { label: '设备布局图', category: '技术架构', description: '设备连接布局', difficulty: 3 },
  
  // 施工专业类
  construction_flow: { label: '施工流程图', category: '施工专业', description: '施工工序流程', difficulty: 4 },
  construction_node: { label: '施工节点图', category: '施工专业', description: '施工关键节点', difficulty: 4 },
  site_layout: { label: '施工场地布置图', category: '施工专业', description: '场地规划布局', difficulty: 4 },
  
  // 工程设计类
  cad_drawing: { label: 'CAD图', category: '工程设计', description: '平面图、结构图等', difficulty: 5 },
  engineering_detail: { label: '工程节点详图', category: '工程设计', description: '剖面图、详图', difficulty: 5 },
  
  // 数据可视化类
  bar_chart: { label: '柱状图', category: '数据可视化', description: '数据对比展示', difficulty: 1 },
  line_chart: { label: '折线图', category: '数据可视化', description: '趋势变化展示', difficulty: 1 },
  pie_chart: { label: '饼图', category: '数据可视化', description: '占比分布展示', difficulty: 1 },
  heatmap: { label: '热力图', category: '数据可视化', description: '分布密度展示', difficulty: 1 },
  
  // 场景示意类
  rendering: { label: '效果图', category: '场景示意', description: '建筑外观、室内装修', difficulty: 3 },
  installation_guide: { label: '设备安装示意图', category: '场景示意', description: '安装说明图示', difficulty: 3 },
  site_plan: { label: '场地规划图', category: '场景示意', description: '场地布置规划', difficulty: 3 },
  
  // 其他
  icon_set: { label: '图标集合', category: '其他', description: '投标/施工相关图标', difficulty: 1 },
  diagram: { label: '示意图', category: '其他', description: '逻辑示意图', difficulty: 1 },
  other: { label: '其他', category: '其他', description: '其他类型图片', difficulty: 1 },
};

// 生成模式配置
export const GENERATE_MODE_CONFIG: Record<string, {
  label: string;
  description: string;
}> = {
  quick: { label: '快速模式', description: '直接生成，适合简单图片' },
  precise: { label: '精准模式', description: '详细配置，适合专业图片' },
  agent: { label: '角色模式', description: '使用AI角色生成，适合复杂场景' },
};

// 图片尺寸配置
export const IMAGE_SIZE_CONFIG: Record<string, {
  label: string;
  description: string;
  width?: number;
  height?: number;
}> = {
  '2K': { label: '2K', description: '2048x2048', width: 2048, height: 2048 },
  '4K': { label: '4K', description: '4096x4096', width: 4096, height: 4096 },
  'A4_LANDSCAPE': { label: 'A4横版', description: '2970x2100', width: 2970, height: 2100 },
  'A4_PORTRAIT': { label: 'A4竖版', description: '2100x2970', width: 2100, height: 2970 },
  'A3_LANDSCAPE': { label: 'A3横版', description: '4200x2970', width: 4200, height: 2970 },
  'A3_PORTRAIT': { label: 'A3竖版', description: '2970x4200', width: 2970, height: 4200 },
  'RATIO_16_9': { label: '16:9', description: '2560x1440', width: 2560, height: 1440 },
  'RATIO_9_16': { label: '9:16', description: '1440x2560', width: 1440, height: 2560 },
  'CUSTOM': { label: '自定义', description: '自定义尺寸' },
};

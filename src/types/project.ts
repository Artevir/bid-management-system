/**
 * 项目相关类型定义
 */

// 项目状态
export type ProjectStatus =
  | 'draft'       // 草稿
  | 'parsing'     // 文档解析中
  | 'preparing'   // 标书编制中
  | 'reviewing'   // 审核中
  | 'approved'    // 已通过
  | 'submitted'   // 已投标
  | 'awarded'     // 已中标
  | 'lost'        // 未中标
  | 'completed'   // 已完结（签订合同后）
  | 'archived';   // 已归档

// 项目阶段类型
export type ProjectPhaseType =
  | 'preparation' // 准备阶段
  | 'analysis'    // 分析阶段
  | 'drafting'    // 编制阶段
  | 'review'      // 审核阶段
  | 'submission'; // 投标阶段

// 项目阶段状态
export type ProjectPhaseStatus =
  | 'pending'     // 待开始
  | 'in_progress' // 进行中
  | 'completed';  // 已完成

// 项目节点状态
export type ProjectMilestoneStatus =
  | 'pending'     // 待完成
  | 'completed'   // 已完成
  | 'overdue';    // 已逾期

// 项目成员角色
export type ProjectMemberRole =
  | 'owner'    // 项目负责人
  | 'editor'   // 编辑者
  | 'viewer'   // 查看者
  | 'auditor'; // 审核者

// 项目状态标签映射
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: '草稿',
  parsing: '文档解析中',
  preparing: '标书编制中',
  reviewing: '审核中',
  approved: '已通过',
  submitted: '已投标',
  awarded: '已中标',
  lost: '未中标',
  completed: '已完结',
  archived: '已归档',
};

// 项目状态颜色映射
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: 'gray',
  parsing: 'blue',
  preparing: 'cyan',
  reviewing: 'yellow',
  approved: 'green',
  submitted: 'indigo',
  awarded: 'emerald',
  lost: 'red',
  completed: 'teal',
  archived: 'slate',
};

// 项目类型选项
export const PROJECT_TYPES = [
  { value: '工程招标', label: '工程招标' },
  { value: '货物招标', label: '货物招标' },
  { value: '服务招标', label: '服务招标' },
  { value: '政府采购', label: '政府采购' },
  { value: '其他', label: '其他' },
];

// 招标方式选项
export const TENDER_METHODS = [
  { value: '公开招标', label: '公开招标' },
  { value: '邀请招标', label: '邀请招标' },
  { value: '竞争性谈判', label: '竞争性谈判' },
  { value: '竞争性磋商', label: '竞争性磋商' },
  { value: '单一来源', label: '单一来源' },
  { value: '询价', label: '询价' },
  { value: '其他', label: '其他' },
];

// 行业选项
export const INDUSTRIES = [
  { value: '信息技术', label: '信息技术' },
  { value: '建筑地产', label: '建筑地产' },
  { value: '交通运输', label: '交通运输' },
  { value: '能源电力', label: '能源电力' },
  { value: '水利环保', label: '水利环保' },
  { value: '医疗卫生', label: '医疗卫生' },
  { value: '教育科研', label: '教育科研' },
  { value: '金融保险', label: '金融保险' },
  { value: '制造加工', label: '制造加工' },
  { value: '其他', label: '其他' },
];

// 区域选项
export const REGIONS = [
  { value: '北京', label: '北京' },
  { value: '上海', label: '上海' },
  { value: '广州', label: '广州' },
  { value: '深圳', label: '深圳' },
  { value: '杭州', label: '杭州' },
  { value: '南京', label: '南京' },
  { value: '成都', label: '成都' },
  { value: '武汉', label: '武汉' },
  { value: '西安', label: '西安' },
  { value: '其他', label: '其他' },
];

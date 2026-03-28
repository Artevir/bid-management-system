/**
 * 测试数据工厂
 * 生成各种测试实体数据
 */

import { faker } from '@faker-js/faker/locale/zh_CN';

// 项目类型
export const PROJECT_TYPES = [
  { value: 'goods', label: '货物类' },
  { value: 'service', label: '服务类' },
  { value: 'engineering', label: '工程类' },
] as const;

// 项目状态
export const PROJECT_STATUSES = [
  'preparing',
  'bidding',
  'reviewing',
  'submitted',
  'approved',
] as const;

// 行业列表
export const INDUSTRIES = [
  { value: 'it', label: '信息技术' },
  { value: 'construction', label: '建筑工程' },
  { value: 'finance', label: '金融服务' },
  { value: 'healthcare', label: '医疗卫生' },
] as const;

// 区域列表
export const REGIONS = [
  { value: 'beijing', label: '北京' },
  { value: 'shanghai', label: '上海' },
  { value: 'guangzhou', label: '广州' },
  { value: 'shenzhen', label: '深圳' },
] as const;

/**
 * 生成随机项目数据
 */
export function createProjectData(overrides: Partial<ProjectData> = {}): ProjectData {
  const projectType = faker.helpers.arrayElement(PROJECT_TYPES);
  const industry = faker.helpers.arrayElement(INDUSTRIES);
  const region = faker.helpers.arrayElement(REGIONS);
  
  return {
    name: faker.company.name() + '投标项目',
    code: `PRJ-${faker.string.numeric(6)}`,
    tenderCode: `TB-${faker.string.alphanumeric(8).toUpperCase()}`,
    type: projectType.value,
    industry: industry.value,
    region: region.value,
    tenderOrganization: faker.company.name(),
    tenderAgent: faker.company.name(),
    tenderMethod: 'public',
    budget: faker.number.int({ min: 100000, max: 10000000 }).toString(),
    publishDate: faker.date.future().toISOString().split('T')[0],
    registerDeadline: faker.date.future().toISOString().split('T')[0],
    questionDeadline: faker.date.future().toISOString().split('T')[0],
    submissionDeadline: faker.date.future().toISOString().split('T')[0],
    openBidDate: faker.date.future().toISOString().split('T')[0],
    description: faker.lorem.paragraph(),
    ...overrides,
  };
}

export interface ProjectData {
  name: string;
  code: string;
  tenderCode?: string;
  type?: string;
  industry?: string;
  region?: string;
  tenderOrganization?: string;
  tenderAgent?: string;
  tenderMethod?: string;
  budget?: string;
  publishDate?: string;
  registerDeadline?: string;
  questionDeadline?: string;
  submissionDeadline?: string;
  openBidDate?: string;
  ownerId?: string;
  departmentId?: string;
  description?: string;
}

/**
 * 生成随机文档数据
 */
export function createDocumentData(overrides: Partial<DocumentData> = {}): DocumentData {
  return {
    name: faker.system.fileName() + '.docx',
    type: faker.helpers.arrayElement(['technical', 'business', 'contract']),
    content: faker.lorem.paragraphs(3),
    ...overrides,
  };
}

export interface DocumentData {
  name: string;
  type?: string;
  content?: string;
  projectId?: number;
}

/**
 * 生成随机知识条目数据
 */
export function createKnowledgeData(overrides: Partial<KnowledgeData> = {}): KnowledgeData {
  return {
    title: faker.commerce.productName(),
    content: faker.lorem.paragraphs(5),
    category: faker.helpers.arrayElement(['技术', '商务', '法律', '财务']),
    tags: faker.helpers.arrayElements(['投标', '标书', '模板', '范例', '规范'], 2),
    ...overrides,
  };
}

export interface KnowledgeData {
  title: string;
  content?: string;
  category?: string;
  tags?: string[];
}

/**
 * 生成随机用户数据
 */
export function createUserData(overrides: Partial<UserData> = {}): UserData {
  return {
    username: faker.internet.username().toLowerCase(),
    password: 'Test@123456',
    realName: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number({ style: 'human' }),
    departmentId: 1,
    ...overrides,
  };
}

export interface UserData {
  username: string;
  password: string;
  realName: string;
  email?: string;
  phone?: string;
  departmentId?: number;
  roleIds?: number[];
}

/**
 * 生成随机里程碑数据
 */
export function createMilestoneData(overrides: Partial<MilestoneData> = {}): MilestoneData {
  return {
    name: faker.hacker.phrase(),
    description: faker.lorem.sentence(),
    dueDate: faker.date.future().toISOString(),
    ...overrides,
  };
}

export interface MilestoneData {
  name: string;
  description?: string;
  dueDate?: string;
  projectId?: number;
}

/**
 * 批量生成数据
 */
export function createBatchData<T>(
  factory: () => T,
  count: number
): T[] {
  return Array.from({ length: count }, factory);
}

/**
 * 随机选择数组元素
 */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 随机选择多个数组元素
 */
export function randomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

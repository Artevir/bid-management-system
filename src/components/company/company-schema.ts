import { z } from 'zod';

// 表单验证Schema - 抽离以实现前后端/组件间复用
export const companyFormSchema = z.object({
  // 基本信息
  name: z.string().min(2, '公司名称至少2个字符').max(200, '公司名称不能超过200个字符'),
  shortName: z.string().max(50, '公司简称不能超过50个字符').optional().or(z.literal('')),
  creditCode: z.string().min(18, '统一社会信用代码格式不正确').max(50, '统一社会信用代码格式不正确'),
  registerAddress: z.string().min(5, '注册地址至少5个字符').max(500, '注册地址不能超过500个字符'),
  officeAddress: z.string().max(500, '办公地址不能超过500个字符').optional().or(z.literal('')),
  
  // 法定代表人信息
  legalPersonName: z.string().min(2, '法定代表人姓名至少2个字符').max(50, '法定代表人姓名不能超过50个字符'),
  legalPersonIdCard: z.string()
    .regex(/(^\d{18}$)|(^\d{17}(\d|X|x)$)/, '身份证号格式不正确')
    .optional()
    .or(z.literal('')),
  
  // 代理人信息
  agentName: z.string().max(50, '代理人姓名不能超过50个字符').optional().or(z.literal('')),
  agentIdCard: z.string()
    .regex(/(^\d{18}$)|(^\d{17}(\d|X|x)$)/, '身份证号格式不正确')
    .optional()
    .or(z.literal('')),
  
  // 接口人信息
  contactPersonName: z.string().min(2, '接口人姓名至少2个字符').max(50, '接口人姓名不能超过50个字符'),
  contactPersonDept: z.string().max(100, '部门名称不能超过100个字符').optional().or(z.literal('')),
  contactPersonPosition: z.string().max(50, '职务不能超过50个字符').optional().or(z.literal('')),
  contactPersonPhone: z.string().max(20, '电话号码不能超过20个字符').optional().or(z.literal('')),
  contactPersonEmail: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  contactPersonWechat: z.string().max(50, '微信号不能超过50个字符').optional().or(z.literal('')),
  
  // 公司属性
  industry: z.string().optional().or(z.literal('')),
  companyType: z.string().optional().or(z.literal('')),
  registeredCapital: z.string().max(50, '注册资本不能超过50个字符').optional().or(z.literal('')),
  establishDate: z.string().optional().or(z.literal('')),
  businessScope: z.string().optional().or(z.literal('')),
  
  // 银行信息
  bankName: z.string().max(100, '开户银行不能超过100个字符').optional().or(z.literal('')),
  bankAccount: z.string().max(50, '银行账号不能超过50个字符').optional().or(z.literal('')),
  taxpayerType: z.string().optional().or(z.literal('')),
  
  // 描述
  description: z.string().optional().or(z.literal('')),
  remarks: z.string().optional().or(z.literal('')),
  
  // 默认公司
  isDefault: z.boolean().default(false),
});

export type CompanyFormData = z.infer<typeof companyFormSchema>;

// 行业选项
export const INDUSTRY_OPTIONS = [
  { value: 'it', label: '信息技术' },
  { value: 'manufacturing', label: '制造业' },
  { value: 'construction', label: '建筑业' },
  { value: 'finance', label: '金融业' },
  { value: 'education', label: '教育' },
  { value: 'healthcare', label: '医疗健康' },
  { value: 'logistics', label: '物流运输' },
  { value: 'energy', label: '能源环保' },
  { value: 'consulting', label: '咨询服务' },
  { value: 'other', label: '其他' },
];

// 企业类型选项
export const COMPANY_TYPE_OPTIONS = [
  { value: 'limited', label: '有限责任公司' },
  { value: 'joint_stock', label: '股份有限公司' },
  { value: 'state_owned', label: '国有企业' },
  { value: 'collective', label: '集体企业' },
  { value: 'private', label: '私营企业' },
  { value: 'foreign', label: '外商投资企业' },
  { value: 'other', label: '其他' },
];

// 纳税人类型选项
export const TAXPAYER_TYPE_OPTIONS = [
  { value: 'general', label: '一般纳税人' },
  { value: 'small', label: '小规模纳税人' },
];

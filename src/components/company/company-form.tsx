/**
 * 公司信息表单组件
 */

'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Loader2, Building2, User, Phone, CreditCard, FileText } from 'lucide-react';

// 表单验证Schema
const companyFormSchema = z.object({
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

interface CompanyFormProps {
  initialData?: Partial<CompanyFormData>;
  onSubmit: (data: CompanyFormData) => Promise<void>;
  isSubmitting?: boolean;
  className?: string;
}

// 行业选项
const INDUSTRY_OPTIONS = [
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
const COMPANY_TYPE_OPTIONS = [
  { value: 'limited', label: '有限责任公司' },
  { value: 'joint_stock', label: '股份有限公司' },
  { value: 'state_owned', label: '国有企业' },
  { value: 'collective', label: '集体企业' },
  { value: 'private', label: '私营企业' },
  { value: 'foreign', label: '外商投资企业' },
  { value: 'other', label: '其他' },
];

// 纳税人类型选项
const TAXPAYER_TYPE_OPTIONS = [
  { value: 'general', label: '一般纳税人' },
  { value: 'small', label: '小规模纳税人' },
];

export function CompanyForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  className,
}: CompanyFormProps) {
  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      shortName: initialData?.shortName || '',
      creditCode: initialData?.creditCode || '',
      registerAddress: initialData?.registerAddress || '',
      officeAddress: initialData?.officeAddress || '',
      legalPersonName: initialData?.legalPersonName || '',
      legalPersonIdCard: initialData?.legalPersonIdCard || '',
      agentName: initialData?.agentName || '',
      agentIdCard: initialData?.agentIdCard || '',
      contactPersonName: initialData?.contactPersonName || '',
      contactPersonDept: initialData?.contactPersonDept || '',
      contactPersonPosition: initialData?.contactPersonPosition || '',
      contactPersonPhone: initialData?.contactPersonPhone || '',
      contactPersonEmail: initialData?.contactPersonEmail || '',
      contactPersonWechat: initialData?.contactPersonWechat || '',
      industry: initialData?.industry || '',
      companyType: initialData?.companyType || '',
      registeredCapital: initialData?.registeredCapital || '',
      establishDate: initialData?.establishDate || '',
      businessScope: initialData?.businessScope || '',
      bankName: initialData?.bankName || '',
      bankAccount: initialData?.bankAccount || '',
      taxpayerType: initialData?.taxpayerType || '',
      description: initialData?.description || '',
      remarks: initialData?.remarks || '',
      isDefault: initialData?.isDefault || false,
    },
  });

  const handleSubmit = async (data: CompanyFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn('space-y-8', className)}
      >
        {/* 基本信息 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公司名称 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="请输入公司全称" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shortName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公司简称</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入公司简称（选填）" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="creditCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>统一社会信用代码 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="请输入18位信用代码" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="registeredCapital"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>注册资本</FormLabel>
                    <FormControl>
                      <Input placeholder="如：1000万元" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="registerAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>注册地址 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="请输入公司注册地址" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="officeAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>办公地址</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入公司办公地址（选填）" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>所属行业</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择行业" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INDUSTRY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>企业类型</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择企业类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COMPANY_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="establishDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>成立日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessScope"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>经营范围</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入经营范围（选填）"
                        className="min-h-[80px]"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 法定代表人信息 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              法定代表人信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="legalPersonName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>法定代表人姓名 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="请输入法定代表人姓名" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="legalPersonIdCard"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>法定代表人身份证号</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入18位身份证号" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 代理人信息 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              代理人信息（选填）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="agentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>代理人姓名</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入代理人姓名" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="agentIdCard"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>代理人身份证号</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入18位身份证号" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 接口人信息 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5 text-primary" />
              接口人信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="contactPersonName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>接口人姓名 <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="请输入接口人姓名" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPersonDept"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>接口人部门</FormLabel>
                    <FormControl>
                      <Input placeholder="如：市场部" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPersonPosition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>接口人职务</FormLabel>
                    <FormControl>
                      <Input placeholder="如：经理" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPersonPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>接口人电话</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入联系电话" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPersonEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>接口人邮箱</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入电子邮箱" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPersonWechat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>接口人微信</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入微信号" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 银行与税务信息 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              银行与税务信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>开户银行</FormLabel>
                    <FormControl>
                      <Input placeholder="如：中国工商银行" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bankAccount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>银行账号</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入银行账号" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxpayerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>纳税人类型</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择纳税人类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TAXPAYER_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 其他信息 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              其他信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>公司描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入公司相关描述（选填）"
                      className="min-h-[100px]"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入备注信息（选填）"
                      className="min-h-[80px]"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>设为默认公司</FormLabel>
                    <FormDescription>
                      默认公司将在生成文档时自动填充
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 提交按钮 */}
        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => form.reset()}
          >
            重置
          </Button>
          <Button type="submit" disabled={isSubmitting} className="ml-auto">
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {initialData?.name ? '更新公司信息' : '创建公司'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

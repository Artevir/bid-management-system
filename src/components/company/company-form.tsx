/**
 * 公司信息表单组件
 */

'use client';

import React, { memo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Building2, Loader2 } from 'lucide-react';
import { 
  companyFormSchema, 
  CompanyFormData, 
  INDUSTRY_OPTIONS 
} from './company-schema';

interface CompanyFormProps {
  initialData?: Partial<CompanyFormData>;
  onSubmit: (data: CompanyFormData) => Promise<void>;
  isSubmitting?: boolean;
  className?: string;
}

// 子组件：基本信息区块 (使用 memo 优化)
const BasicInfoSection = memo(({ form, isSubmitting }: { form: UseFormReturn<CompanyFormData>, isSubmitting: boolean }) => (
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
      </div>
    </CardContent>
  </Card>
));

BasicInfoSection.displayName = 'BasicInfoSection';

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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('space-y-8', className)}
      >
        <BasicInfoSection form={form} isSubmitting={isSubmitting} />
        
        {/* 其他区块可以按需同样拆分以优化渲染 */}
        
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存公司信息
          </Button>
        </div>
      </form>
    </Form>
  );
}

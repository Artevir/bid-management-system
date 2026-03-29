/**
 * 编辑公司页面
 */

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card as _Card, CardContent as _CardContent, CardHeader as _CardHeader, CardTitle as _CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Building2, Users } from 'lucide-react';
import { CompanyForm, CompanyFormData, CompanyContactsManager } from '@/components/company';
import { toast } from 'sonner';

interface Company {
  id: number;
  name: string;
  shortName: string | null;
  creditCode: string;
  registerAddress: string;
  officeAddress: string | null;
  legalPersonName: string;
  legalPersonIdCard: string | null;
  agentName: string | null;
  agentIdCard: string | null;
  contactPersonName: string;
  contactPersonDept: string | null;
  contactPersonPosition: string | null;
  contactPersonPhone: string | null;
  contactPersonEmail: string | null;
  contactPersonWechat: string | null;
  industry: string | null;
  companyType: string | null;
  registeredCapital: string | null;
  establishDate: string | null;
  businessScope: string | null;
  bankName: string | null;
  bankAccount: string | null;
  taxpayerType: string | null;
  description: string | null;
  remarks: string | null;
  isDefault: boolean;
}

export default function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 加载公司数据
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const response = await fetch(`/api/companies/${id}`);
        
        if (!response.ok) {
          throw new Error('获取公司信息失败');
        }

        const data = await response.json();
        setCompany(data.data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '加载失败');
        router.push('/companies');
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [id, router]);

  const handleSubmit = async (data: CompanyFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/companies/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '更新失败');
      }

      toast.success('公司信息更新成功');
      router.push('/companies');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return null;
  }

  // 转换数据格式
  const initialData: Partial<CompanyFormData> = {
    name: company.name,
    shortName: company.shortName || '',
    creditCode: company.creditCode,
    registerAddress: company.registerAddress,
    officeAddress: company.officeAddress || '',
    legalPersonName: company.legalPersonName,
    legalPersonIdCard: company.legalPersonIdCard || '',
    agentName: company.agentName || '',
    agentIdCard: company.agentIdCard || '',
    contactPersonName: company.contactPersonName,
    contactPersonDept: company.contactPersonDept || '',
    contactPersonPosition: company.contactPersonPosition || '',
    contactPersonPhone: company.contactPersonPhone || '',
    contactPersonEmail: company.contactPersonEmail || '',
    contactPersonWechat: company.contactPersonWechat || '',
    industry: company.industry || '',
    companyType: company.companyType || '',
    registeredCapital: company.registeredCapital || '',
    establishDate: company.establishDate?.split('T')[0] || '',
    businessScope: company.businessScope || '',
    bankName: company.bankName || '',
    bankAccount: company.bankAccount || '',
    taxpayerType: company.taxpayerType || '',
    description: company.description || '',
    remarks: company.remarks || '',
    isDefault: company.isDefault,
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-2xl font-bold">编辑公司</h1>
          <p className="text-muted-foreground">{company.name}</p>
        </div>
      </div>

      {/* 使用Tab组件切换不同内容 */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            基本信息
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            对接人管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          {/* 表单 */}
          <CompanyForm
            initialData={initialData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          {/* 对接人管理 */}
          <CompanyContactsManager companyId={parseInt(id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

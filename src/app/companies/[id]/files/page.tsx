/**
 * 公司文件管理页面
 */

'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Building2, FileText, Upload, AlertTriangle } from 'lucide-react';
import { CompanyFileUploader, CompanyFileList } from '@/components/company';
import { toast } from 'sonner';

// 公司文件类型
interface CompanyFile {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: string;
  fileExt: string;
  fileUrl?: string;
  description?: string;
  validFrom?: string;
  validTo?: string;
  uploaderId: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

// 公司信息
interface Company {
  id: number;
  name: string;
  shortName: string | null;
  creditCode: string;
  isDefault: boolean;
}

export default function CompanyFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');

  // 加载公司信息
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

  // 加载文件列表
  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const response = await fetch(`/api/companies/${id}/files`);
      
      if (!response.ok) {
        throw new Error('获取文件列表失败');
      }

      const data = await response.json();
      setFiles(data.data || []);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setFilesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (company) {
      fetchFiles();
    }
  }, [company, fetchFiles]);

  // 删除文件
  const handleDeleteFile = async (fileId: number) => {
    const response = await fetch(`/api/companies/${id}/files/${fileId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '删除失败');
    }
  };

  // 统计即将到期和已过期的文件数量
  const now = new Date();
  const expiringFiles = files.filter(f => {
    if (!f.validTo) return false;
    const expiryDate = new Date(f.validTo);
    const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 30;
  });

  const expiredFiles = files.filter(f => {
    if (!f.validTo) return false;
    return new Date(f.validTo) < now;
  });

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

  return (
    <div className="container mx-auto py-6 space-y-6">
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
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{company.name}</h1>
            {company.isDefault && (
              <Badge variant="secondary">默认公司</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            统一社会信用代码：{company.creditCode}
          </p>
        </div>
      </div>

      {/* 提醒卡片 */}
      {(expiringFiles.length > 0 || expiredFiles.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expiredFiles.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-red-700 flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5" />
                  已过期文件
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-600">
                  有 <span className="font-bold">{expiredFiles.length}</span> 个资质文件已过期，请及时更新。
                </p>
              </CardContent>
            </Card>
          )}
          {expiringFiles.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-yellow-700 flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5" />
                  即将到期文件
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-600">
                  有 <span className="font-bold">{expiringFiles.length}</span> 个资质文件将在30天内到期。
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>文件总数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{files.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>营业执照</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {files.filter(f => f.fileType === 'business_license').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>资质证书</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {files.filter(f => f.fileType === 'business_certificate').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>业绩文件</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {files.filter(f => f.fileType === 'performance_scan').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 文件管理标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">
            <FileText className="h-4 w-4 mr-2" />
            文件列表
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            上传文件
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          {filesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CompanyFileList
              files={files}
              companyId={company.id}
              onDeleteFile={handleDeleteFile}
              onRefresh={fetchFiles}
            />
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <CompanyFileUploader
            companyId={company.id}
            onUploadComplete={() => {
              fetchFiles();
              setActiveTab('list');
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

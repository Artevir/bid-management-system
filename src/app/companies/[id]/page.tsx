/**
 * 公司详情页面
 * 展示公司完整信息、对接人、资质文件、使用情况等
 */

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Building2,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  Users,
  FileText,
  Star,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Clock,
  FolderOpen,
  FileStack,
  Stamp,
  Handshake,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 完整公司信息类型
interface CompanyFullInfo {
  company: {
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
    establishDate: Date | null;
    businessScope: string | null;
    bankName: string | null;
    bankAccount: string | null;
    taxpayerType: string | null;
    description: string | null;
    remarks: string | null;
    isDefault: boolean;
    isActive: boolean;
  };
  contacts: any[];
  files: any[];
  frameworks: any[];
  usage: {
    projectCount: number;
    archiveCount: number;
    purchaseCount: number;
    printingCount: number;
    sealApplicationCount: number;
    authorizationCount: number;
    partnerApplicationCount: number;
    lastUsedAt: Date | null;
  } | null;
}

// 行业映射
const INDUSTRY_LABELS: Record<string, string> = {
  it: '信息技术',
  manufacturing: '制造业',
  construction: '建筑业',
  finance: '金融业',
  education: '教育',
  healthcare: '医疗健康',
  logistics: '物流运输',
  energy: '能源环保',
  consulting: '咨询服务',
  other: '其他',
};

// 文件类型映射
const FILE_TYPE_LABELS: Record<string, string> = {
  business_license: '营业执照',
  organization_code: '组织机构代码证',
  tax_registration: '税务登记证',
  opening_permit: '开户许可证',
  iso_certificate: 'ISO系列证书',
  qualification_certificate: '资质证书',
  honor_certificate: '荣誉证书',
  legal_person_id: '法人身份证',
  other: '其他',
};

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [companyInfo, setCompanyInfo] = useState<CompanyFullInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCompanyInfo();
  }, [id]);

  const fetchCompanyInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/company-sync?action=full-info&companyId=${id}`);
      const data = await res.json();
      if (data.success) {
        setCompanyInfo(data.data);
      } else {
        toast.error('获取公司信息失败');
        router.push('/companies');
      }
    } catch (error) {
      toast.error('加载失败');
      router.push('/companies');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('公司已删除');
        router.push('/companies');
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'yyyy-MM-dd', { locale: zhCN });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!companyInfo) {
    return (
      <div className="container mx-auto py-6">
        <Button variant="ghost" onClick={() => router.push('/companies')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <div className="mt-8 text-center text-muted-foreground">公司不存在</div>
      </div>
    );
  }

  const { company, contacts, files, frameworks, usage } = companyInfo;

  // 计算即将到期的文件数
  const expiringFilesCount = files.filter(
    (f) => f.daysToExpiry !== null && f.daysToExpiry <= 30 && !f.isExpired
  ).length;

  // 已过期文件数
  const expiredFilesCount = files.filter((f) => f.isExpired).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/companies')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{company.name}</h1>
              {company.shortName && (
                <span className="text-muted-foreground">({company.shortName})</span>
              )}
              {company.isDefault && (
                <Badge className="bg-yellow-100 text-yellow-800">
                  <Star className="h-3 w-3 mr-1" />
                  默认公司
                </Badge>
              )}
              {!company.isActive && (
                <Badge variant="secondary">已停用</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              统一社会信用代码：{company.creditCode}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/companies/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/companies/${id}/files`}>
              <FileText className="mr-2 h-4 w-4" />
              资质文件
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除公司"{company.name}"吗？此操作不可恢复。
                  {usage && usage.projectCount > 0 && (
                    <p className="mt-2 text-destructive">
                      警告：该公司已关联 {usage.projectCount} 个项目，删除后关联将被清除。
                    </p>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? '删除中...' : '确认删除'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">关联项目</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.projectCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">对接人</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">资质文件</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{files.length}</div>
            {expiredFilesCount > 0 && (
              <p className="text-xs text-destructive">{expiredFilesCount} 已过期</p>
            )}
            {expiringFilesCount > 0 && (
              <p className="text-xs text-yellow-600">{expiringFilesCount} 即将到期</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">业务参与</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(usage?.purchaseCount || 0) +
                (usage?.printingCount || 0) +
                (usage?.sealApplicationCount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">买标/打印/盖章</p>
          </CardContent>
        </Card>
      </div>

      {/* 资质到期预警 */}
      {(expiredFilesCount > 0 || expiringFilesCount > 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div className="flex-1">
              <p className="font-medium text-yellow-900">资质文件到期提醒</p>
              <p className="text-sm text-yellow-700">
                {expiredFilesCount > 0 && `${expiredFilesCount} 份文件已过期`}
                {expiredFilesCount > 0 && expiringFilesCount > 0 && '，'}
                {expiringFilesCount > 0 && `${expiringFilesCount} 份文件将在30天内到期`}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/companies/${id}/files`}>
                查看详情
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 详情标签页 */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">基本信息</TabsTrigger>
          <TabsTrigger value="contacts">
            对接人
            {contacts.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {contacts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="files">
            资质文件
            {files.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {files.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="frameworks">文档框架</TabsTrigger>
          <TabsTrigger value="usage">使用情况</TabsTrigger>
        </TabsList>

        {/* 基本信息 */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>企业基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 工商信息 */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">工商信息</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">公司名称</p>
                    <p className="font-medium">{company.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">公司简称</p>
                    <p className="font-medium">{company.shortName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">统一社会信用代码</p>
                    <p className="font-medium">{company.creditCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">所属行业</p>
                    <p className="font-medium">
                      {company.industry ? INDUSTRY_LABELS[company.industry] || company.industry : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">企业类型</p>
                    <p className="font-medium">{company.companyType || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">注册资本</p>
                    <p className="font-medium">{company.registeredCapital || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">成立日期</p>
                    <p className="font-medium">{formatDate(company.establishDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">纳税人类型</p>
                    <p className="font-medium">{company.taxpayerType || '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 地址信息 */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  地址信息
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">注册地址</p>
                    <p className="font-medium">{company.registerAddress || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">办公地址</p>
                    <p className="font-medium">{company.officeAddress || '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 法人信息 */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">法定代表人</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">姓名</p>
                    <p className="font-medium">{company.legalPersonName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">身份证号</p>
                    <p className="font-medium">{company.legalPersonIdCard || '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 代理人信息 */}
              {(company.agentName || company.agentIdCard) && (
                <>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">代理人</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">姓名</p>
                        <p className="font-medium">{company.agentName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">身份证号</p>
                        <p className="font-medium">{company.agentIdCard || '-'}</p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* 接口人信息 */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  <Users className="inline h-4 w-4 mr-1" />
                  接口人
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">姓名</p>
                    <p className="font-medium">{company.contactPersonName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">部门</p>
                    <p className="font-medium">{company.contactPersonDept || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">职务</p>
                    <p className="font-medium">{company.contactPersonPosition || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">电话</p>
                    <p className="font-medium">{company.contactPersonPhone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">邮箱</p>
                    <p className="font-medium">{company.contactPersonEmail || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">微信</p>
                    <p className="font-medium">{company.contactPersonWechat || '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 银行信息 */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  <CreditCard className="inline h-4 w-4 mr-1" />
                  银行信息
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">开户银行</p>
                    <p className="font-medium">{company.bankName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">银行账号</p>
                    <p className="font-medium">{company.bankAccount || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 经营范围 */}
              {company.businessScope && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">经营范围</h4>
                    <p className="text-sm">{company.businessScope}</p>
                  </div>
                </>
              )}

              {/* 备注 */}
              {company.remarks && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">备注</h4>
                    <p className="text-sm">{company.remarks}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 对接人 */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>公司对接人</CardTitle>
                <CardDescription>管理和维护公司的业务对接人信息</CardDescription>
              </div>
              <Button asChild>
                <Link href={`/companies/${id}/edit?tab=contacts`}>
                  <Edit className="mr-2 h-4 w-4" />
                  管理
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无对接人信息
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>姓名</TableHead>
                      <TableHead>部门/职务</TableHead>
                      <TableHead>电话</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contact.name}</span>
                            {contact.isPrimary && (
                              <Badge variant="secondary" className="text-xs">
                                主要
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.department || '-'}
                          {contact.position && ` / ${contact.position}`}
                        </TableCell>
                        <TableCell>{contact.phone || '-'}</TableCell>
                        <TableCell>{contact.email || '-'}</TableCell>
                        <TableCell>
                          {contact.roles && contact.roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {contact.roles.slice(0, 2).map((role: any, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {role.name || role}
                                </Badge>
                              ))}
                              {contact.roles.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{contact.roles.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.isActive ? (
                            <Badge className="bg-green-100 text-green-800">活跃</Badge>
                          ) : (
                            <Badge variant="secondary">停用</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 资质文件 */}
        <TabsContent value="files">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>资质文件</CardTitle>
                <CardDescription>公司的资质证书、营业执照等文件</CardDescription>
              </div>
              <Button asChild>
                <Link href={`/companies/${id}/files`}>
                  <FileText className="mr-2 h-4 w-4" />
                  管理
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无资质文件
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>有效期</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.fileName}</TableCell>
                        <TableCell>
                          {FILE_TYPE_LABELS[file.fileType] || file.fileType}
                        </TableCell>
                        <TableCell>
                          {file.validTo ? formatDate(file.validTo) : '长期有效'}
                        </TableCell>
                        <TableCell>
                          {file.isExpired ? (
                            <Badge className="bg-red-100 text-red-800">已过期</Badge>
                          ) : file.daysToExpiry !== null && file.daysToExpiry <= 30 ? (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Clock className="h-3 w-3 mr-1" />
                              {file.daysToExpiry}天后到期
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              有效
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 文档框架 */}
        <TabsContent value="frameworks">
          <Card>
            <CardHeader>
              <CardTitle>文档框架</CardTitle>
              <CardDescription>公司专属的投标文件框架模板</CardDescription>
            </CardHeader>
            <CardContent>
              {frameworks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无文档框架
                </div>
              ) : (
                <div className="grid gap-4">
                  {frameworks.map((framework) => (
                    <div
                      key={framework.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{framework.name}</span>
                          {framework.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              默认
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {framework.description || framework.documentType}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {framework.chapterCount} 章节
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 使用情况 */}
        <TabsContent value="usage">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">业务参与统计</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span>关联项目</span>
                  </div>
                  <span className="font-bold">{usage?.projectCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileStack className="h-4 w-4 text-muted-foreground" />
                    <span>标书归档</span>
                  </div>
                  <span className="font-bold">{usage?.archiveCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>买标书安排</span>
                  </div>
                  <span className="font-bold">{usage?.purchaseCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileStack className="h-4 w-4 text-muted-foreground" />
                    <span>打印安排</span>
                  </div>
                  <span className="font-bold">{usage?.printingCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stamp className="h-4 w-4 text-muted-foreground" />
                    <span>盖章申请</span>
                  </div>
                  <span className="font-bold">{usage?.sealApplicationCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <span>授权申请</span>
                  </div>
                  <span className="font-bold">{usage?.authorizationCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Handshake className="h-4 w-4 text-muted-foreground" />
                    <span>友司支持</span>
                  </div>
                  <span className="font-bold">{usage?.partnerApplicationCount || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">使用时间线</CardTitle>
              </CardHeader>
              <CardContent>
                {usage?.lastUsedAt ? (
                  <div className="text-sm">
                    <p className="text-muted-foreground">最近使用时间</p>
                    <p className="font-medium">{formatDate(usage.lastUsedAt)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无使用记录</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

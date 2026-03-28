/**
 * 投标支持模块主页
 */

'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileCheck,
  Package,
  DollarSign,
  Building,
  List,
  ArrowRight,
} from 'lucide-react';

const modules = [
  {
    title: '授权申请',
    description: '管理授权申请、厂家资质、配套材料等',
    href: '/support/authorizations',
    icon: FileCheck,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
  {
    title: '样机申请',
    description: '样机申请、现场展示、归还管理',
    href: '/support/sample-applications',
    icon: Package,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
  },
  {
    title: '价格申请',
    description: '产品价格申请与审批管理',
    href: '/support/price-applications',
    icon: DollarSign,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
  },
  {
    title: '友司支持',
    description: '友司投标支持申请、材料管理、费用管理',
    href: '/support/partner-applications',
    icon: Building,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
  },
];

export default function SupportPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">投标支持</h1>
        <p className="text-muted-foreground">授权申请、样机申请、价格申请、友司支持管理</p>
      </div>

      {/* 功能模块 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {modules.map((module) => (
          <Card
            key={module.href}
            className="hover:shadow-md transition-shadow cursor-pointer"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${module.bgColor}`}>
                  <module.icon className={`h-6 w-6 ${module.color}`} />
                </div>
                <Link href={module.href}>
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <CardTitle className="text-lg">{module.title}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={module.href}>
                <Button variant="outline" className="w-full">
                  进入模块
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 快捷入口 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">快捷入口</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/support/applications">
              <Button variant="outline">
                <List className="mr-2 h-4 w-4" />
                全部申请
              </Button>
            </Link>
            <Link href="/support/authorizations/create">
              <Button variant="outline">
                <FileCheck className="mr-2 h-4 w-4" />
                新建授权申请
              </Button>
            </Link>
            <Link href="/support/sample-applications/create">
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                新建样机申请
              </Button>
            </Link>
            <Link href="/support/price-applications/create">
              <Button variant="outline">
                <DollarSign className="mr-2 h-4 w-4" />
                新建价格申请
              </Button>
            </Link>
            <Link href="/support/partner-applications/create">
              <Button variant="outline">
                <Building className="mr-2 h-4 w-4" />
                新建友司支持
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { TemplateCategoryManager } from '@/components/templates/template-category-manager';

export default function TemplateCategoriesPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">模板分类管理</h1>
        <p className="text-muted-foreground">管理章节模板的分类，支持动态增删改查</p>
      </div>
      
      <TemplateCategoryManager />
    </div>
  );
}

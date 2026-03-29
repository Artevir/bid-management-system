'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch as _Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  SlidersHorizontal,
  Save,
  Bookmark,
  X,
  Calendar,
  Hash,
  Palette,
  Loader2,
  Trash2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface Category {
  id: number;
  name: string;
  code: string;
  color: string;
}

interface SavedFilter {
  id: number;
  name: string;
  entityType: string;
  filters: string;
  isDefault: boolean;
  createdAt: string;
}

interface SearchFilters {
  keyword: string;
  categoryIds: number[];
  types: string[];
  colors: string[];
  entityTypes: string[];
  useCountRange: { min?: number; max?: number };
  dateRange: { start?: string; end?: string };
  isSystem?: boolean;
  hasChildren?: boolean;
  sortBy: string;
  sortOrder: string;
}

interface AdvancedSearchPanelProps {
  categories: Category[];
  onSearch: (filters: SearchFilters) => void;
  loading?: boolean;
}

// ============================================
// Main Component
// ============================================

export function AdvancedSearchPanel({
  categories,
  onSearch,
  loading = false,
}: AdvancedSearchPanelProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: '',
    categoryIds: [],
    types: [],
    colors: [],
    entityTypes: [],
    useCountRange: {},
    dateRange: {},
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const [savedFiltersList, setSavedFiltersList] = useState<SavedFilter[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // 预定义颜色
  const colorOptions = [
    { value: '#6366f1', label: '靛蓝' },
    { value: '#8b5cf6', label: '紫罗兰' },
    { value: '#ec4899', label: '粉红' },
    { value: '#ef4444', label: '红色' },
    { value: '#f97316', label: '橙色' },
    { value: '#eab308', label: '黄色' },
    { value: '#22c55e', label: '绿色' },
    { value: '#14b8a6', label: '青色' },
    { value: '#0ea5e9', label: '蓝色' },
    { value: '#64748b', label: '灰色' },
  ];

  // 实体类型选项
  const _entityTypeOptions = [
    { value: 'project', label: '项目' },
    { value: 'document', label: '文档' },
    { value: 'template', label: '模板' },
    { value: 'scheme', label: '方案' },
    { value: 'bid', label: '投标' },
  ];

  // 排序选项
  const sortOptions = [
    { value: 'name', label: '名称' },
    { value: 'useCount', label: '使用次数' },
    { value: 'createdAt', label: '创建时间' },
    { value: 'updatedAt', label: '更新时间' },
  ];

  // 计算活跃筛选条件数量
  useEffect(() => {
    let count = 0;
    if (filters.keyword) count++;
    if (filters.categoryIds.length > 0) count++;
    if (filters.types.length > 0) count++;
    if (filters.colors.length > 0) count++;
    if (filters.entityTypes.length > 0) count++;
    if (filters.useCountRange.min !== undefined || filters.useCountRange.max !== undefined) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.isSystem !== undefined) count++;
    if (filters.hasChildren !== undefined) count++;
    setActiveFilterCount(count);
  }, [filters]);

  // 加载保存的筛选方案
  const loadSavedFilters = async () => {
    try {
      const response = await fetch('/api/tags/filters?entityType=tag');
      const data = await response.json();
      setSavedFiltersList(data.items || []);
    } catch (error) {
      console.error('加载筛选方案失败:', error);
    }
  };

  useEffect(() => {
    loadSavedFilters();
  }, []);

  // 执行搜索
  const handleSearch = () => {
    onSearch(filters);
  };

  // 清除所有筛选
  const handleClearFilters = () => {
    setFilters({
      keyword: '',
      categoryIds: [],
      types: [],
      colors: [],
      entityTypes: [],
      useCountRange: {},
      dateRange: {},
      sortBy: 'name',
      sortOrder: 'asc',
    });
  };

  // 保存筛选方案
  const handleSaveFilter = async () => {
    if (!filterName.trim()) return;

    try {
      await fetch('/api/tags/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: filterName,
          entityType: 'tag',
          filters: filters,
        }),
      });

      setFilterName('');
      setSaveDialogOpen(false);
      loadSavedFilters();
    } catch (error) {
      console.error('保存筛选方案失败:', error);
    }
  };

  // 加载筛选方案
  const handleLoadFilter = (saved: SavedFilter) => {
    const parsedFilters = JSON.parse(saved.filters);
    setFilters(parsedFilters);
    onSearch(parsedFilters);
  };

  // 删除筛选方案
  const handleDeleteFilter = async (id: number) => {
    try {
      await fetch(`/api/tags/filters?id=${id}`, {
        method: 'DELETE',
      });
      loadSavedFilters();
    } catch (error) {
      console.error('删除筛选方案失败:', error);
    }
  };

  // 切换分类选择
  const toggleCategory = (categoryId: number) => {
    setFilters((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  };

  // 切换类型选择
  const toggleType = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  };

  // 切换颜色选择
  const toggleColor = (color: string) => {
    setFilters((prev) => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter((c) => c !== color)
        : [...prev.colors, color],
    }));
  };

  // 切换实体类型选择
  const _toggleEntityType = (entityType: string) => {
    setFilters((prev) => ({
      ...prev,
      entityTypes: prev.entityTypes.includes(entityType)
        ? prev.entityTypes.filter((t) => t !== entityType)
        : [...prev.entityTypes, entityType],
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">高级搜索</CardTitle>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} 个筛选条件</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              disabled={activeFilterCount === 0}
            >
              <X className="h-4 w-4 mr-1" />
              清除
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 关键词搜索 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索标签名称、代码或描述..."
              value={filters.keyword}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, keyword: e.target.value }))
              }
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 高级筛选 */}
        <div className="flex flex-wrap gap-2">
          {/* 分类筛选 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Hash className="h-4 w-4 mr-1" />
                分类
                {filters.categoryIds.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {filters.categoryIds.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">选择分类</Label>
                <div className="flex flex-wrap gap-1">
                  {categories.map((category) => (
                    <Badge
                      key={category.id}
                      variant={
                        filters.categoryIds.includes(category.id)
                          ? 'default'
                          : 'outline'
                      }
                      className="cursor-pointer"
                      onClick={() => toggleCategory(category.id)}
                    >
                      <div
                        className="w-2 h-2 rounded-sm mr-1"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 类型筛选 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                类型
                {filters.types.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {filters.types.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="start">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">选择类型</Label>
                <div className="flex gap-2">
                  <Badge
                    variant={filters.types.includes('tag') ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleType('tag')}
                  >
                    标签
                  </Badge>
                  <Badge
                    variant={filters.types.includes('directory') ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleType('directory')}
                  >
                    目录
                  </Badge>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 颜色筛选 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Palette className="h-4 w-4 mr-1" />
                颜色
                {filters.colors.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {filters.colors.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">选择颜色</Label>
                <div className="grid grid-cols-5 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      className={cn(
                        'w-8 h-8 rounded-md border-2 transition-all',
                        filters.colors.includes(color.value)
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent hover:border-muted-foreground/30'
                      )}
                      style={{ backgroundColor: color.value }}
                      onClick={() => toggleColor(color.value)}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 使用次数筛选 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4 mr-1" />
                使用次数
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">使用次数范围</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="最小"
                    value={filters.useCountRange.min ?? ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        useCountRange: {
                          ...prev.useCountRange,
                          min: e.target.value ? parseInt(e.target.value) : undefined,
                        },
                      }))
                    }
                    className="w-20"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder="最大"
                    value={filters.useCountRange.max ?? ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        useCountRange: {
                          ...prev.useCountRange,
                          max: e.target.value ? parseInt(e.target.value) : undefined,
                        },
                      }))
                    }
                    className="w-20"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 日期范围筛选 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-1" />
                日期
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">创建日期范围</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={filters.dateRange.start || ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, start: e.target.value },
                      }))
                    }
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="date"
                    value={filters.dateRange.end || ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, end: e.target.value },
                      }))
                    }
                    className="flex-1"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 更多筛选 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                更多
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">系统标签</Label>
                  <Select
                    value={filters.isSystem?.toString() ?? 'all'}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        isSystem: value === 'all' ? undefined : value === 'true',
                      }))
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="true">是</SelectItem>
                      <SelectItem value="false">否</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm">有子标签</Label>
                  <Select
                    value={filters.hasChildren?.toString() ?? 'all'}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        hasChildren: value === 'all' ? undefined : value === 'true',
                      }))
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="true">是</SelectItem>
                      <SelectItem value="false">否</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-8" />

          {/* 排序 */}
          <Select
            value={filters.sortBy}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, sortBy: value }))
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
              }))
            }
          >
            {filters.sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
          </Button>

          <Separator orientation="vertical" className="h-8" />

          {/* 保存筛选方案 */}
          <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)}>
            <Save className="h-4 w-4 mr-1" />
            保存方案
          </Button>

          {/* 加载筛选方案 */}
          {savedFiltersList.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Bookmark className="h-4 w-4 mr-1" />
                  我的方案
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">保存的筛选方案</Label>
                  {savedFiltersList.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                    >
                      <div className="flex items-center gap-2" onClick={() => handleLoadFilter(saved)}>
                        {saved.isDefault && <Check className="h-3 w-3 text-primary" />}
                        <span className="text-sm">{saved.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFilter(saved.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CardContent>

      {/* 保存筛选方案对话框 */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存筛选方案</DialogTitle>
            <DialogDescription>
              为当前筛选方案命名，方便以后快速使用
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="输入方案名称"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveFilter} disabled={!filterName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

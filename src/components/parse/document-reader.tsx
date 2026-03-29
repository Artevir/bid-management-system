'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription as _CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Loader2,
  ChevronRight,
  ChevronDown,
  Eye,
  Check,
  AlertTriangle,
  Clock,
  Award,
  Shield,
  Settings,
  FileCheck,
} from 'lucide-react';
import type { ParseItemType } from '@/lib/parse/service';

// 文档章节
interface DocumentSection {
  id: string;
  title: string;
  level: number;
  content: string;
  type: 'chapter' | 'section' | 'subsection' | 'clause';
  children?: DocumentSection[];
}

// 解析项
interface ParseItem {
  id: number;
  type: ParseItemType;
  title: string;
  content: string;
  originalText: string | null;
  pageNumber: number | null;
  confidence: number;
  isLowConfidence: boolean;
  isConfirmed: boolean;
  extraData: Record<string, unknown> | null;
}

// 类型图标映射
const TYPE_ICONS: Record<ParseItemType, React.ElementType> = {
  deadline: Clock,
  qualification: Shield,
  scoring_item: Award,
  technical_param: Settings,
  commercial: FileCheck,
  requirement: FileText,
};

// 类型标签映射
const TYPE_LABELS: Record<ParseItemType, string> = {
  deadline: '时间节点',
  qualification: '资格条件',
  scoring_item: '评分项',
  technical_param: '技术参数',
  commercial: '商务条款',
  requirement: '其他要求',
};

interface DocumentReaderProps {
  taskId: number;
  documentContent?: string;
}

export function DocumentReader({ taskId, documentContent }: DocumentReaderProps) {
  const [sections, setSections] = useState<DocumentSection[]>([]);
  const [items, setItems] = useState<ParseItem[]>([]);
  const [selectedSection, setSelectedSection] = useState<DocumentSection | null>(null);
  const [selectedItem, setSelectedItem] = useState<ParseItem | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<ParseItemType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [taskId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 获取章节
      const sectionsRes = await fetch(`/api/parse/tasks/${taskId}/sections`);
      if (sectionsRes.ok) {
        const data = await sectionsRes.json();
        setSections(data.sections || []);
      }

      // 获取解析项
      const itemsRes = await fetch(`/api/parse/tasks/${taskId}/items`);
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleItemClick = (item: ParseItem) => {
    setSelectedItem(item);
    // 滚动到原文位置
    if (item.originalText && contentRef.current) {
      // 简单的高亮实现
      const regex = new RegExp(item.originalText.substring(0, 50), 'gi');
      const content = contentRef.current.innerHTML;
      if (regex.test(content)) {
        contentRef.current.innerHTML = content.replace(
          regex,
          `<mark class="bg-yellow-200">${item.originalText.substring(0, 50)}</mark>`
        );
      }
    }
  };

  const filteredItems = items.filter(
    (item) => filterType === 'all' || item.type === filterType
  );

  // 渲染章节树
  const renderSectionTree = (section: DocumentSection, depth: number = 0) => {
    const hasChildren = section.children && section.children.length > 0;
    const isExpanded = expandedSections.has(section.id);
    const isSelected = selectedSection?.id === section.id;

    return (
      <div key={section.id}>
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50 ${
            isSelected ? 'bg-primary/10' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            setSelectedSection(section);
            if (hasChildren) toggleSection(section.id);
          }}
        >
          {hasChildren && (
            <button className="p-0.5">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          {!hasChildren && <span className="w-5" />}
          <span className="text-sm truncate">{section.title}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {section.children!.map((child) => renderSectionTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // 渲染解析项列表
  const renderItemsList = () => {
    // 按类型分组
    const groupedItems: Record<string, ParseItem[]> = {};
    filteredItems.forEach((item) => {
      if (!groupedItems[item.type]) {
        groupedItems[item.type] = [];
      }
      groupedItems[item.type].push(item);
    });

    return (
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([type, typeItems]) => {
          const Icon = TYPE_ICONS[type as ParseItemType];
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {TYPE_LABELS[type as ParseItemType]}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {typeItems.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {typeItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedItem?.id === item.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {item.content}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {item.isLowConfidence && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            低置信度
                          </Badge>
                        )}
                        {item.isConfirmed && (
                          <Badge variant="default" className="bg-green-500 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            已确认
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.pageNumber && (
                      <p className="text-xs text-muted-foreground mt-2">
                        第 {item.pageNumber} 页
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 渲染详情面板
  const renderDetailPanel = () => {
    if (selectedItem) {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-sm text-muted-foreground mb-1">
              {TYPE_LABELS[selectedItem.type]}
            </h3>
            <h2 className="text-lg font-semibold">{selectedItem.title}</h2>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="text-sm font-medium mb-2">解析内容</h4>
            <p className="text-sm">{selectedItem.content}</p>
          </div>
          
          {selectedItem.originalText && (
            <div>
              <h4 className="text-sm font-medium mb-2">原文引用</h4>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm italic">{selectedItem.originalText}</p>
              </div>
            </div>
          )}
          
          <div className="flex gap-4">
            <div>
              <h4 className="text-sm font-medium">置信度</h4>
              <p className="text-sm text-muted-foreground">
                {selectedItem.confidence}%
              </p>
            </div>
            {selectedItem.pageNumber && (
              <div>
                <h4 className="text-sm font-medium">页码</h4>
                <p className="text-sm text-muted-foreground">
                  第 {selectedItem.pageNumber} 页
                </p>
              </div>
            )}
          </div>
          
          {selectedItem.extraData && (
            <div>
              <h4 className="text-sm font-medium mb-2">详细信息</h4>
              <div className="bg-muted p-3 rounded-lg">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(selectedItem.extraData, null, 2)}
                </pre>
              </div>
            </div>
          )}
          
          {!selectedItem.isConfirmed && (
            <Button className="w-full">
              <Check className="h-4 w-4 mr-2" />
              确认此解析项
            </Button>
          )}
        </div>
      );
    }
    
    if (selectedSection) {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-sm text-muted-foreground mb-1">
              {selectedSection.type === 'chapter' ? '章' : 
               selectedSection.type === 'section' ? '节' : 
               selectedSection.type === 'subsection' ? '小节' : '条款'}
            </h3>
            <h2 className="text-lg font-semibold">{selectedSection.title}</h2>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="text-sm font-medium mb-2">内容摘要</h4>
            <p className="text-sm">{selectedSection.content}</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Eye className="h-8 w-8 mb-2" />
        <p className="text-sm">选择左侧章节或解析项查看详情</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)] min-h-[600px]">
      {/* 左侧：章节大纲 */}
      <Card className="col-span-3">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">文档大纲</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="py-2">
              {sections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  暂无章节信息
                </div>
              ) : (
                sections.map((section) => renderSectionTree(section))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 中间：原文内容 */}
      <Card className="col-span-5">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">原文内容</CardTitle>
            {selectedSection && (
              <Badge variant="outline">{selectedSection.title}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div
              ref={contentRef}
              className="p-4 prose prose-sm max-w-none"
            >
              {documentContent || selectedSection?.content || (
                <div className="text-center py-8 text-muted-foreground">
                  暂无内容
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 右侧：解析项与详情 */}
      <Card className="col-span-4">
        <CardHeader className="py-3">
          <Tabs defaultValue="items" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="items">解析项</TabsTrigger>
              <TabsTrigger value="detail">详情</TabsTrigger>
            </TabsList>
            <TabsContent value="items" className="mt-3">
              <div className="flex gap-2 mb-3">
                <select
                  className="text-xs border rounded px-2 py-1"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as ParseItemType | 'all')}
                >
                  <option value="all">全部类型</option>
                  {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <Badge variant="secondary">{filteredItems.length} 项</Badge>
              </div>
            </TabsContent>
            <TabsContent value="detail" className="mt-3">
              <CardTitle className="text-sm">解析项详情</CardTitle>
            </TabsContent>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-380px)]">
            <Tabs defaultValue="items" className="w-full">
              <TabsContent value="items" className="p-4 pt-0">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    暂无解析项
                  </div>
                ) : (
                  renderItemsList()
                )}
              </TabsContent>
              <TabsContent value="detail" className="p-4 pt-0">
                {renderDetailPanel()}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

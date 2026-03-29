'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger as _DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Minus,
  Edit,
  Check,
  ArrowRight,
  FileText,
  History,
  RotateCcw,
  Eye as _Eye,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Version {
  id: number;
  documentId: number;
  version: number;
  name: string;
  description?: string;
  createdBy: number;
  creatorName?: string;
  createdAt: string;
  totalWordCount: number;
  chapterCount: number;
}

interface CompareResult {
  documentId: number;
  version1: Version;
  version2: Version;
  summary: {
    addedChapters: number;
    removedChapters: number;
    modifiedChapters: number;
    unchangedChapters: number;
    totalWordCountDiff: number;
  };
  chapterDiffs: ChapterDiff[];
  report: string;
}

interface ChapterDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  chapterId: number;
  chapterTitle: string;
  changes: TextChange[];
  stats: {
    addedLines: number;
    removedLines: number;
    modifiedLines: number;
    wordCountDiff: number;
  };
}

interface TextChange {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber: number;
}

interface VersionCompareProps {
  documentId: number;
  onCreateVersion?: () => void;
}

export function VersionCompare({ documentId, onCreateVersion }: VersionCompareProps) {
  const _router = useRouter();
  const { toast } = useToast();
  const [versions, setVersions] = useState<Version[]>([]);
  const [version1Id, setVersion1Id] = useState<string>('');
  const [version2Id, setVersion2Id] = useState<string>('');
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  // 获取版本列表
  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const fetchVersions = async () => {
    try {
      const response = await fetch(`/api/bid/documents/${documentId}/versions`);
      const data = await response.json();
      if (response.ok) {
        setVersions(data.versions || []);
        // 默认选择最新两个版本
        if (data.versions?.length >= 2) {
          setVersion1Id(data.versions[1].id.toString());
          setVersion2Id(data.versions[0].id.toString());
        }
      }
    } catch (error) {
      console.error('Fetch versions error:', error);
    }
  };

  // 创建版本快照
  const handleCreateVersion = async () => {
    setCreating(true);
    try {
      const response = await fetch(`/api/bid/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `版本 ${versions.length + 1}`,
          description: '手动创建的版本快照',
        }),
      });

      if (response.ok) {
        toast({ title: '版本快照创建成功' });
        fetchVersions();
        onCreateVersion?.();
      }
    } catch (_error) {
      toast({ title: '创建失败', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // 对比版本
  const handleCompare = async () => {
    if (!version1Id || !version2Id || version1Id === version2Id) {
      toast({ title: '请选择两个不同的版本', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/bid/documents/versions/compare?version1=${version1Id}&version2=${version2Id}`
      );
      const data = await response.json();

      if (response.ok) {
        setCompareResult(data);
      } else {
        toast({ title: data.error || '对比失败', variant: 'destructive' });
      }
    } catch (_error) {
      toast({ title: '对比失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // 恢复版本
  const handleRestore = async (versionId: number) => {
    try {
      const response = await fetch(`/api/bid/documents/versions/${versionId}`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({ title: '已恢复到指定版本' });
        setRestoreDialogOpen(false);
        fetchVersions();
      }
    } catch (_error) {
      toast({ title: '恢复失败', variant: 'destructive' });
    }
  };

  // 获取状态图标和颜色
  const getDiffIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'removed':
        return <Minus className="h-4 w-4 text-red-600" />;
      case 'modified':
        return <Edit className="h-4 w-4 text-yellow-600" />;
      default:
        return <Check className="h-4 w-4 text-gray-400" />;
    }
  };

  const getDiffBadge = (type: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      added: { label: '新增', className: 'bg-green-100 text-green-700' },
      removed: { label: '删除', className: 'bg-red-100 text-red-700' },
      modified: { label: '修改', className: 'bg-yellow-100 text-yellow-700' },
      unchanged: { label: '未变', className: 'bg-gray-100 text-gray-600' },
    };
    const variant = variants[type];
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* 版本选择器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            版本对比
          </CardTitle>
          <CardDescription>
            选择两个版本进行对比，查看章节和内容的变化
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">版本 A</label>
              <Select value={version1Id} onValueChange={setVersion1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="选择版本" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.name} (v{v.version}) - {new Date(v.createdAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="h-5 w-5 text-muted-foreground mb-2" />

            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">版本 B</label>
              <Select value={version2Id} onValueChange={setVersion2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="选择版本" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.name} (v{v.version}) - {new Date(v.createdAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCompare} disabled={loading || !version1Id || !version2Id}>
              {loading ? '对比中...' : '开始对比'}
            </Button>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={handleCreateVersion} disabled={creating}>
              <FileText className="h-4 w-4 mr-2" />
              {creating ? '创建中...' : '创建版本快照'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 对比结果 */}
      {compareResult && (
        <>
          {/* 摘要 */}
          <Card>
            <CardHeader>
              <CardTitle>对比摘要</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {compareResult.summary.addedChapters}
                  </div>
                  <div className="text-sm text-green-700">新增章节</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {compareResult.summary.removedChapters}
                  </div>
                  <div className="text-sm text-red-700">删除章节</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {compareResult.summary.modifiedChapters}
                  </div>
                  <div className="text-sm text-yellow-700">修改章节</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">
                    {compareResult.summary.unchangedChapters}
                  </div>
                  <div className="text-sm text-gray-700">未变章节</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {compareResult.summary.totalWordCountDiff > 0 ? '+' : ''}
                    {compareResult.summary.totalWordCountDiff}
                  </div>
                  <div className="text-sm text-blue-700">字数变化</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 章节差异列表 */}
          <Card>
            <CardHeader>
              <CardTitle>章节差异详情</CardTitle>
              <CardDescription>
                从版本 {compareResult.version1.name} 到 {compareResult.version2.name} 的变化
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {compareResult.chapterDiffs.map((diff, index) => (
                    <div key={diff.chapterId}>
                      {index > 0 && <Separator className="my-4" />}
                      <div className="flex items-start gap-4">
                        <div className="mt-1">{getDiffIcon(diff.type)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{diff.chapterTitle}</span>
                            {getDiffBadge(diff.type)}
                          </div>

                          {diff.type !== 'unchanged' && (
                            <div className="text-sm text-muted-foreground mb-3">
                              <span className="text-green-600">+{diff.stats.addedLines}</span>
                              {' / '}
                              <span className="text-red-600">-{diff.stats.removedLines}</span>
                              {' 行 | '}
                              <span className={cn(
                                diff.stats.wordCountDiff > 0 ? 'text-green-600' : 'text-red-600'
                              )}>
                                字数 {diff.stats.wordCountDiff > 0 ? '+' : ''}{diff.stats.wordCountDiff}
                              </span>
                            </div>
                          )}

                          {/* 显示部分内容变更 */}
                          {diff.type === 'modified' && diff.changes.length > 0 && (
                            <div className="bg-muted rounded-md p-3 text-sm font-mono">
                              {diff.changes.slice(0, 10).map((change, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    'px-2 py-0.5',
                                    change.type === 'add' && 'bg-green-100 text-green-800',
                                    change.type === 'remove' && 'bg-red-100 text-red-800 line-through'
                                  )}
                                >
                                  <span className="text-muted-foreground mr-2">
                                    {change.lineNumber}
                                  </span>
                                  {change.content}
                                </div>
                              ))}
                              {diff.changes.length > 10 && (
                                <div className="text-muted-foreground text-center py-2">
                                  ... 还有 {diff.changes.length - 10} 行变更
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* 版本列表 */}
      <Card>
        <CardHeader>
          <CardTitle>版本历史</CardTitle>
          <CardDescription>
            文档的所有版本快照
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{version.name}</div>
                    <div className="text-sm text-muted-foreground">
                      v{version.version} · {version.chapterCount} 章 · {version.totalWordCount.toLocaleString()} 字
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedVersion(version);
                      setRestoreDialogOpen(true);
                    }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    恢复
                  </Button>
                </div>
              </div>
            ))}

            {versions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                暂无版本历史，点击"创建版本快照"保存当前文档状态
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 恢复确认对话框 */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              恢复版本确认
            </DialogTitle>
            <DialogDescription>
              您确定要恢复到 {selectedVersion?.name} 吗？
              <br />
              当前版本将被自动备份，您随时可以从备份恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => selectedVersion && handleRestore(selectedVersion.id)}>
              确认恢复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VersionCompare;

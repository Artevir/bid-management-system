'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import {
  FileJson,
  FileSpreadsheet,
  FileText,
  File,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Loader2,
  Eye,
} from 'lucide-react';

interface ExportRecord {
  id: number;
  documentId: number;
  documentName: string;
  format: string;
  status: string;
  fileSize: number | null;
  downloadUrl: string | null;
  exportedBy: string;
  exportedAt: string;
}

interface Document {
  id: number;
  name: string;
  projectName: string;
}

const FORMAT_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  json: { label: 'JSON', icon: FileJson, color: 'bg-yellow-500' },
  xlsx: { label: 'Excel', icon: FileSpreadsheet, color: 'bg-green-500' },
  docx: { label: 'Word', icon: FileText, color: 'bg-blue-500' },
  pdf: { label: 'PDF', icon: File, color: 'bg-red-500' },
  txt: { label: 'TXT', icon: FileText, color: 'bg-gray-500' },
};

export default function ExportCenterPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('docx');
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const docsRes = await fetch('/api/bid/documents?pageSize=100');
      const docsData = await docsRes.json();
      if (docsData.success) {
        setDocuments(docsData.documents || []);
      }

      // Fetch export history from audit logs
      const historyRes = await fetch('/api/audit/my-logs?action=export&pageSize=50');
      const historyData = await historyRes.json();
      if (historyData.logs) {
        const exports = historyData.logs.map((log: any) => ({
          id: log.id,
          documentId: log.resourceId || 0,
          documentName: log.description || '未知文档',
          format: 'docx',
          status: 'completed',
          fileSize: null,
          downloadUrl: null,
          exportedBy: log.username || '未知',
          exportedAt: log.createdAt,
        }));
        setExportHistory(exports);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedDocumentId || !selectedFormat) return;
    setExporting(true);
    try {
      const res = await fetch('/api/bid/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: parseInt(selectedDocumentId),
          format: selectedFormat,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const doc = documents.find((d) => d.id === parseInt(selectedDocumentId));
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc?.name || 'document'}.${selectedFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setExportDialogOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to export:', error);
      setError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const filteredHistory = exportHistory.filter((record) =>
    record.documentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return <ListStateBlock state="error" error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">导出中心</h1>
          <p className="text-muted-foreground">管理文档导出和下载记录</p>
        </div>
        <Button onClick={() => setExportDialogOpen(true)}>
          <Download className="w-4 h-4 mr-2" />
          新建导出
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总导出次数</p>
                <p className="text-2xl font-bold">{exportHistory.length}</p>
              </div>
              <Download className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日导出</p>
                <p className="text-2xl font-bold">
                  {
                    exportHistory.filter(
                      (r) => new Date(r.exportedAt).toDateString() === new Date().toDateString()
                    ).length
                  }
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">可导出文档</p>
                <p className="text-2xl font-bold">{documents.length}</p>
              </div>
              <FileText className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">成功导出</p>
                <p className="text-2xl font-bold">
                  {exportHistory.filter((r) => r.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle>导出记录</CardTitle>
          <CardDescription>最近的文档导出历史</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索导出记录..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <ListStateBlock state="empty" emptyText="暂无导出记录" />
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((record) => {
                const formatInfo = FORMAT_LABELS[record.format] || FORMAT_LABELS.docx;
                const FormatIcon = formatInfo.icon;
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${formatInfo.color}`}>
                        <FormatIcon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">{record.documentName}</p>
                        <p className="text-sm text-muted-foreground">
                          导出格式: {formatInfo.label} · 导出人: {record.exportedBy}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={record.status === 'completed' ? 'default' : 'secondary'}>
                        {record.status === 'completed' ? '成功' : '失败'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(record.exportedAt).toLocaleString()}
                      </span>
                      {record.downloadUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={record.downloadUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导出文档</DialogTitle>
            <DialogDescription>选择要导出的文档和格式</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>选择文档</Label>
              <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要导出的文档" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id.toString()}>
                      {doc.name} - {doc.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>导出格式</Label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="docx">Word (.docx)</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="txt">TXT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleExport} disabled={!selectedDocumentId || exporting}>
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              导出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

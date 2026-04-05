'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Loader2,
  Plus,
  FileText,
  Edit,
  Eye,
  Trash2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  BookOpen,
  RefreshCw,
  Wand2,
  FileCheck,
  Send,
  Check,
  XCircle,
  ArrowRight,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';

interface Document {
  id: number;
  name: string;
  status: string;
  progress: number;
  totalChapters: number;
  completedChapters: number;
  wordCount: number;
  currentApprovalLevel: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Chapter {
  id: number;
  title: string;
  type: string | null;
  content: string | null;
  level: number;
  sortOrder: number;
  isRequired: boolean;
  isCompleted: boolean;
  wordCount: number;
}

interface ApprovalFlow {
  id: number;
  level: string;
  status: string;
  assigneeId: number;
  assigneeName?: string;
  dueDate: string | null;
  createdAt: string;
  comment?: string;
}

interface KnowledgeRecommendation {
  id: number;
  title: string;
  summary: string;
  score: number;
  category?: { name: string };
}

const DOC_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-gray-500' },
  writing: { label: '编写中', color: 'bg-blue-500' },
  reviewing: { label: '审核中', color: 'bg-yellow-500' },
  approved: { label: '已通过', color: 'bg-green-500' },
  rejected: { label: '已驳回', color: 'bg-red-500' },
  published: { label: '已发布', color: 'bg-purple-500' },
};

const APPROVAL_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  first: { label: '一级审核', color: 'bg-blue-500' },
  second: { label: '二级审核', color: 'bg-purple-500' },
  third: { label: '三级审核', color: 'bg-orange-500' },
  final: { label: '终审', color: 'bg-red-500' },
};

export default function ProjectDocumentsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [approvalFlows, setApprovalFlows] = useState<ApprovalFlow[]>([]);
  const [knowledgeRecs, setKnowledgeRecs] = useState<KnowledgeRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [knowledgePanelOpen, setKnowledgePanelOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [reviewResults, setReviewResults] = useState<any>(null);
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [generationHistory, setGenerationHistory] = useState<any[]>([]);

  useEffect(() => {
    if (projectId) {
      fetchDocuments();
    }
  }, [projectId]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/bid/documents?projectId=${projectId}`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChapters = async (docId: number) => {
    try {
      const res = await fetch(`/api/bid/chapters?documentId=${docId}`);
      const data = await res.json();
      if (data.success) {
        setChapters(data.chapters || []);
      }
    } catch (error) {
      console.error('Failed to fetch chapters:', error);
    }
  };

  const fetchApprovalFlows = async (docId: number) => {
    try {
      const res = await fetch(`/api/bid/approvals?documentId=${docId}`);
      const data = await res.json();
      if (data.success) {
        setApprovalFlows(data.flows || []);
      }
    } catch (error) {
      console.error('Failed to fetch approval flows:', error);
    }
  };

  const fetchKnowledgeRecommendations = async (docId: number) => {
    try {
      const res = await fetch('/api/knowledge/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, topK: 5 }),
      });
      const data = await res.json();
      if (data.success) {
        setKnowledgeRecs(data.recommendations || []);
      }
    } catch (error) {
      console.error('Failed to fetch knowledge recommendations:', error);
    }
  };

  const handleSelectDocument = async (doc: Document) => {
    setSelectedDocument(doc);
    await Promise.all([
      fetchChapters(doc.id),
      fetchApprovalFlows(doc.id),
      fetchKnowledgeRecommendations(doc.id),
    ]);
  };

  const handleCreateDocument = async () => {
    if (!newDocName.trim()) return;
    
    try {
      const res = await fetch('/api/bid/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: parseInt(projectId),
          name: newDocName,
          templateId: selectedTemplate || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateDialogOpen(false);
        setNewDocName('');
        fetchDocuments();
      }
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  };

  const handleGenerateChapter = async (chapterId: number) => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/bid/generate?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          style: 'formal',
          useKnowledge: true,
        }),
      });
      
      if (res.ok) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let content = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            content += text;
          }
        }
        
        await fetch('/api/bid/generate?action=accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapterId, content }),
        });
        
        fetchChapters(selectedDocument!.id);
      }
    } catch (error) {
      console.error('Failed to generate content:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleOneClickGenerate = async () => {
    if (!selectedDocument) return;
    setGenerating(true);
    try {
      await fetch('/api/bid/documents/one-click-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selectedDocument.id }),
      });
      fetchChapters(selectedDocument.id);
    } catch (error) {
      console.error('Failed to generate document:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!selectedDocument) return;
    try {
      const res = await fetch('/api/bid/approvals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selectedDocument.id }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitDialogOpen(false);
        fetchApprovalFlows(selectedDocument.id);
        fetchDocuments();
      }
    } catch (error) {
      console.error('Failed to submit for approval:', error);
    }
  };

  const handleApprove = async () => {
    if (!selectedDocument) return;
    try {
      const res = await fetch('/api/bid/approvals/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          action: 'approve',
          comment: approveComment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setApproveDialogOpen(false);
        setApproveComment('');
        fetchApprovalFlows(selectedDocument.id);
        fetchDocuments();
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async () => {
    if (!selectedDocument) return;
    try {
      const res = await fetch('/api/bid/approvals/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          action: 'reject',
          comment: approveComment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setApproveDialogOpen(false);
        setApproveComment('');
        fetchApprovalFlows(selectedDocument.id);
        fetchDocuments();
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const handleReview = async (documentId: number) => {
    setGenerating(true);
    try {
      const res = await fetch('/api/bid/review?stream=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          types: ['compliance', 'format', 'content', 'completeness'],
        }),
      });
      
      if (res.ok) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullResult = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            fullResult += text;
          }
        }
        
        try {
          const data = JSON.parse(fullResult);
          setReviewResults(data);
          setReviewPanelOpen(true);
        } catch {
          setReviewResults({ message: fullResult, error: false });
          setReviewPanelOpen(true);
        }
      }
    } catch (error) {
      console.error('Failed to review document:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (documentId: number, format: string) => {
    setGenerating(true);
    try {
      const res = await fetch('/api/bid/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, format }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedDocument?.name || 'document'}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export document:', error);
    } finally {
      setGenerating(false);
    }
  };

  const fetchHistory = async (documentId: number) => {
    try {
      const res = await fetch(`/api/bid/documents/generation-history?documentId=${documentId}`);
      const data = await res.json();
      if (data.success) {
        setGenerationHistory(data.history || []);
        setHistoryOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const getApprovalAction = () => {
    if (!selectedDocument) return null;
    const pendingFlow = approvalFlows.find(f => f.status === 'pending');
    if (!pendingFlow) return null;
    return pendingFlow;
  };

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
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">投标文档</h1>
            <p className="text-muted-foreground">管理项目的投标文档和章节内容</p>
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          新建文档
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">文档列表</CardTitle>
              <CardDescription>共 {documents.length} 个文档</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  暂无文档，请创建新文档
                </p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDocument(doc)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDocument?.id === doc.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium truncate">{doc.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          DOC_STATUS_LABELS[doc.status]?.color || 'bg-gray-500'
                        }`}
                      >
                        {DOC_STATUS_LABELS[doc.status]?.label || doc.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>章节进度</span>
                        <span>{doc.completedChapters}/{doc.totalChapters}</span>
                      </div>
                      <Progress value={doc.progress} className="h-1" />
                      {doc.currentApprovalLevel && (
                        <div className="flex justify-between mt-1">
                          <span>审核状态</span>
                          <Badge variant="outline" className="text-xs">
                            {APPROVAL_LEVEL_LABELS[doc.currentApprovalLevel]?.label || doc.currentApprovalLevel}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Document Detail */}
        <div className="lg:col-span-2">
          {selectedDocument ? (
            <div className="space-y-4">
              {/* Actions */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-medium">{selectedDocument.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedDocument.completedChapters}/{selectedDocument.totalChapters} 章节已完成
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setKnowledgePanelOpen(true)}
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        知识推荐
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReview(selectedDocument.id)}
                        disabled={generating}
                      >
                        {generating ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <FileCheck className="w-4 h-4 mr-1" />
                        )}
                        AI审校
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOneClickGenerate}
                        disabled={generating}
                      >
                        {generating ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4 mr-1" />
                        )}
                        AI生成
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport(selectedDocument.id, 'docx')}
                        disabled={generating}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        导出
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchHistory(selectedDocument.id)}
                        disabled={generating}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        历史
                      </Button>
                      {selectedDocument.status === 'writing' && (
                        <Button
                          size="sm"
                          onClick={() => setSubmitDialogOpen(true)}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          提交审核
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Approval Flow Status */}
              {approvalFlows.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      审核流程
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {['first', 'second', 'third', 'final'].map((level, idx) => {
                        const flow = approvalFlows.find(f => f.level === level);
                        return (
                          <div key={level} className="flex items-center">
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                              flow?.status === 'approved' ? 'border-green-500 bg-green-50' :
                              flow?.status === 'rejected' ? 'border-red-500 bg-red-50' :
                              flow?.status === 'pending' ? 'border-yellow-500 bg-yellow-50' :
                              'border-muted bg-muted/30'
                            }`}>
                              {flow?.status === 'approved' ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : flow?.status === 'rejected' ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : flow?.status === 'pending' ? (
                                <Clock className="w-4 h-4 text-yellow-500" />
                              ) : (
                                <Clock className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span className="text-sm whitespace-nowrap">
                                {APPROVAL_LEVEL_LABELS[level]?.label || level}
                              </span>
                            </div>
                            {idx < 3 && <ArrowRight className="w-4 h-4 text-muted-foreground mx-1" />}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Approval Actions */}
                    {getApprovalAction() && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm mb-2">当前待您审核</p>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setApproveDialogOpen(true)}>
                            <Check className="w-4 h-4 mr-1" />
                            审核
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Chapters */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">章节结构</CardTitle>
                  <CardDescription>共 {chapters.length} 个章节</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {chapters.map((chapter) => (
                        <div
                          key={chapter.id}
                          className={`p-3 rounded-lg border ${
                            chapter.isCompleted
                              ? 'border-green-200 bg-green-50/50'
                              : 'border-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {chapter.isCompleted ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <Clock className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span className="font-medium">
                                {chapter.sortOrder}. {chapter.title}
                              </span>
                              {chapter.isRequired && (
                                <Badge variant="outline" className="text-xs">必填</Badge>
                              )}
                              {chapter.type && (
                                <Badge variant="secondary" className="text-xs">
                                  {chapter.type}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {chapter.wordCount} 字
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleGenerateChapter(chapter.id)}
                                disabled={generating}
                              >
                                <Sparkles className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {chapter.content && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {chapter.content.slice(0, 150)}...
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">请选择左侧文档查看详情</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Knowledge Panel */}
      <Dialog open={knowledgePanelOpen} onOpenChange={setKnowledgePanelOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>知识推荐</DialogTitle>
            <DialogDescription>根据当前文档内容推荐的相关知识条目</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {knowledgeRecs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无推荐知识</p>
            ) : (
              knowledgeRecs.map((rec) => (
                <div key={rec.id} className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{rec.title}</span>
                    <Badge variant="outline" className="text-xs">
                      相似度: {Math.round(rec.score * 100)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{rec.summary}</p>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKnowledgePanelOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit for Approval Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提交审核</DialogTitle>
            <DialogDescription>确认提交文档进入审核流程</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>确定要将「{selectedDocument?.name}」提交审核吗？</p>
            <p className="text-sm text-muted-foreground mt-2">提交后将进入一级审核流程</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmitForApproval}>确认提交</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审核文档</DialogTitle>
            <DialogDescription>请选择审核结果并填写意见</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>审核意见</Label>
              <Textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="请输入审核意见（可选）"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={handleReject}>
              <XCircle className="w-4 h-4 mr-1" />
              驳回
            </Button>
            <Button onClick={handleApprove}>
              <Check className="w-4 h-4 mr-1" />
              通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Results Dialog */}
      <Dialog open={reviewPanelOpen} onOpenChange={setReviewPanelOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI审校结果</DialogTitle>
            <DialogDescription>智能审校检测到的问题和建议</DialogDescription>
          </DialogHeader>
          {reviewResults ? (
            <div className="space-y-4">
              {reviewResults.statistics && (
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{reviewResults.score || 0}</p>
                    <p className="text-xs text-muted-foreground">得分</p>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-medium text-red-500">{reviewResults.statistics.errors || 0}</p>
                      <p className="text-xs text-muted-foreground">错误</p>
                    </div>
                    <div>
                      <p className="text-lg font-medium text-yellow-500">{reviewResults.statistics.warnings || 0}</p>
                      <p className="text-xs text-muted-foreground">警告</p>
                    </div>
                    <div>
                      <p className="text-lg font-medium text-blue-500">{reviewResults.statistics.infos || 0}</p>
                      <p className="text-xs text-muted-foreground">提示</p>
                    </div>
                    <div>
                      <p className="text-lg font-medium">{reviewResults.statistics.total || 0}</p>
                      <p className="text-xs text-muted-foreground">总计</p>
                    </div>
                  </div>
                </div>
              )}
              {reviewResults.issues && reviewResults.issues.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {reviewResults.issues.map((issue: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded-lg border-l-4 ${
                      issue.type === 'error' ? 'border-red-500 bg-red-50' :
                      issue.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                      'border-blue-500 bg-blue-50'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{issue.severity === 'critical' ? '严重' : issue.severity === 'major' ? '重要' : '一般'}</span>
                        <Badge variant={issue.severity === 'critical' ? 'destructive' : 'outline'}>{issue.type}</Badge>
                      </div>
                      <p className="text-sm">{issue.message}</p>
                      {issue.suggestion && <p className="text-sm text-muted-foreground mt-1">建议: {issue.suggestion}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewPanelOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generation History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>生成历史</DialogTitle>
            <DialogDescription>文档的AI生成历史记录</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {generationHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无生成历史</p>
            ) : (
              generationHistory.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{item.chapterTitle || `章节 #${item.chapterId}`}</span>
                    <Badge variant={item.isAccepted ? 'default' : 'outline'}>
                      {item.isAccepted ? '已采纳' : '未采纳'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">生成时间: {new Date(item.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">模型: {item.model}</p>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Document Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建投标文档</DialogTitle>
            <DialogDescription>创建一个新的投标文档，可以选择模板</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="docName">文档名称</Label>
              <Input
                id="docName"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="请输入文档名称"
              />
            </div>
            <div>
              <Label htmlFor="template">选择模板（可选）</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="不选择模板" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不选择模板</SelectItem>
                  <SelectItem value="1">技术方案模板</SelectItem>
                  <SelectItem value="2">商务方案模板</SelectItem>
                  <SelectItem value="3">综合标书模板</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateDocument} disabled={!newDocName.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
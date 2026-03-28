'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
  DollarSign,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Plus,
  Trash2,
  Building2,
  Users,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

const OPENING_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待开标', color: 'yellow' },
  opened: { label: '已开标', color: 'blue' },
  cancelled: { label: '已废标', color: 'red' },
  postponed: { label: '已延期', color: 'orange' },
};

const BIDDER_TYPES: Record<string, string> = {
  us: '我方',
  competitor: '竞争对手',
  unknown: '未知',
};

interface BidOpening {
  id: number;
  projectId: number;
  projectName: string;
  tenderCode: string | null;
  openingDate: string;
  openingLocation: string | null;
  ourBidPrice: string | null;
  ourScore: string | null;
  status: string;
  winnerName: string | null;
  winnerPrice: string | null;
  budgetPrice: string | null;
  analysis: string | null;
  lessonsLearned: string | null;
  photos: string | null;
  attachments: string | null;
  participants: string | null;
  notes: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

interface OpeningQuote {
  id: number;
  openingId: number;
  bidderName: string;
  bidderType: string;
  competitorId: number | null;
  bidPrice: string;
  score: string | null;
  rank: number | null;
  isWinner: boolean;
  notes: string | null;
  createdAt: string;
}

interface Competitor {
  id: number;
  name: string;
}

export default function OpeningDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [opening, setOpening] = useState<BidOpening | null>(null);
  const [quotes, setQuotes] = useState<OpeningQuote[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 添加报价对话框
  const [addQuoteDialogOpen, setAddQuoteDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [quoteFormData, setQuoteFormData] = useState({
    bidderName: '',
    bidderType: 'unknown',
    competitorId: '',
    bidPrice: '',
    score: '',
    rank: '',
    isWinner: false,
    notes: '',
  });

  useEffect(() => {
    if (params.id) {
      fetchOpening();
      fetchQuotes();
      fetchCompetitors();
    }
  }, [params.id]);

  const fetchOpening = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/openings/${params.id}`);
      if (!res.ok) {
        throw new Error('获取开标记录失败');
      }
      const data = await res.json();
      setOpening(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取开标记录失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotes = async () => {
    try {
      const res = await fetch(`/api/openings/${params.id}/quotes`);
      if (res.ok) {
        const data = await res.json();
        setQuotes(data || []);
      }
    } catch (err) {
      console.error('Fetch quotes error:', err);
    }
  };

  const fetchCompetitors = async () => {
    try {
      const res = await fetch('/api/competitors');
      if (res.ok) {
        const data = await res.json();
        setCompetitors(data.data || []);
      }
    } catch (err) {
      console.error('Fetch competitors error:', err);
    }
  };

  const handleAddQuote = async () => {
    if (!quoteFormData.bidderName) {
      setError('请输入投标方名称');
      return;
    }
    if (!quoteFormData.bidPrice) {
      setError('请输入报价金额');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/openings/${params.id}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidderName: quoteFormData.bidderName,
          bidderType: quoteFormData.bidderType,
          competitorId: quoteFormData.competitorId ? parseInt(quoteFormData.competitorId) : null,
          bidPrice: quoteFormData.bidPrice,
          score: quoteFormData.score || null,
          rank: quoteFormData.rank ? parseInt(quoteFormData.rank) : null,
          isWinner: quoteFormData.isWinner,
          notes: quoteFormData.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '添加报价失败');
      }

      setAddQuoteDialogOpen(false);
      resetQuoteForm();
      fetchQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加报价失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuote = async (quoteId: number) => {
    if (!confirm('确定要删除这条报价记录吗？')) return;

    try {
      const res = await fetch(`/api/openings/${params.id}/quotes/${quoteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('删除报价失败');
      }

      fetchQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除报价失败');
    }
  };

  const resetQuoteForm = () => {
    setQuoteFormData({
      bidderName: '',
      bidderType: 'unknown',
      competitorId: '',
      bidPrice: '',
      score: '',
      rank: '',
      isWinner: false,
      notes: '',
    });
    setError('');
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = OPENING_STATUS[status];
    const colorMap: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      blue: 'bg-blue-100 text-blue-800',
      red: 'bg-red-100 text-red-800',
      orange: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colorMap[statusInfo?.color || 'yellow']}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!opening) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>开标记录不存在</AlertDescription>
        </Alert>
      </div>
    );
  }

  // 计算排名排序后的报价
  const sortedQuotes = [...quotes].sort((a, b) => {
    if (a.isWinner) return -1;
    if (b.isWinner) return 1;
    const priceA = parseFloat(a.bidPrice) || 0;
    const priceB = parseFloat(b.bidPrice) || 0;
    return priceA - priceB;
  });

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/openings')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/projects/${opening.projectId}`)}>
            <Building2 className="mr-2 h-4 w-4" />
            查看项目
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 基本信息 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    开标记录
                  </CardTitle>
                  <CardDescription>记录ID: {opening.id}</CardDescription>
                </div>
                {getStatusBadge(opening.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">项目名称</div>
                <div className="font-medium">{opening.projectName}</div>
              </div>

              {opening.tenderCode && (
                <div>
                  <div className="text-sm text-muted-foreground">招标编号</div>
                  <div className="font-medium">{opening.tenderCode}</div>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">开标日期</div>
                  <div className="font-medium">{formatDate(opening.openingDate)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">开标地点</div>
                  <div className="font-medium">{opening.openingLocation || '-'}</div>
                </div>
              </div>

              <Separator />

              <div>
                <div className="text-sm text-muted-foreground">我方报价</div>
                <div className="text-xl font-bold text-primary">
                  {opening.ourBidPrice
                    ? formatCurrency(parseFloat(opening.ourBidPrice))
                    : '-'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">我方得分</div>
                  <div className="font-medium">{opening.ourScore || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">预算金额</div>
                  <div className="font-medium">
                    {opening.budgetPrice
                      ? formatCurrency(parseFloat(opening.budgetPrice))
                      : '-'}
                  </div>
                </div>
              </div>

              <Separator />

              {opening.winnerName && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 flex items-center gap-1">
                    <Trophy className="h-4 w-4" />
                    中标方
                  </div>
                  <div className="font-bold text-green-700">{opening.winnerName}</div>
                  {opening.winnerPrice && (
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(parseFloat(opening.winnerPrice))}
                    </div>
                  )}
                </div>
              )}

              {opening.participants && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      参与人员
                    </div>
                    <div className="text-sm mt-1">{opening.participants}</div>
                  </div>
                </>
              )}

              {opening.notes && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">备注</div>
                    <div className="text-sm mt-1 whitespace-pre-wrap">{opening.notes}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 分析总结 */}
          {(opening.analysis || opening.lessonsLearned) && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>分析总结</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {opening.analysis && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">分析报告</div>
                    <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
                      {opening.analysis}
                    </div>
                  </div>
                )}
                {opening.lessonsLearned && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">经验教训</div>
                    <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
                      {opening.lessonsLearned}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 报价对比 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    报价对比
                  </CardTitle>
                  <CardDescription>共 {quotes.length} 家投标单位</CardDescription>
                </div>
                <Button onClick={() => setAddQuoteDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加报价
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无报价记录</p>
                  <Button variant="outline" className="mt-4" onClick={() => setAddQuoteDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    添加报价
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>排名</TableHead>
                      <TableHead>投标方</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>报价</TableHead>
                      <TableHead>得分</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedQuotes.map((quote, index) => (
                      <TableRow key={quote.id} className={quote.isWinner ? 'bg-green-50' : ''}>
                        <TableCell>
                          {quote.isWinner ? (
                            <Trophy className="h-5 w-5 text-green-600" />
                          ) : (
                            <span className="text-muted-foreground">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{quote.bidderName}</TableCell>
                        <TableCell>
                          <Badge variant={quote.bidderType === 'us' ? 'default' : 'outline'}>
                            {BIDDER_TYPES[quote.bidderType] || quote.bidderType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(parseFloat(quote.bidPrice))}
                        </TableCell>
                        <TableCell>{quote.score || '-'}</TableCell>
                        <TableCell>
                          {quote.isWinner ? (
                            <Badge className="bg-green-100 text-green-800">中标</Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteQuote(quote.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* 价格对比分析 */}
              {quotes.length > 1 && opening.ourBidPrice && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-3">价格分析</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">最低报价</div>
                      <div className="font-bold text-green-600">
                        {formatCurrency(Math.min(...quotes.map(q => parseFloat(q.bidPrice) || 0)))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">最高报价</div>
                      <div className="font-bold text-red-600">
                        {formatCurrency(Math.max(...quotes.map(q => parseFloat(q.bidPrice) || 0)))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">平均报价</div>
                      <div className="font-bold">
                        {formatCurrency(
                          quotes.reduce((sum, q) => sum + (parseFloat(q.bidPrice) || 0), 0) / quotes.length
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 添加报价对话框 */}
      <Dialog open={addQuoteDialogOpen} onOpenChange={setAddQuoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加报价记录</DialogTitle>
            <DialogDescription>录入投标单位的报价信息</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="bidderName">投标方名称 *</Label>
              <Input
                id="bidderName"
                value={quoteFormData.bidderName}
                onChange={(e) => setQuoteFormData({ ...quoteFormData, bidderName: e.target.value })}
                placeholder="请输入投标方名称"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bidderType">投标方类型</Label>
                <Select
                  value={quoteFormData.bidderType}
                  onValueChange={(value) => setQuoteFormData({ ...quoteFormData, bidderType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us">我方</SelectItem>
                    <SelectItem value="competitor">竞争对手</SelectItem>
                    <SelectItem value="unknown">未知</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {quoteFormData.bidderType === 'competitor' && (
                <div className="space-y-2">
                  <Label htmlFor="competitor">关联竞争对手</Label>
                  <Select
                    value={quoteFormData.competitorId}
                    onValueChange={(value) => setQuoteFormData({ ...quoteFormData, competitorId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择竞争对手" />
                    </SelectTrigger>
                    <SelectContent>
                      {competitors.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bidPrice">报价金额 *</Label>
                <Input
                  id="bidPrice"
                  type="number"
                  value={quoteFormData.bidPrice}
                  onChange={(e) => setQuoteFormData({ ...quoteFormData, bidPrice: e.target.value })}
                  placeholder="报价金额"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="score">得分</Label>
                <Input
                  id="score"
                  value={quoteFormData.score}
                  onChange={(e) => setQuoteFormData({ ...quoteFormData, score: e.target.value })}
                  placeholder="综合评分"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rank">排名</Label>
              <Input
                id="rank"
                type="number"
                value={quoteFormData.rank}
                onChange={(e) => setQuoteFormData({ ...quoteFormData, rank: e.target.value })}
                placeholder="排名"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isWinner"
                checked={quoteFormData.isWinner}
                onChange={(e) => setQuoteFormData({ ...quoteFormData, isWinner: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isWinner" className="cursor-pointer">
                标记为中标方
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                value={quoteFormData.notes}
                onChange={(e) => setQuoteFormData({ ...quoteFormData, notes: e.target.value })}
                placeholder="备注信息"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddQuoteDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddQuote} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

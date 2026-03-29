'use client';

import { useState, useEffect as _useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton as _Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs as _Tabs, TabsContent as _TabsContent, TabsList as _TabsList, TabsTrigger as _TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Calculator,
  TrendingUp,
  TrendingDown as _TrendingDown,
  Target,
  AlertTriangle,
  Info,
  CheckCircle,
  Users,
  DollarSign as _DollarSign,
  BarChart3,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';

// ============================================
// 类型定义
// ============================================

interface QuoteRecommendation {
  type: 'range' | 'strategy' | 'warning' | 'info';
  title: string;
  content: string;
  details?: {
    min: number;
    max: number;
    recommended: number;
  };
  confidence?: 'high' | 'medium' | 'low';
  severity?: 'low' | 'medium' | 'high';
}

interface QuoteAnalysis {
  hasEnoughData: boolean;
  message?: string;
  stats?: {
    avgWinningQuote: number;
    avgBudgetRatio: number;
    predictedWinningQuote: number;
    optimalRange: {
      min: number;
      max: number;
      recommended: number;
    };
    sampleSize: number;
    historicalWins: number;
    historicalLosses: number;
  };
  recommendations: QuoteRecommendation[];
  competitorAnalysis?: {
    topCompetitors: Array<{
      id: number;
      name: string;
      winRate: number;
      totalBids: number;
      strength: string;
    }>;
    warning: string | null;
  } | null;
  dataPoints?: number;
}

export default function QuoteAnalysisPage() {
  const [budget, setBudget] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [projectType, setProjectType] = useState('');
  const [analysis, setAnalysis] = useState<QuoteAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 行业和地区选项
  const industries = [
    '建筑施工', '市政工程', '交通运输', '水利水务', '电力能源',
    '信息化', '环保工程', '医疗健康', '教育文化', '其他'
  ];
  
  const regions = [
    '北京', '上海', '广东', '江苏', '浙江', '山东', '四川', '湖北',
    '河南', '福建', '广西', '云南', '其他'
  ];

  const projectTypes = [
    '工程类', '服务类', '货物类', '综合类'
  ];

  async function handleAnalyze() {
    if (!budget || parseFloat(budget) <= 0) {
      setError('请输入有效的预算金额');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        budget: budget,
        ...(industry && { industry }),
        ...(region && { region }),
        ...(projectType && { projectType }),
      });

      const response = await fetch(`/api/quotes/analyze?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '分析失败');
      }

      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message || '分析过程中发生错误');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getConfidenceBadge = (confidence?: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <Badge className="bg-green-500">高置信度</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">中置信度</Badge>;
      case 'low':
        return <Badge variant="secondary">低置信度</Badge>;
      default:
        return null;
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'range':
        return <Target className="h-5 w-5 text-blue-500" />;
      case 'strategy':
        return <Lightbulb className="h-5 w-5 text-yellow-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-400" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">智能报价分析</h1>
          <p className="text-muted-foreground">基于历史数据，为您提供科学的报价建议</p>
        </div>
      </div>

      {/* 输入表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            分析参数
          </CardTitle>
          <CardDescription>输入项目信息，获取智能报价建议</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="budget">预算金额 (必填) *</Label>
              <Input
                id="budget"
                type="number"
                placeholder="请输入预算金额"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>行业</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="选择行业" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>地区</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger>
                  <SelectValue placeholder="选择地区" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((reg) => (
                    <SelectItem key={reg} value={reg}>
                      {reg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>项目类型</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  开始分析
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => {
              setBudget('');
              setIndustry('');
              setRegion('');
              setProjectType('');
              setAnalysis(null);
              setError(null);
            }}>
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>分析失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 分析结果 */}
      {analysis && (
        <div className="space-y-6">
          {/* 数据概览 */}
          {analysis.stats && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">预测中标价</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(analysis.stats.predictedWinningQuote)}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">平均中标比例</p>
                      <p className="text-2xl font-bold text-green-600">
                        {analysis.stats.avgBudgetRatio.toFixed(1)}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">历史中标</p>
                      <p className="text-2xl font-bold">
                        {analysis.stats.historicalWins} / {analysis.stats.historicalWins + analysis.stats.historicalLosses}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">样本数量</p>
                      <p className="text-2xl font-bold">{analysis.dataPoints}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 报价建议 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                报价建议
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!analysis.hasEnoughData && (
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertTitle>提示</AlertTitle>
                  <AlertDescription>{analysis.message}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-4">
                {analysis.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      rec.type === 'warning'
                        ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20'
                        : rec.type === 'info'
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20'
                        : 'bg-gray-50 border-gray-200 dark:bg-gray-950/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getRecommendationIcon(rec.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{rec.title}</h4>
                          {rec.confidence && getConfidenceBadge(rec.confidence)}
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.content}</p>
                        {rec.details && (
                          <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border">
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <p className="text-xs text-muted-foreground">最低建议</p>
                                <p className="font-medium text-green-600">
                                  {formatCurrency(rec.details.min)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">推荐报价</p>
                                <p className="font-bold text-blue-600 text-lg">
                                  {formatCurrency(rec.details.recommended)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">最高建议</p>
                                <p className="font-medium text-orange-600">
                                  {formatCurrency(rec.details.max)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 竞争对手分析 */}
          {analysis.competitorAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  竞争对手分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.competitorAnalysis.warning && (
                  <Alert className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {analysis.competitorAnalysis.warning}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-3">
                  {analysis.competitorAnalysis.topCompetitors.map((competitor) => (
                    <div
                      key={competitor.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{competitor.name}</p>
                          <p className="text-xs text-muted-foreground">
                            投标 {competitor.totalBids} 次
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">中标率</p>
                          <p className="font-bold">
                            {(competitor.winRate * 100).toFixed(1)}%
                          </p>
                        </div>
                        <Badge
                          variant={
                            competitor.strength === 'strong'
                              ? 'destructive'
                              : competitor.strength === 'medium'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {competitor.strength === 'strong'
                            ? '强势'
                            : competitor.strength === 'medium'
                            ? '中等'
                            : '一般'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

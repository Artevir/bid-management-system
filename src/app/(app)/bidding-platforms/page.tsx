'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ListStateBlock } from '@/components/ui/list-states';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea as _Textarea } from '@/components/ui/textarea';
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  Search,
  RefreshCw,
  Plus,
  ExternalLink,
  Navigation,
  CheckCircle,
  XCircle,
  Eye,
  Edit as _Edit,
} from 'lucide-react';
import Link from 'next/link';

// 类型定义
type PlatformType =
  | 'provincial_official'
  | 'provincial_cloud'
  | 'state_owned'
  | 'city_center'
  | 'agent_company';
type PlatformStatus = 'active' | 'inactive' | 'maintenance';

interface Platform {
  id: number;
  name: string;
  shortName: string | null;
  type: PlatformType;
  status: PlatformStatus;
  address: string;
  phone: string | null;
  website: string | null;
  latitude: string | null;
  longitude: string | null;
  coordinatePrecision: string | null;
  supportOnlineBid: boolean;
  supportCaLogin: boolean;
  supportLiveStream: boolean;
  features: string | null;
  remarks: string | null;
  verificationSource: string | null;
  sortOrder: number;
  bidCount: number;
  winCount: number;
  createdAt: string;
  updatedAt: string;
}

// 类型配置
const TYPE_CONFIG: Record<PlatformType, { label: string; color: string }> = {
  provincial_official: { label: '区级官方平台', color: 'bg-red-100 text-red-700' },
  provincial_cloud: { label: '区级政府采购云', color: 'bg-orange-100 text-orange-700' },
  state_owned: { label: '国企采购平台', color: 'bg-purple-100 text-purple-700' },
  city_center: { label: '地市交易中心', color: 'bg-blue-100 text-blue-700' },
  agent_company: { label: '招标代理公司', color: 'bg-green-100 text-green-700' },
};

// 状态配置
const STATUS_CONFIG: Record<PlatformStatus, { label: string; color: string }> = {
  active: { label: '正常对接', color: 'bg-green-100 text-green-700' },
  inactive: { label: '暂停对接', color: 'bg-gray-100 text-gray-700' },
  maintenance: { label: '维护中', color: 'bg-yellow-100 text-yellow-700' },
};

export default function BiddingPlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [typeStats, setTypeStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 详情弹窗
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  // 初始化弹窗
  const [initDialogOpen, setInitDialogOpen] = useState(false);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    fetchPlatforms();
  }, []);

  async function fetchPlatforms() {
    setLoading(true);
    try {
      const response = await fetch('/api/bidding-platforms');
      const data = await response.json();
      if (data.success) {
        setPlatforms(data.platforms);
        setTypeStats(data.typeStats);
      }
    } catch (error) {
      console.error('Failed to fetch platforms:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInitialize() {
    setInitializing(true);
    try {
      const response = await fetch('/api/bidding-platforms/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        fetchPlatforms();
      } else {
        alert(data.error || '初始化失败');
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
      alert('初始化失败');
    } finally {
      setInitializing(false);
      setInitDialogOpen(false);
    }
  }

  // 筛选数据
  const filteredPlatforms = platforms.filter((p) => {
    if (filterType !== 'all' && p.type !== filterType) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      return (
        p.name.toLowerCase().includes(keyword) ||
        p.shortName?.toLowerCase().includes(keyword) ||
        p.address.toLowerCase().includes(keyword)
      );
    }
    return true;
  });

  function openDetail(platform: Platform) {
    setSelectedPlatform(platform);
    setDetailDialogOpen(true);
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">政采对接单位</h1>
          <p className="text-muted-foreground">
            广西政府采购平台、公共资源交易中心及招标代理公司管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setInitDialogOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            初始化数据
          </Button>
          <Link href="/bidding-platforms/map">
            <Button variant="outline">
              <MapPin className="mr-2 h-4 w-4" />
              地图视图
            </Button>
          </Link>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新增单位
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(TYPE_CONFIG).map(([type, config]) => (
          <Card
            key={type}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterType(filterType === type ? 'all' : type)}
          >
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{typeStats[type] || 0}</div>
              <div className="text-sm text-muted-foreground">{config.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索单位名称、地址..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="单位类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="对接状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <SelectItem key={status} value={status}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchPlatforms}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            单位列表 ({filteredPlatforms.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ListStateBlock state="loading" />
          ) : filteredPlatforms.length === 0 ? (
            <ListStateBlock
              state="empty"
              emptyText="暂无数据，请点击初始化数据导入广西政府采购单位"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>单位名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>联系电话</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>坐标</TableHead>
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlatforms.map((platform) => (
                  <TableRow key={platform.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{platform.name}</div>
                        {platform.shortName && (
                          <div className="text-xs text-muted-foreground">{platform.shortName}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={TYPE_CONFIG[platform.type]?.color}>
                        {TYPE_CONFIG[platform.type]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      <span title={platform.address}>{platform.address}</span>
                    </TableCell>
                    <TableCell>{platform.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[platform.status]?.color}>
                        {STATUS_CONFIG[platform.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {platform.latitude && platform.longitude ? (
                        <Badge variant="outline" className="text-green-600">
                          <Navigation className="mr-1 h-3 w-3" />
                          已定位
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-400">
                          未定位
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(platform)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {platform.website && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={platform.website} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPlatform?.name}</DialogTitle>
            <DialogDescription>
              {selectedPlatform?.shortName} ·{' '}
              {TYPE_CONFIG[selectedPlatform?.type || 'city_center']?.label}
            </DialogDescription>
          </DialogHeader>

          {selectedPlatform && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">详细地址</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedPlatform.address}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">联系电话</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedPlatform.phone || '-'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">官方网站</Label>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    {selectedPlatform.website ? (
                      <a
                        href={selectedPlatform.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        访问官网 <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">对接状态</Label>
                  <Badge className={STATUS_CONFIG[selectedPlatform.status]?.color}>
                    {STATUS_CONFIG[selectedPlatform.status]?.label}
                  </Badge>
                </div>
              </div>

              {/* 百度地图坐标 */}
              {selectedPlatform.latitude && selectedPlatform.longitude && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">百度地图坐标</Label>
                  <div className="bg-muted p-3 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">纬度: {selectedPlatform.latitude}</span>
                      <span className="text-sm">经度: {selectedPlatform.longitude}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      精度: {selectedPlatform.coordinatePrecision}
                    </div>
                    <div className="text-xs bg-blue-50 text-blue-700 p-2 rounded">
                      💡 调用百度地图API时需使用{' '}
                      <code className="bg-blue-100 px-1 rounded">lng, lat</code>{' '}
                      顺序（先经度后纬度）
                    </div>
                  </div>
                </div>
              )}

              {/* 功能支持 */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">功能支持</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={selectedPlatform.supportOnlineBid ? 'default' : 'outline'}
                    className={selectedPlatform.supportOnlineBid ? 'bg-green-600' : ''}
                  >
                    {selectedPlatform.supportOnlineBid ? (
                      <CheckCircle className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    在线投标
                  </Badge>
                  <Badge
                    variant={selectedPlatform.supportCaLogin ? 'default' : 'outline'}
                    className={selectedPlatform.supportCaLogin ? 'bg-green-600' : ''}
                  >
                    {selectedPlatform.supportCaLogin ? (
                      <CheckCircle className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    CA登录
                  </Badge>
                  <Badge
                    variant={selectedPlatform.supportLiveStream ? 'default' : 'outline'}
                    className={selectedPlatform.supportLiveStream ? 'bg-green-600' : ''}
                  >
                    {selectedPlatform.supportLiveStream ? (
                      <CheckCircle className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    开标直播
                  </Badge>
                </div>
              </div>

              {/* 特色功能 */}
              {selectedPlatform.features && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">特色功能</Label>
                  <div className="flex flex-wrap gap-2">
                    {JSON.parse(selectedPlatform.features).map((feature: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 备注 */}
              {selectedPlatform.remarks && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">备注</Label>
                  <p className="text-sm">{selectedPlatform.remarks}</p>
                </div>
              )}

              {/* 验证来源 */}
              {selectedPlatform.verificationSource && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">验证来源</Label>
                  <p className="text-xs text-muted-foreground">
                    {selectedPlatform.verificationSource}
                  </p>
                </div>
              )}

              {/* 统计 */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold">{selectedPlatform.bidCount}</div>
                  <div className="text-xs text-muted-foreground">投标项目</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{selectedPlatform.winCount}</div>
                  <div className="text-xs text-muted-foreground">中标项目</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
            <Link href={`/bidding-platforms/map?platform=${selectedPlatform?.id}`}>
              <Button>
                <Navigation className="mr-2 h-4 w-4" />
                查看地图
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 初始化弹窗 */}
      <Dialog open={initDialogOpen} onOpenChange={setInitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>初始化政采单位数据</DialogTitle>
            <DialogDescription>
              将从文档导入广西政府采购单位、公共资源交易中心及招标代理公司的数据，包括地址和百度地图坐标。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="font-medium">将导入以下数据：</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 区级官方平台：3 家</li>
                <li>• 地市交易中心：14 家</li>
                <li>• 招标代理公司：10 家</li>
              </ul>
              <div className="text-xs text-blue-600">已有数据将跳过，不会重复导入</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInitDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleInitialize} disabled={initializing}>
              {initializing ? '初始化中...' : '开始初始化'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

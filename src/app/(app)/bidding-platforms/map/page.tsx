'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ListStateBlock } from '@/components/ui/list-states';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  MapPin,
  Phone,
  Globe,
  ExternalLink,
  CheckCircle,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Link from 'next/link';

type PlatformType =
  | 'provincial_official'
  | 'provincial_cloud'
  | 'state_owned'
  | 'city_center'
  | 'agent_company';

interface Marker {
  id: number;
  name: string;
  shortName: string | null;
  type: PlatformType;
  address: string;
  phone: string | null;
  website: string | null;
  position: { lat: number; lng: number };
  coordinatePrecision: string | null;
  features: { supportOnlineBid: boolean; supportCaLogin: boolean; supportLiveStream: boolean };
}

interface MapData {
  mapConfig: { ak: string; center: { latitude: number; longitude: number }; zoom: number };
  markers: Marker[];
  typeStats: Record<string, number>;
}

const TYPE_CONFIG: Record<PlatformType, { label: string; color: string; iconColor: string }> = {
  provincial_official: {
    label: '区级官方平台',
    color: 'bg-red-100 text-red-700',
    iconColor: '#ef4444',
  },
  provincial_cloud: {
    label: '区级政府采购云',
    color: 'bg-orange-100 text-orange-700',
    iconColor: '#f97316',
  },
  state_owned: {
    label: '国企采购平台',
    color: 'bg-purple-100 text-purple-700',
    iconColor: '#a855f7',
  },
  city_center: { label: '地市交易中心', color: 'bg-blue-100 text-blue-700', iconColor: '#3b82f6' },
  agent_company: {
    label: '招标代理公司',
    color: 'bg-green-100 text-green-700',
    iconColor: '#22c55e',
  },
};

export default function BiddingPlatformsMapPage() {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetch('/api/bidding-platforms/map-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setMapData(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredMarkers =
    mapData?.markers.filter((m) => filterType === 'all' || m.type === filterType) || [];

  if (error) {
    return <ListStateBlock state="error" error={error} onRetry={() => window.location.reload()} />;
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">政采单位地图</h1>
          <p className="text-muted-foreground">广西政府采购单位百度地图坐标定位</p>
        </div>
        <Link href="/bidding-platforms">
          <Button variant="outline">
            <MapPin className="mr-2 h-4 w-4" />
            返回列表
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="单位类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部 ({mapData?.markers.length || 0})</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([type, config]) => (
              <SelectItem key={type} value={type}>
                {config.label} ({mapData?.typeStats[type] || 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TYPE_CONFIG).map(([type, config]) => (
            <div key={type} className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.iconColor }} />
              <span className="text-muted-foreground">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3 overflow-hidden">
          <CardContent className="p-0 relative">
            <div className="h-[600px] w-full relative bg-gradient-to-br from-blue-50 to-green-50">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <MapPin className="h-16 w-16 text-blue-400 mx-auto" />
                  <div className="text-lg font-medium text-muted-foreground">百度地图展示区</div>
                  <div className="text-sm text-muted-foreground">
                    配置 BAIDU_MAP_AK 环境变量以启用真实地图
                  </div>
                </div>
              </div>
              {filteredMarkers.slice(0, 20).map((marker, index) => {
                const row = Math.floor(index / 5);
                const col = index % 5;
                return (
                  <div
                    key={marker.id}
                    className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-full group"
                    style={{ left: `${10 + col * 18}%`, top: `${15 + row * 15}%` }}
                    onClick={() => {
                      setSelectedMarker(marker);
                      setDetailDialogOpen(true);
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                      style={{ backgroundColor: TYPE_CONFIG[marker.type]?.iconColor }}
                    >
                      <MapPin className="h-3 w-3 text-white" />
                    </div>
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded shadow-lg p-2 w-48 z-10">
                      <div className="text-xs font-medium truncate">{marker.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{marker.address}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button variant="secondary" size="sm">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm">
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 h-[600px] overflow-hidden">
          <CardContent className="p-4 h-full overflow-y-auto">
            <div className="font-medium text-sm text-muted-foreground mb-4">
              单位列表 ({filteredMarkers.length})
            </div>
            <div className="space-y-2">
              {filteredMarkers.map((marker) => (
                <div
                  key={marker.id}
                  className="p-3 rounded-lg border hover:bg-muted cursor-pointer"
                  onClick={() => {
                    setSelectedMarker(marker);
                    setDetailDialogOpen(true);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: TYPE_CONFIG[marker.type]?.iconColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{marker.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{marker.address}</div>
                      <Badge variant="outline" className="text-xs mt-1">
                        {TYPE_CONFIG[marker.type]?.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="font-medium text-blue-800">百度地图API对接说明</div>
            <div className="text-sm text-blue-700 space-y-1">
              <p>1. 所有坐标采用「纬度，经度」格式存储，与百度地图API标准一致</p>
              <p>
                2. 调用百度地图API时需使用{' '}
                <code className="bg-blue-100 px-1 rounded">new BMapGL.Point(lng, lat)</code> 顺序
              </p>
              <p>3. 坐标精度达到"楼层/楼栋级"，满足地图标注、导航等核心需求</p>
            </div>
            <div className="text-xs text-blue-600">
              示例：
              <code className="bg-blue-100 px-2 py-1 rounded">
                var point = new BMapGL.Point(108.327456, 22.816678);
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedMarker?.name}</DialogTitle>
            <DialogDescription>
              {selectedMarker?.shortName} ·{' '}
              {TYPE_CONFIG[selectedMarker?.type || 'city_center']?.label}
            </DialogDescription>
          </DialogHeader>
          {selectedMarker && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">详细地址</div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    {selectedMarker.address}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">联系电话</div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" />
                    {selectedMarker.phone || '-'}
                  </div>
                </div>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-xs text-muted-foreground mb-2">百度地图坐标</div>
                <div className="flex items-center justify-between text-sm">
                  <span>纬度: {selectedMarker.position.lat}</span>
                  <span>经度: {selectedMarker.position.lng}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  精度: {selectedMarker.coordinatePrecision}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={selectedMarker.features.supportOnlineBid ? 'default' : 'outline'}
                  className={selectedMarker.features.supportOnlineBid ? 'bg-green-600' : ''}
                >
                  {selectedMarker.features.supportOnlineBid ? (
                    <CheckCircle className="mr-1 h-3 w-3" />
                  ) : (
                    <XCircle className="mr-1 h-3 w-3" />
                  )}
                  在线投标
                </Badge>
                <Badge
                  variant={selectedMarker.features.supportCaLogin ? 'default' : 'outline'}
                  className={selectedMarker.features.supportCaLogin ? 'bg-green-600' : ''}
                >
                  {selectedMarker.features.supportCaLogin ? (
                    <CheckCircle className="mr-1 h-3 w-3" />
                  ) : (
                    <XCircle className="mr-1 h-3 w-3" />
                  )}
                  CA登录
                </Badge>
              </div>
              {selectedMarker.website && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={selectedMarker.website} target="_blank" rel="noopener noreferrer">
                    <Globe className="mr-2 h-4 w-4" />
                    访问官网
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

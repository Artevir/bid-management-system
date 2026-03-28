/**
 * 百度地图配置API
 * 提供百度地图AK和坐标数据，供前端使用
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { biddingPlatforms } from '@/db/bidding-platform-schema';
import { sql } from 'drizzle-orm';

// ============================================
// GET - 获取百度地图配置和坐标数据
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 筛选类型
    
    // 构建查询条件
    const conditions = [
      sql`${biddingPlatforms.latitude} IS NOT NULL`,
      sql`${biddingPlatforms.longitude} IS NOT NULL`,
    ];
    
    if (type) {
      conditions.push(sql`${biddingPlatforms.type} = ${type}`);
    }
    
    // 查询有坐标的单位
    const platforms = await db
      .select({
        id: biddingPlatforms.id,
        name: biddingPlatforms.name,
        shortName: biddingPlatforms.shortName,
        type: biddingPlatforms.type,
        address: biddingPlatforms.address,
        phone: biddingPlatforms.phone,
        website: biddingPlatforms.website,
        latitude: biddingPlatforms.latitude,
        longitude: biddingPlatforms.longitude,
        coordinatePrecision: biddingPlatforms.coordinatePrecision,
        supportOnlineBid: biddingPlatforms.supportOnlineBid,
        supportCaLogin: biddingPlatforms.supportCaLogin,
        supportLiveStream: biddingPlatforms.supportLiveStream,
      })
      .from(biddingPlatforms)
      .where(sql.join(conditions, sql` AND `))
      .orderBy(biddingPlatforms.sortOrder);
    
    // 返回百度地图配置和坐标数据
    return NextResponse.json({
      success: true,
      // 百度地图配置
      mapConfig: {
        // 百度地图AK（从环境变量获取，前端需要配置）
        ak: process.env.BAIDU_MAP_AK || '',
        // 地图中心点（南宁市中心）
        center: {
          latitude: 22.816678,
          longitude: 108.327456,
        },
        // 默认缩放级别
        zoom: 11,
        // 地图样式
        style: 'normal', // normal, satellite, hybrid
      },
      // 坐标数据
      markers: platforms.map(p => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        type: p.type,
        address: p.address,
        phone: p.phone,
        website: p.website,
        // 百度地图坐标（注意：百度地图API调用时需先经度后纬度）
        position: {
          lat: parseFloat(p.latitude || '0'),
          lng: parseFloat(p.longitude || '0'),
        },
        coordinatePrecision: p.coordinatePrecision,
        features: {
          supportOnlineBid: p.supportOnlineBid,
          supportCaLogin: p.supportCaLogin,
          supportLiveStream: p.supportLiveStream,
        },
      })),
      // 类型统计
      typeStats: {
        provincial_official: platforms.filter(p => p.type === 'provincial_official').length,
        provincial_cloud: platforms.filter(p => p.type === 'provincial_cloud').length,
        state_owned: platforms.filter(p => p.type === 'state_owned').length,
        city_center: platforms.filter(p => p.type === 'city_center').length,
        agent_company: platforms.filter(p => p.type === 'agent_company').length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch map config:', error);
    return NextResponse.json(
      { success: false, error: '获取地图配置失败' },
      { status: 500 }
    );
  }
}

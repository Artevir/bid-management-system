/**
 * 政采信息联动API
 * 提供政采单位智能匹配和场景信息获取接口
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  matchPlatformByName,
  getPlatformFullInfo,
  getPurchaseSceneInfo,
  getOpenBidSceneInfo,
  getSubmitBidSceneInfo,
  linkInterpretationToPlatforms,
  linkProjectToPlatforms,
  getPlatformInfoByInterpretation,
  getPlatformInfoByProject,
  type PurchaseSceneInfo,
  type OpenBidSceneInfo,
  type SubmitBidSceneInfo,
  type _PlatformFullInfo,
} from '@/lib/platform-sync/service';

// ============================================
// GET - 查询政采单位信息
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // 智能匹配政采单位
    if (action === 'match') {
      const name = searchParams.get('name');
      const type = searchParams.get('type') as 'tender' | 'agent' | null;
      
      if (!name) {
        return NextResponse.json(
          { success: false, error: '请提供单位名称' },
          { status: 400 }
        );
      }
      
      const result = await matchPlatformByName(name, type || undefined);
      
      return NextResponse.json({
        success: true,
        ...result,
      });
    }
    
    // 获取政采单位完整信息
    if (action === 'full-info') {
      const id = searchParams.get('id');
      
      if (!id) {
        return NextResponse.json(
          { success: false, error: '请提供政采单位ID' },
          { status: 400 }
        );
      }
      
      const info = await getPlatformFullInfo(parseInt(id));
      
      if (!info) {
        return NextResponse.json(
          { success: false, error: '政采单位不存在' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        info,
      });
    }
    
    // 获取场景信息
    if (action === 'scene') {
      const id = searchParams.get('id');
      const scene = searchParams.get('scene') as 'purchase' | 'openBid' | 'submitBid' | null;
      
      if (!id || !scene) {
        return NextResponse.json(
          { success: false, error: '请提供政采单位ID和场景类型' },
          { status: 400 }
        );
      }
      
      let info: PurchaseSceneInfo | OpenBidSceneInfo | SubmitBidSceneInfo | null = null;
      
      switch (scene) {
        case 'purchase':
          info = await getPurchaseSceneInfo(parseInt(id));
          break;
        case 'openBid':
          info = await getOpenBidSceneInfo(parseInt(id));
          break;
        case 'submitBid':
          info = await getSubmitBidSceneInfo(parseInt(id));
          break;
        default:
          return NextResponse.json(
            { success: false, error: '无效的场景类型' },
            { status: 400 }
          );
      }
      
      if (!info) {
        return NextResponse.json(
          { success: false, error: '政采单位不存在' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        info,
      });
    }
    
    // 通过文件解读ID获取政采单位信息
    if (action === 'by-interpretation') {
      const interpretationId = searchParams.get('interpretationId');
      const scene = searchParams.get('scene') as 'purchase' | 'openBid' | 'submitBid' | 'full' | null;
      
      if (!interpretationId || !scene) {
        return NextResponse.json(
          { success: false, error: '请提供文件解读ID和场景类型' },
          { status: 400 }
        );
      }
      
      const result = await getPlatformInfoByInterpretation(
        parseInt(interpretationId),
        scene
      );
      
      return NextResponse.json({
        success: true,
        ...result,
      });
    }
    
    // 通过项目ID获取政采单位信息
    if (action === 'by-project') {
      const projectId = searchParams.get('projectId');
      const scene = searchParams.get('scene') as 'purchase' | 'openBid' | 'submitBid' | 'full' | null;
      
      if (!projectId || !scene) {
        return NextResponse.json(
          { success: false, error: '请提供项目ID和场景类型' },
          { status: 400 }
        );
      }
      
      const result = await getPlatformInfoByProject(
        parseInt(projectId),
        scene
      );
      
      return NextResponse.json({
        success: true,
        ...result,
      });
    }
    
    return NextResponse.json(
      { success: false, error: '无效的操作类型' },
      { status: 400 }
    );
  } catch (error) {
    console.error('政采信息联动API错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - 关联政采单位
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    // 为文件解读关联政采单位
    if (action === 'link-interpretation') {
      const { interpretationId } = body;
      
      if (!interpretationId) {
        return NextResponse.json(
          { success: false, error: '请提供文件解读ID' },
          { status: 400 }
        );
      }
      
      const result = await linkInterpretationToPlatforms(interpretationId);
      
      return NextResponse.json({
        success: true,
        ...result,
        message: result.platformId || result.agentPlatformId
          ? '关联成功'
          : '未找到匹配的政采单位',
      });
    }
    
    // 为项目关联政采单位
    if (action === 'link-project') {
      const { projectId, interpretationId } = body;
      
      if (!projectId) {
        return NextResponse.json(
          { success: false, error: '请提供项目ID' },
          { status: 400 }
        );
      }
      
      const result = await linkProjectToPlatforms(projectId, interpretationId);
      
      return NextResponse.json({
        success: true,
        ...result,
        message: result.platformId || result.agentPlatformId
          ? '关联成功'
          : '未找到匹配的政采单位',
      });
    }
    
    return NextResponse.json(
      { success: false, error: '无效的操作类型' },
      { status: 400 }
    );
  } catch (error) {
    console.error('政采信息联动API错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

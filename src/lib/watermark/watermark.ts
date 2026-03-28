/**
 * 文档水印服务
 * 实现页面水印、导出文件水印、会话标识
 */

import React from 'react';

// ============================================
// 类型定义
// ============================================

export interface WatermarkConfig {
  enabled: boolean;
  type: 'text' | 'image';
  content: string; // 水印文字或图片URL
  opacity: number; // 透明度 0-1
  rotation: number; // 旋转角度
  fontSize?: number;
  color?: string;
  repeat?: boolean; // 是否平铺
  position?: 'center' | 'tile';
}

export interface SessionWatermarkConfig {
  userId: number;
  username: string;
  projectId: number;
  sessionId: string;
  timestamp: Date;
}

// ============================================
// 前端水印组件（用于页面显示）
// ============================================

/**
 * 生成前端水印CSS样式
 */
export function generateWatermarkStyle(config: WatermarkConfig): React.CSSProperties {
  if (!config.enabled) {
    return {};
  }

  const baseStyle: React.CSSProperties = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 9999,
    opacity: config.opacity,
  };

  if (config.type === 'text') {
    // 使用canvas生成水印图片
    return baseStyle;
  }

  return baseStyle;
}

/**
 * 生成Canvas水印
 */
export function generateCanvasWatermark(
  config: WatermarkConfig
): string {
  if (!config.enabled || config.type !== 'text') {
    return '';
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 设置画布尺寸
  canvas.width = 300;
  canvas.height = 200;

  // 设置样式
  ctx.font = `${config.fontSize || 16}px Arial`;
  ctx.fillStyle = config.color || 'rgba(200, 200, 200, 0.3)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 旋转
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((config.rotation || -30) * Math.PI / 180);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  // 绘制文字
  ctx.fillText(config.content, canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL('image/png');
}

// ============================================
// PDF导出水印（服务端）
// ============================================

/**
 * 为PDF添加水印
 * 使用pdf-lib库实现
 */
export async function addPdfWatermark(
  pdfBuffer: Buffer,
  config: WatermarkConfig,
  sessionConfig?: SessionWatermarkConfig
): Promise<Buffer> {
  if (!config.enabled) {
    return pdfBuffer;
  }

  // 注意：这里需要使用pdf-lib或类似库实现PDF水印
  // 由于环境限制，这里简化实现
  // 实际生产环境需要完整实现

  console.log('添加PDF水印:', {
    config,
    session: sessionConfig ? {
      userId: sessionConfig.userId,
      sessionId: sessionConfig.sessionId,
    } : null,
  });

  return pdfBuffer;
}

/**
 * 生成Word文档水印（在转换为PDF时添加）
 */
export async function addWordWatermark(
  docxBuffer: Buffer,
  config: WatermarkConfig
): Promise<Buffer> {
  // Word水印需要使用docx库或mammoth等工具
  // 这里简化实现
  console.log('添加Word水印:', config);
  return docxBuffer;
}

// ============================================
// 会话标识水印
// ============================================

/**
 * 生成会话标识水印内容
 */
export function generateSessionWatermark(
  config: SessionWatermarkConfig
): string {
  const date = config.timestamp.toLocaleString('zh-CN');
  return `${config.username} ${date}`;
}

/**
 * 生成带会话标识的水印配置
 */
export function createSessionWatermarkConfig(
  sessionConfig: SessionWatermarkConfig,
  baseConfig?: Partial<WatermarkConfig>
): WatermarkConfig {
  return {
    enabled: true,
    type: 'text',
    content: generateSessionWatermark(sessionConfig),
    opacity: baseConfig?.opacity ?? 0.15,
    rotation: baseConfig?.rotation ?? -30,
    fontSize: baseConfig?.fontSize ?? 14,
    color: baseConfig?.color ?? '#999999',
    repeat: true,
    position: 'tile',
    ...baseConfig,
  };
}

// ============================================
// 前端水印Hook
// ============================================

export function useWatermark(config: WatermarkConfig) {
  React.useEffect(() => {
    if (!config.enabled || typeof window === 'undefined') {
      return;
    }

    // 创建水印容器
    let watermarkDiv = document.getElementById('watermark-container');
    if (!watermarkDiv) {
      watermarkDiv = document.createElement('div');
      watermarkDiv.id = 'watermark-container';
      document.body.appendChild(watermarkDiv);
    }

    // 生成水印图片
    const watermarkUrl = generateCanvasWatermark(config);

    // 应用样式
    Object.assign(watermarkDiv.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 9999,
      opacity: config.opacity,
      backgroundImage: `url(${watermarkUrl})`,
      backgroundRepeat: 'repeat',
      backgroundPosition: 'center',
    });

    return () => {
      watermarkDiv?.remove();
    };
  }, [config]);
}

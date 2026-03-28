'use client';

import { useEffect, useRef, useState } from 'react';

interface WatermarkProps {
  /** 水印文本，默认为用户名 */
  text?: string;
  /** 水印字体大小 */
  fontSize?: number;
  /** 水印颜色 */
  color?: string;
  /** 水印透明度 */
  opacity?: number;
  /** 水印旋转角度（度） */
  rotate?: number;
  /** 水印间距 */
  gap?: number;
  /** 水印层级 */
  zIndex?: number;
  /** 是否显示时间戳 */
  showTime?: boolean;
  /** 是否启用水印 */
  enabled?: boolean;
}

export function Watermark({
  text = '',
  fontSize = 14,
  color = '#000000',
  opacity = 0.1,
  rotate = -22,
  gap = 100,
  zIndex = 9999,
  showTime = false,
  enabled = true,
}: WatermarkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [watermarkUrl, setWatermarkUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    if (!enabled || !text) {
      setWatermarkUrl('');
      return;
    }

    // 更新时间戳
    if (showTime) {
      const updateTime = () => {
        setCurrentTime(new Date().toLocaleString('zh-CN'));
      };
      updateTime();
      const timer = setInterval(updateTime, 60000); // 每分钟更新
      return () => clearInterval(timer);
    }
  }, [enabled, text, showTime]);

  useEffect(() => {
    if (!enabled || !text) {
      setWatermarkUrl('');
      return;
    }

    // 创建 canvas 生成水印图案
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 计算单个水印单元大小
    const displayText = showTime && currentTime ? `${text}\n${currentTime}` : text;
    const lines = displayText.split('\n');
    const lineHeight = fontSize * 1.5;
    const maxWidth = Math.max(...lines.map((line) => ctx.measureText(line).width || line.length * fontSize * 0.6));
    
    const unitWidth = maxWidth + gap / 2;
    const unitHeight = lines.length * lineHeight + gap / 2;

    canvas.width = unitWidth * 2;
    canvas.height = unitHeight * 2;

    // 设置字体样式
    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 旋转
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // 绘制多行文本
    const drawText = (x: number, y: number) => {
      const startY = y - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        ctx.fillText(line, x, startY + index * lineHeight);
      });
    };

    // 绘制水印图案
    drawText(unitWidth / 2, unitHeight / 2);
    drawText(unitWidth * 1.5, unitHeight / 2);
    drawText(unitWidth / 2, unitHeight * 1.5);
    drawText(unitWidth * 1.5, unitHeight * 1.5);

    // 转换为 DataURL
    const url = canvas.toDataURL('image/png');
    setWatermarkUrl(url);
  }, [enabled, text, fontSize, color, opacity, rotate, gap, showTime, currentTime]);

  if (!enabled || !text || !watermarkUrl) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex,
        backgroundImage: `url(${watermarkUrl})`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center',
      }}
      aria-hidden="true"
    />
  );
}

// 简化版水印 Hook，用于动态获取用户信息
export function useWatermarkText() {
  const [text, setText] = useState<string>('');

  useEffect(() => {
    // 从 API 获取当前用户信息
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setText(`${data.user.realName || data.user.username}`);
        }
      })
      .catch(() => {
        // 忽略错误
      });
  }, []);

  return text;
}

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 快捷键配置类型
 */
interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description?: string;
}

/**
 * 全局快捷键 Hook
 * 
 * 支持的快捷键：
 * - Ctrl/Cmd + K: 全局搜索
 * - Ctrl/Cmd + N: 新建项目
 * - Ctrl/Cmd + T: 切换主题
 * - G + P: 跳转项目
 * - G + B: 跳转标书
 * - G + K: 跳转知识库
 * - G + A: 跳转审核
 * - G + D: 跳转项目看板
 * - G + C: 跳转日历
 * - G + Q: 跳转报价
 * - G + I: 跳转AI治理
 * - Esc: 关闭弹窗/取消操作
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const gKeyPressed = useRef(false);
  const gKeyTimeout = useRef<NodeJS.Timeout | null>(null);

  // 快捷键配置
  const shortcuts: ShortcutConfig[] = [
    // 全局搜索
    {
      key: 'k',
      ctrl: true,
      action: () => {
        // 触发搜索弹窗（通过自定义事件）
        window.dispatchEvent(new CustomEvent('open-search'));
      },
      description: '全局搜索',
    },
    // 新建项目
    {
      key: 'n',
      ctrl: true,
      action: () => {
        router.push('/projects/new');
      },
      description: '新建项目',
    },
    // 切换主题
    {
      key: 't',
      ctrl: true,
      action: () => {
        window.dispatchEvent(new CustomEvent('toggle-theme'));
      },
      description: '切换主题',
    },
  ];

  // G键组合导航
  const gNavigation: Record<string, string> = {
    p: '/projects',
    b: '/bid',
    k: '/knowledge',
    a: '/approval',
    d: '/dashboard',
    c: '/calendar',
    q: '/quotes',
    i: '/ai-governance',
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 忽略在输入框中的快捷键
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // 除了 Ctrl+K 全局搜索
      if (!((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
        return;
      }
    }

    const key = event.key.toLowerCase();

    // 处理 Ctrl/Cmd 快捷键
    if (event.ctrlKey || event.metaKey) {
      const shortcut = shortcuts.find(
        s => s.key === key && s.ctrl
      );
      if (shortcut) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }

    // 处理 G + key 组合快捷键
    if (key === 'g' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      gKeyPressed.current = true;
      // 500ms 内需要按下下一个键
      if (gKeyTimeout.current) {
        clearTimeout(gKeyTimeout.current);
      }
      gKeyTimeout.current = setTimeout(() => {
        gKeyPressed.current = false;
      }, 500);
      return;
    }

    // 如果 G 键刚被按下，处理后续导航键
    if (gKeyPressed.current && gNavigation[key]) {
      event.preventDefault();
      router.push(gNavigation[key]);
      gKeyPressed.current = false;
      if (gKeyTimeout.current) {
        clearTimeout(gKeyTimeout.current);
      }
      return;
    }

    // ESC 键关闭弹窗
    if (key === 'escape') {
      window.dispatchEvent(new CustomEvent('close-modal'));
    }
  }, [router, shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gKeyTimeout.current) {
        clearTimeout(gKeyTimeout.current);
      }
    };
  }, [handleKeyDown]);

  return {
    shortcuts: shortcuts.map(s => ({
      key: s.key,
      ctrl: s.ctrl,
      description: s.description,
    })),
    gNavigation: Object.entries(gNavigation).map(([key, path]) => ({
      key,
      path,
      description: getPathDescription(path),
    })),
  };
}

/**
 * 获取路径描述
 */
function getPathDescription(path: string): string {
  const descriptions: Record<string, string> = {
    '/projects': '项目管理',
    '/bid': '标书文档',
    '/knowledge': '知识库',
    '/approval': '审核中心',
    '/dashboard': '项目看板',
    '/calendar': '投标日历',
    '/quotes': '智能报价',
    '/ai-governance': 'AI治理',
  };
  return descriptions[path] || path;
}

/**
 * 快捷键帮助组件的 Props
 */
export interface ShortcutHelp {
  key: string;
  ctrl?: boolean;
  description: string;
}

/**
 * 获取所有快捷键列表（用于帮助弹窗）
 */
export function getAllShortcuts(): ShortcutHelp[] {
  return [
    { key: 'K', ctrl: true, description: '全局搜索' },
    { key: 'N', ctrl: true, description: '新建项目' },
    { key: 'T', ctrl: true, description: '切换主题' },
    { key: 'G → P', description: '跳转项目管理' },
    { key: 'G → B', description: '跳转标书文档' },
    { key: 'G → K', description: '跳转知识库' },
    { key: 'G → A', description: '跳转审核中心' },
    { key: 'G → D', description: '跳转项目看板' },
    { key: 'G → C', description: '跳转投标日历' },
    { key: 'G → Q', description: '跳转智能报价' },
    { key: 'G → I', description: '跳转AI治理' },
    { key: 'Esc', description: '关闭弹窗' },
  ];
}

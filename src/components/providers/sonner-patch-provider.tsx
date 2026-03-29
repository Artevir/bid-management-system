'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

function normalizeToastMessage(input: unknown): any {
  if (input == null) return '';
  if (typeof input === 'string' || typeof input === 'number') return String(input);
  if (typeof input === 'object') {
    const maybeMessage = (input as any).message;
    if (typeof maybeMessage === 'string') return maybeMessage;
    try {
      return JSON.stringify(input);
    } catch {
      return String(input);
    }
  }
  return String(input);
}

export function SonnerPatchProvider() {
  useEffect(() => {
    const t: any = toast as any;
    const keys = ['error', 'success', 'info', 'warning', 'message', 'loading'];
    for (const k of keys) {
      const fn = t?.[k];
      if (typeof fn !== 'function') continue;
      if (fn.__normalized) continue;

      const wrapped = (msg: unknown, ...args: any[]) => fn(normalizeToastMessage(msg), ...args);
      wrapped.__normalized = true;
      t[k] = wrapped;
    }

    if (typeof t === 'function' && !t.__normalized) {
      const original = t;
      const wrapped = (msg: unknown, ...args: any[]) => original(normalizeToastMessage(msg), ...args);
      wrapped.__normalized = true;
      Object.assign(wrapped, t);
    }
  }, []);

  return null;
}


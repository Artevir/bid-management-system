'use client';

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

function patchSonnerToastOnce() {
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
}

patchSonnerToastOnce();

export function SonnerPatchProvider() {
  return null;
}

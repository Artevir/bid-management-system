'use client';

import { useEffect } from 'react';
import { CHUNK_RELOAD_SESSION_KEY } from '@/lib/client/chunk-error';

/**
 * After a new deploy, cached HTML may still reference removed hashed chunks under
 * `/_next/static/`, causing "Loading chunk ... failed". Reload once so the browser
 * fetches fresh HTML and chunk URLs.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const reloadOnce = () => {
      if (typeof window === 'undefined' || sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) return;
      sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
      window.location.reload();
    };

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const name = reason && typeof reason === 'object' && 'name' in reason ? String(reason.name) : '';
      const msg = reason instanceof Error ? reason.message : String(reason ?? '');
      if (
        name === 'ChunkLoadError' ||
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module')
      ) {
        e.preventDefault();
        reloadOnce();
      }
    };

    const onError = (e: Event) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.tagName !== 'SCRIPT') return;
      const src = (t as HTMLScriptElement).src;
      if (src && src.includes('/_next/static/')) {
        reloadOnce();
      }
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError, true);

    const clearGuard = window.setTimeout(() => {
      sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
    }, 10000);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError, true);
      window.clearTimeout(clearGuard);
    };
  }, []);

  return null;
}

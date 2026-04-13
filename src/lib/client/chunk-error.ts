/** Must match inline script in `app/layout.tsx` (runs before any client chunk). */
export const CHUNK_RELOAD_SESSION_KEY = 'bidmgmt_chunk_reload_once';

export function isChunkOrModuleLoadError(error?: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || '';
  const name = 'name' in error ? String((error as { name?: string }).name || '') : '';
  return (
    name === 'ChunkLoadError' ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed')
  );
}

export function hardReloadForNewDeployment(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.searchParams.set('_chunk_retry', String(Date.now()));
  window.location.replace(url.toString());
}

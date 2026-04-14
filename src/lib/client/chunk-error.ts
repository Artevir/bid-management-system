/** Session guard for one automatic reload after deploy / stale chunk. */
export const CHUNK_RELOAD_SESSION_KEY = 'bidmgmt_chunk_reload_once';

/**
 * One automatic navigation with a fresh URL (busts many browser/CDN HTML caches).
 * `location.reload()` often re-serves cached HTML that still points at removed chunks.
 */
export function navigateOnceWithCacheBustForStaleChunks(): void {
  if (typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
  } catch {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('_chunk_retry', String(Date.now()));
  window.location.replace(url.toString());
}

/**
 * Injected via `next/script` `beforeInteractive` from root layout so it runs
 * before React and before `layout-*.js` — plain `<script>` in RSC can be unreliable.
 */
export function getChunkRecoveryInlineScript(): string {
  const k = JSON.stringify(CHUNK_RELOAD_SESSION_KEY);
  return [
    '(function(){',
    `var k=${k};`,
    'function go(){',
    'try{if(sessionStorage.getItem(k))return;}catch(e){}',
    'try{sessionStorage.setItem(k,"1");}catch(e){}',
    'try{var u=new URL(location.href);u.searchParams.set("_chunk_retry",""+Date.now());location.replace(u.toString());}',
    'catch(e2){var sep=location.search?"&":"?";location.replace(location.pathname+location.search+sep+"_chunk_retry="+Date.now());}',
    '}',
    'window.addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="SCRIPT"&&t.src&&t.src.indexOf("/_next/static/")!==-1){go();return;}var msg=String((e&&e.message)||"");if(msg.indexOf("Loading chunk")!==-1||msg.indexOf("ChunkLoadError")!==-1)go();},true);',
    'window.addEventListener("unhandledrejection",function(e){var r=e.reason,m="",n="";try{if(r&&typeof r==="object"){m=String(r.message||"");n=String(r.name||"");}else{m=String(r||"");}}catch(x){}if(n==="ChunkLoadError"||m.indexOf("Loading chunk")!==-1||m.indexOf("Failed to fetch dynamically imported module")!==-1){e.preventDefault();go();}});',
    'setTimeout(function(){try{sessionStorage.removeItem(k);}catch(e){}},15e3);',
    '})();',
  ].join('');
}

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

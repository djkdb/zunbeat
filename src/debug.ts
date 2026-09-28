/**
 * Debug mode: `?debug=true` in development builds only. Production builds hide it unless
 * built with VITE_ENABLE_DEBUG=true.
 */
function readParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

export const DEBUG_ENABLED: boolean =
  (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true') && readParam('debug') === 'true';

/** `&panel=false` keeps debug features (autoplay, window.__BEATSHIFT__) but hides the panel — for clean captures. */
export const DEBUG_PANEL: boolean = DEBUG_ENABLED && readParam('panel') !== 'false';

/** `&autoplay=true` starts every play in autoplay (never saved to records). */
export const DEBUG_AUTOPLAY: boolean = DEBUG_ENABLED && readParam('autoplay') === 'true';

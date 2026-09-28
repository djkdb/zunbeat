/**
 * Debug mode: `?debug=true` in development builds only. Production builds hide it unless
 * built with VITE_ENABLE_DEBUG=true.
 */
function readFlag(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'true';
  } catch {
    return false;
  }
}

export const DEBUG_ENABLED: boolean = (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true') && readFlag();

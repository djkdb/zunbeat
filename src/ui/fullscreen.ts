import { useEffect, useState } from 'react';

type FsDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsElement;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  const d = document as FsDocument;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

export async function toggleFullscreen(): Promise<void> {
  const d = document as FsDocument;
  const el = document.documentElement as FsElement;
  try {
    if (isFullscreen()) {
      if (d.exitFullscreen) await d.exitFullscreen();
      else d.webkitExitFullscreen?.();
    } else if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
    } else {
      el.webkitRequestFullscreen?.();
    }
  } catch {
    /* denied or unsupported */
  }
}

export function useFullscreen(): boolean {
  const [fs, setFs] = useState(isFullscreen);
  useEffect(() => {
    const on = () => setFs(isFullscreen());
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      document.removeEventListener('webkitfullscreenchange', on);
    };
  }, []);
  return fs;
}

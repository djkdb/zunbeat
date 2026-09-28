import { useEffect, useRef, useState } from 'react';
import { useApp } from '../appContext';

interface Options {
  count: number;
  onSelect: (index: number) => void;
  onBack?: () => void;
  initial?: number;
  /** Arrow axis used to move between items. */
  axis?: 'vertical' | 'horizontal';
  enabled?: boolean;
}

/** Arrow keys + Enter + Escape navigation for a list of buttons, with sound feedback. */
export function useMenuNavigation({ count, onSelect, onBack, initial = 0, axis = 'vertical', enabled = true }: Options) {
  const [index, setIndex] = useState(initial);
  const { sfx } = useApp();
  const handlers = useRef({ onSelect, onBack, sfx });
  const indexRef = useRef(index);
  useEffect(() => {
    handlers.current = { onSelect, onBack, sfx };
    indexRef.current = index;
  });

  useEffect(() => {
    if (!enabled) return;
    const prev = axis === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const next = axis === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === prev || e.key === next) {
        e.preventDefault();
        setIndex((i) => (i + (e.key === next ? 1 : -1) + count) % count);
        handlers.current.sfx('menuMove');
      } else if (e.key === 'Escape' && handlers.current.onBack) {
        e.preventDefault();
        handlers.current.sfx('menuBack');
        handlers.current.onBack();
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        handlers.current.sfx('menuSelect');
        handlers.current.onSelect(indexRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, axis, enabled]);

  return [index, setIndex] as const;
}

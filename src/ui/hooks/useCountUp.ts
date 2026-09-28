import { useEffect, useState } from 'react';

/** Animates 0 → target after `delay` ms over `duration` ms (ease-out). */
export function useCountUp(target: number, duration: number, delay = 0, instant = false): number {
  const [value, setValue] = useState(instant ? target : 0);
  useEffect(() => {
    if (instant) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(target * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay, instant]);
  return instant ? target : value;
}

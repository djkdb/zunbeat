/** True when the primary input is a finger (phones, tablets), regardless of orientation. */
export function isTouchPrimary(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  } catch {
    return false;
  }
}

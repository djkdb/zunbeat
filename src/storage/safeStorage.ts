/** localStorage wrapper that never throws (private mode, quota, disabled storage, bad JSON). */
export const safeStorage = {
  read<T>(key: string, validate: (raw: unknown) => T | null): T | null {
    try {
      const text = window.localStorage.getItem(key);
      if (text === null) return null;
      return validate(JSON.parse(text));
    } catch {
      return null;
    }
  },
  write(key: string, value: unknown): boolean {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
export const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
export const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

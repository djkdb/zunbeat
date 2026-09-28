export function formatScore(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatAccuracy(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDate(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

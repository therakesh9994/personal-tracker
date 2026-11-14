import { addDays, endOfDay, format, startOfDay, startOfWeek, subDays } from 'date-fns';

export const now = (): number => Date.now();

export function dayRange(dayMs: number): { start: number; end: number } {
  return { start: startOfDay(dayMs).getTime(), end: endOfDay(dayMs).getTime() };
}

export function dayKey(ms: number): string {
  return format(ms, 'yyyy-MM-dd');
}

export function weekStart(ms: number): number {
  return startOfWeek(ms, { weekStartsOn: 1 }).getTime();
}

export type RangeKey = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' },
];

/** Start timestamp (inclusive) for a range filter; 0 for all time. */
export function rangeStart(range: RangeKey, ref: number = Date.now()): number {
  const days: Record<Exclude<RangeKey, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90, '6m': 182, '1y': 365 };
  if (range === 'all') return 0;
  return startOfDay(subDays(ref, days[range] - 1)).getTime();
}

/** Enumerate day starts from start to end (inclusive). */
export function eachDay(start: number, end: number): number[] {
  const out: number[] = [];
  for (let d = startOfDay(start); d.getTime() <= end; d = addDays(d, 1)) out.push(d.getTime());
  return out;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDurationShort(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

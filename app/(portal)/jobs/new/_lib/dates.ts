import type { Priority } from '@/types/jobs';
import { PRIORITIES, PRIORITY_ORDER, SAME_DAY_CUTOFF_HOUR } from './constants';

/** Ontario statutory holidays that fall on weekdays. Move to the API with jurisdiction_rules. */
const ONTARIO_HOLIDAYS: ReadonlySet<string> = new Set([
  '2026-10-12', // Thanksgiving
  '2026-12-25', // Christmas
  '2026-12-28', // Boxing Day (observed)
  '2027-01-01', // New Year's Day
  '2027-02-15', // Family Day
  '2027-03-26', // Good Friday
]);

/** Local calendar date as YYYY-MM-DD (not UTC, which can be a day off in the evening). */
export function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  return dow !== 0 && dow !== 6 && !ONTARIO_HOLIDAYS.has(localIsoDate(d));
}

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) left--;
  }
  return d;
}

export function sameDayAvailable(now: Date = new Date()): boolean {
  return isBusinessDay(now) && now.getHours() < SAME_DAY_CUTOFF_HOUR;
}

/** Due date at 5:00 p.m. local for each priority. */
export function dueDates(now: Date = new Date()): Record<Priority, Date> {
  const out = {} as Record<Priority, Date>;
  for (const p of PRIORITY_ORDER) {
    const d = addBusinessDays(now, PRIORITIES[p].businessDays);
    d.setHours(p === 'same_day' ? 20 : 17, 0, 0, 0);
    out[p] = d;
  }
  return out;
}

export function formatDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDueTime(d: Date): string {
  return `${formatDay(d)}, ${d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`;
}

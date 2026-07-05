import { addDays, toDateKey } from '@/lib/date';

/**
 * Monday-anchored week range used by the weekly AI analysis.
 *
 * The reminder system already treats Sunday as the "look-back" day
 * (default weeklyDay = 7) so weeks run Monday → Sunday: by Sunday
 * evening the whole week is complete and ready to be analyzed.
 *
 * Both ends are inclusive `YYYY-MM-DD` keys. The Edge Function expands
 * `weekEnd` to an exclusive Date filter on the server side.
 */

export type WeekRange = {
  start: string; // Monday, YYYY-MM-DD
  end: string; // Sunday, YYYY-MM-DD (inclusive)
};

function startOfWeek(date: Date): Date {
  // Date.getDay(): Sunday=0, Monday=1, …, Saturday=6.
  // We want days-since-Monday: Mon→0, Tue→1, …, Sun→6.
  const offset = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - offset);
  return monday;
}

/** Monday→Sunday range that contains `date` (local time). */
export function getWeekRange(date: Date): WeekRange {
  const monday = startOfWeek(date);
  const sunday = addDays(monday, 6);
  return { start: toDateKey(monday), end: toDateKey(sunday) };
}

/** Shift a week range by `weeks` (negative = past). */
export function shiftWeek(range: WeekRange, weeks: number): WeekRange {
  // Parse YYYY-MM-DD as local time (not UTC) so DST or timezone shifts
  // around midnight can't bump the result into the wrong week.
  const [y, m, d] = range.start.split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  monday.setDate(monday.getDate() + weeks * 7);
  return getWeekRange(monday);
}

/** Are two ranges the same week? Compare by `start` only — `end` is derived. */
export function isSameWeek(a: WeekRange, b: WeekRange): boolean {
  return a.start === b.start;
}

/** Human-friendly Japanese label, e.g. `5/18 - 5/24`. */
export function formatWeekLabel(range: WeekRange): string {
  const [, sm, sd] = range.start.split('-').map(Number);
  const [, em, ed] = range.end.split('-').map(Number);
  return `${sm}/${sd} - ${em}/${ed}`;
}

/**
 * Elapsed days of the week as of `today` — the habit-rate denominator.
 * Past weeks are complete (7); the current week counts Monday→today; a
 * week that hasn't started yet is 0.
 */
export function weekElapsedDays(range: WeekRange, today: Date): number {
  const [y, m, d] = range.start.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (day < start) return 0;
  // Round to absorb DST shifts inside the week.
  const elapsed = Math.round((day.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(7, elapsed);
}

/**
 * "今週" / "先週" / null relative to `today`.
 * Returns null for any week further than 1 in the past or any future week.
 */
export function relativeWeekLabel(range: WeekRange, today: Date): '今週' | '先週' | null {
  const current = getWeekRange(today);
  if (range.start === current.start) return '今週';
  if (range.start === shiftWeek(current, -1).start) return '先週';
  return null;
}

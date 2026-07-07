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

/**
 * The `count` most recent weeks, oldest → newest, ending at the week
 * containing `today`. Page order for the Reflect week pager (oldest on the
 * left so swiping right moves back in time, matching the journal list).
 */
export function listRecentWeeks(today: Date, count: number): WeekRange[] {
  const current = getWeekRange(today);
  return Array.from({ length: count }, (_, i) => shiftWeek(current, i - (count - 1)));
}

/**
 * Every week from the one containing `earliest` (a YYYY-MM-DD key, e.g.
 * the first journal entry) through the week containing `today`, oldest →
 * newest — the data-driven range for the week pager and picker.
 */
export function listWeeksSince(earliest: string, today: Date): WeekRange[] {
  const [y, m, d] = weekStartOf(earliest).split('-').map(Number);
  const [cy, cm, cd] = getWeekRange(today).start.split('-').map(Number);
  const span = new Date(cy, cm - 1, cd).getTime() - new Date(y, m - 1, d).getTime();
  const count = Math.round(span / (7 * 24 * 60 * 60 * 1000)) + 1;
  return listRecentWeeks(today, Math.max(1, count));
}

export type WeekMonthGroup = { year: number; month: number; weeks: WeekRange[] };

/**
 * Consecutive weeks grouped by the year+month of their Monday, oldest →
 * newest — feeds the 年/月/週 columns of the week picker so each column
 * stays a handful of rows no matter how long the history grows.
 */
export function groupWeeksByMonth(weeks: WeekRange[]): WeekMonthGroup[] {
  const groups: WeekMonthGroup[] = [];
  for (const week of weeks) {
    const [year, month] = week.start.split('-').map(Number);
    const last = groups[groups.length - 1];
    if (last && last.year === year && last.month === month) {
      last.weeks.push(week);
    } else {
      groups.push({ year, month, weeks: [week] });
    }
  }
  return groups;
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
 * Display name of a week, e.g. `7月 第1週`. A week belongs to the month
 * its Monday falls in; the number is the Monday's position among that
 * month's Mondays (day 1-7 → 1, 8-14 → 2, …).
 */
export function weekName(range: WeekRange): string {
  const [, month, day] = range.start.split('-').map(Number);
  return `${month}月 第${Math.ceil(day / 7)}週`;
}

/** Monday key of the week containing `dateKey` (parsed as local time). */
export function weekStartOf(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return getWeekRange(new Date(y, m - 1, d)).start;
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

/**
 * Insights aggregations.
 *
 * Pure, side-effect-free functions that turn the per-day journal records
 * (a subset of `MonthEntry`) into the three dashboard visualizations:
 *   - Feeling trend  (weekly / monthly average mood)
 *   - Habit rates    (achievement % per habit in the current period)
 *   - Journal streak (consecutive recorded days)
 *
 * Kept separate from any rendering so the maths can be unit-tested without
 * a renderer — see `insights.test.ts`.
 */

import { FEELINGS, HABITS, type HabitKey } from '@/features/journal/draft';
import { addDays, toDateKey } from '@/lib/date';

/** Day-level slice of `MonthEntry` the aggregations actually need. */
export type DayRecord = {
  date: string; // YYYY-MM-DD (local calendar date)
  feeling: string | null;
  habits: Record<string, boolean>;
};

export type InsightsPeriod = 'week' | 'month';

/** How many buckets the trend line shows per period. */
export const TREND_WEEKS = 6;
export const TREND_MONTHS = 6;

/** Feeling score scale: happiest = FEELING_MAX, saddest = FEELING_MIN. */
export const FEELING_MIN = 1;
export const FEELING_MAX = FEELINGS.length; // 5

/**
 * FEELINGS is ordered best → worst, so the first face maps to the top of the
 * 1..FEELING_MAX scale. Unknown / empty feelings return null so they are
 * excluded from averages rather than counted as 0 (which would drag the line
 * to the floor on days the user only logged habits).
 */
const FEELING_SCORES: Record<string, number> = Object.fromEntries(
  FEELINGS.map((face, i) => [face, FEELINGS.length - i]),
);

export function feelingToScore(feeling: string | null): number | null {
  if (!feeling) return null;
  return FEELING_SCORES[feeling] ?? null;
}

export type TrendPoint = {
  /** Stable bucket identity (Monday date key for weeks, `YYYY-MM` for months). */
  key: string;
  /** Short x-axis label, e.g. `5/18` or `5月`. */
  label: string;
  /** Average feeling score of recorded days in the bucket; null when empty. */
  score: number | null;
  /** Number of recorded days that had a feeling set. */
  count: number;
};

export type HabitRate = {
  key: HabitKey;
  label: string;
  /** Days in the window with the habit checked. */
  checked: number;
  /** Denominator — elapsed days in the current period. */
  total: number;
  /** checked / total, clamped to [0, 1]; 0 when total is 0. */
  rate: number;
};

export type StreakInfo = {
  /** Consecutive recorded days ending today (or yesterday if today is unlogged). */
  current: number;
  /** Longest consecutive run anywhere in the supplied dates. */
  longest: number;
  /** Whether today already has a journal entry. */
  recordedToday: boolean;
};

/** Inclusive date window the habit rates are computed over. */
export type HabitWindow = {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (today)
  days: number; // elapsed days = habit-rate denominator
};

export type InsightsData = {
  period: InsightsPeriod;
  trend: TrendPoint[];
  habitRates: HabitRate[];
  /** The from–to window (and denominator) the habit rates cover. */
  habitWindow: HabitWindow;
  streak: StreakInfo;
  /** Distinct recorded days across the fetched window (drives the empty state). */
  recordedDays: number;
  /** Recorded-or-not for the last 7 calendar days; index 0 = 6 days ago, 6 = today. */
  last7Recorded: boolean[];
};

const DAY_MS = 1000 * 60 * 60 * 24;

/** Parse a `YYYY-MM-DD` key as a local-midnight Date. */
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local midnight of `date`, without mutating it. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday (local midnight) of the week containing `date`. */
function mondayOf(date: Date): Date {
  const monday = startOfDay(date);
  // Date.getDay(): Sun=0..Sat=6 → days since Monday: Mon=0..Sun=6.
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday;
}

/** `YYYY-MM` key for the month containing `date`. */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Whole days between two local-midnight dates (rounded to absorb DST). */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * The `YYYY-MM` months that must be fetched to cover a period's trend window
 * (plus the current month, since `today` is always inside the range).
 */
export function monthsToFetch(period: InsightsPeriod, today: Date): string[] {
  if (period === 'month') {
    const out: string[] = [];
    for (let i = TREND_MONTHS - 1; i >= 0; i--) {
      out.push(monthKey(new Date(today.getFullYear(), today.getMonth() - i, 1)));
    }
    return out;
  }

  // week: span from the oldest Monday to today, collecting each month touched.
  const oldestMonday = mondayOf(today);
  oldestMonday.setDate(oldestMonday.getDate() - (TREND_WEEKS - 1) * 7);
  const cursor = new Date(oldestMonday.getFullYear(), oldestMonday.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const out: string[] = [];
  while (cursor <= endMonth) {
    out.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

export function buildWeeklyTrend(
  records: DayRecord[],
  today: Date,
  weeks: number = TREND_WEEKS,
): TrendPoint[] {
  const thisMonday = mondayOf(today);
  const buckets = Array.from({ length: weeks }, (_, idx) => {
    const i = weeks - 1 - idx; // idx 0 = oldest
    const monday = new Date(thisMonday);
    monday.setDate(monday.getDate() - i * 7);
    const sunday = addDays(monday, 6);
    return {
      key: toDateKey(monday),
      label: `${monday.getMonth() + 1}/${monday.getDate()}`,
      start: monday,
      end: sunday,
      sum: 0,
      count: 0,
    };
  });

  for (const rec of records) {
    const score = feelingToScore(rec.feeling);
    if (score == null) continue;
    const d = parseDateKey(rec.date);
    const bucket = buckets.find((b) => d >= b.start && d <= b.end);
    if (bucket) {
      bucket.sum += score;
      bucket.count += 1;
    }
  }

  return buckets.map(({ key, label, sum, count }) => ({
    key,
    label,
    score: count > 0 ? sum / count : null,
    count,
  }));
}

export function buildMonthlyTrend(
  records: DayRecord[],
  today: Date,
  months: number = TREND_MONTHS,
): TrendPoint[] {
  const buckets = Array.from({ length: months }, (_, idx) => {
    const i = months - 1 - idx; // idx 0 = oldest
    const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return {
      key: monthKey(first),
      label: `${first.getMonth() + 1}月`,
      sum: 0,
      count: 0,
    };
  });

  for (const rec of records) {
    const score = feelingToScore(rec.feeling);
    if (score == null) continue;
    const ym = rec.date.slice(0, 7);
    const bucket = buckets.find((b) => b.key === ym);
    if (bucket) {
      bucket.sum += score;
      bucket.count += 1;
    }
  }

  return buckets.map(({ key, label, sum, count }) => ({
    key,
    label,
    score: count > 0 ? sum / count : null,
    count,
  }));
}

/**
 * Achievement rate per habit over a window of records.
 * `total` is the elapsed-days denominator the caller has already worked out
 * for the current period (e.g. day-of-week so far, or day-of-month).
 */
export function buildHabitRates(records: DayRecord[], total: number): HabitRate[] {
  // Notion surfaces habit checkboxes keyed by their property name (e.g.
  // "Output"), which is not lower-cased like our HabitKey. Normalize each
  // record's keys once so the lookup is case-insensitive.
  const normalized = records.map((rec) => {
    const lower: Record<string, boolean> = {};
    for (const [name, value] of Object.entries(rec.habits)) {
      lower[name.toLowerCase()] = value;
    }
    return lower;
  });

  return HABITS.map(({ key, label }) => {
    let checked = 0;
    for (const habits of normalized) {
      if (habits[key]) checked += 1;
    }
    const rate = total > 0 ? Math.min(1, checked / total) : 0;
    return { key, label, checked, total, rate };
  });
}

/**
 * Journal streak from the set of recorded dates.
 * `current` counts back from today; if today is not yet logged it counts from
 * yesterday so a streak isn't shown as broken until the day actually passes.
 */
export function computeStreak(dates: Iterable<string>, today: Date): StreakInfo {
  const set = new Set(dates);
  const recordedToday = set.has(toDateKey(startOfDay(today)));

  // Current run.
  let current = 0;
  let cursor = startOfDay(today);
  if (!set.has(toDateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }
  while (set.has(toDateKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest run anywhere — sort keys (YYYY-MM-DD sorts chronologically).
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    if (prev && toDateKey(addDays(parseDateKey(prev), 1)) === key) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = key;
  }

  return { current, longest, recordedToday };
}

/** Combine fetched day records into everything the Insights screen renders. */
export function aggregateInsights(
  period: InsightsPeriod,
  records: DayRecord[],
  today: Date,
): InsightsData {
  const trend =
    period === 'week'
      ? buildWeeklyTrend(records, today)
      : buildMonthlyTrend(records, today);

  const todayStart = startOfDay(today);
  let windowStart: Date;
  let windowRecords: DayRecord[];
  let total: number;
  if (period === 'week') {
    windowStart = mondayOf(today);
    total = daysBetween(windowStart, todayStart) + 1; // 1..7
    windowRecords = records.filter((r) => {
      const d = parseDateKey(r.date);
      return d >= windowStart && d <= todayStart;
    });
  } else {
    windowStart = new Date(today.getFullYear(), today.getMonth(), 1);
    total = today.getDate();
    const ym = monthKey(today);
    windowRecords = records.filter(
      (r) => r.date.slice(0, 7) === ym && parseDateKey(r.date) <= todayStart,
    );
  }
  const habitRates = buildHabitRates(windowRecords, total);
  const habitWindow: HabitWindow = {
    start: toDateKey(windowStart),
    end: toDateKey(todayStart),
    days: total,
  };

  const dates = records.map((r) => r.date);
  const dateSet = new Set(dates);
  const streak = computeStreak(dates, today);

  const last7Recorded: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    last7Recorded.push(dateSet.has(toDateKey(addDays(todayStart, -i))));
  }

  return {
    period,
    trend,
    habitRates,
    habitWindow,
    streak,
    recordedDays: dateSet.size,
    last7Recorded,
  };
}

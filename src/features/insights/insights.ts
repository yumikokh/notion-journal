/**
 * Journal-data aggregations shared across screens.
 *
 * Pure, side-effect-free functions that turn per-day journal records
 * (a subset of `MonthEntry`) into small visualizable slices:
 *   - Daily feeling trend (one point per day — the Reflect week view)
 *   - Habit rates         (achievement % per habit over a window)
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

/** Feeling score scale: happiest = FEELING_MAX, saddest = FEELING_MIN. */
export const FEELING_MIN = 1;
export const FEELING_MAX = FEELINGS.length; // 5

/**
 * FEELINGS is ordered best → worst, so the first face maps to the top of the
 * 1..FEELING_MAX scale. Unknown / empty feelings return null so they are
 * excluded from the trend rather than counted as 0 (which would drag the line
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
  /** Stable bucket identity (the day's date key). */
  key: string;
  /** Short x-axis label, e.g. the weekday `月`. */
  label: string;
  /** Feeling score of the day; null when unrecorded. */
  score: number | null;
  /** Number of recorded days behind the point (0 or 1 for daily trends). */
  count: number;
};

export type HabitRate = {
  key: HabitKey;
  label: string;
  /** Days in the window with the habit checked. */
  checked: number;
  /** Denominator — elapsed days in the window. */
  total: number;
  /** checked / total, clamped to [0, 1]; 0 when total is 0. */
  rate: number;
};

/** Parse a `YYYY-MM-DD` key as a local-midnight Date. */
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/**
 * One trend point per day from `start` to `end` (inclusive date keys).
 * Labels are weekday characters; days without a recorded feeling stay null so
 * the chart breaks the line instead of dropping it to the floor.
 */
export function buildDailyTrend(
  records: DayRecord[],
  start: string,
  end: string,
): TrendPoint[] {
  const scoreByDate = new Map<string, number>();
  for (const rec of records) {
    const score = feelingToScore(rec.feeling);
    if (score != null) scoreByDate.set(rec.date, score);
  }

  const out: TrendPoint[] = [];
  let cursor = parseDateKey(start);
  const last = parseDateKey(end);
  while (cursor <= last) {
    const key = toDateKey(cursor);
    const score = scoreByDate.get(key) ?? null;
    out.push({
      key,
      // Date.getDay(): Sun=0..Sat=6 → Mon-first index: Mon=0..Sun=6.
      label: WEEKDAY_LABELS[(cursor.getDay() + 6) % 7],
      score,
      count: score != null ? 1 : 0,
    });
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * Achievement rate per habit over a window of records.
 * `total` is the elapsed-days denominator the caller has already worked out
 * for the window (e.g. day-of-week so far for the current week).
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

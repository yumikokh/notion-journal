import { describe, expect, it } from '@jest/globals';

import {
  aggregateInsights,
  buildHabitRates,
  buildMonthlyTrend,
  buildWeeklyTrend,
  computeStreak,
  feelingToScore,
  monthsToFetch,
  type DayRecord,
} from './insights';

// Fixed reference date so every test is deterministic.
// 2026-06-05 is a Friday; its Monday is 2026-06-01.
const TODAY = new Date(2026, 5, 5);

const noHabits = {
  output: false,
  book: false,
  design: false,
  english: false,
  exercise: false,
};

function day(date: string, feeling: string | null, habits: Partial<typeof noHabits> = {}): DayRecord {
  return { date, feeling, habits: { ...noHabits, ...habits } };
}

describe('feelingToScore', () => {
  it('maps faces best→worst onto 5..1', () => {
    expect(feelingToScore('(^^)')).toBe(5);
    expect(feelingToScore('(˙-˙)')).toBe(4);
    expect(feelingToScore('(- -)')).toBe(3);
    expect(feelingToScore('(TT)')).toBe(2);
    expect(feelingToScore('(`A´)')).toBe(1);
  });

  it('returns null for empty or unknown feelings', () => {
    expect(feelingToScore(null)).toBeNull();
    expect(feelingToScore('')).toBeNull();
    expect(feelingToScore('🙂')).toBeNull();
  });
});

describe('buildWeeklyTrend', () => {
  it('produces one bucket per week, newest last', () => {
    const trend = buildWeeklyTrend([], TODAY, 6);
    expect(trend).toHaveLength(6);
    // The last bucket is the current week (Monday 2026-06-01).
    expect(trend[5].key).toBe('2026-06-01');
    expect(trend[5].label).toBe('6/1');
    // The first bucket is 5 weeks earlier.
    expect(trend[0].key).toBe('2026-04-27');
  });

  it('averages feeling scores within a week and leaves empty weeks null', () => {
    const records = [
      day('2026-06-01', '(^^)'), // 5
      day('2026-06-03', '(- -)'), // 3  → current-week avg = 4
      day('2026-05-26', '(TT)'), // 2  → previous week (Mon 5/25)
    ];
    const trend = buildWeeklyTrend(records, TODAY, 6);
    const current = trend[5];
    const previous = trend[4];
    expect(current.score).toBe(4);
    expect(current.count).toBe(2);
    expect(previous.score).toBe(2);
    expect(previous.count).toBe(1);
    // A week with no records stays null.
    expect(trend[0].score).toBeNull();
    expect(trend[0].count).toBe(0);
  });

  it('ignores records whose feeling is null', () => {
    const records = [day('2026-06-01', null, { output: true }), day('2026-06-02', '(^^)')];
    const current = buildWeeklyTrend(records, TODAY, 6)[5];
    expect(current.count).toBe(1);
    expect(current.score).toBe(5);
  });
});

describe('buildMonthlyTrend', () => {
  it('produces one bucket per month, newest last', () => {
    const trend = buildMonthlyTrend([], TODAY, 6);
    expect(trend).toHaveLength(6);
    expect(trend[5].key).toBe('2026-06');
    expect(trend[5].label).toBe('6月');
    expect(trend[0].key).toBe('2026-01');
  });

  it('averages by calendar month', () => {
    const records = [
      day('2026-06-01', '(^^)'), // 5
      day('2026-06-20', '(- -)'), // 3 → June avg 4
      day('2026-05-10', '(TT)'), // 2 → May
    ];
    const trend = buildMonthlyTrend(records, TODAY, 6);
    expect(trend[5].score).toBe(4);
    expect(trend[5].count).toBe(2);
    expect(trend[4].score).toBe(2);
  });
});

describe('buildHabitRates', () => {
  it('counts checked days and divides by the elapsed-days total', () => {
    const records = [
      day('2026-06-01', null, { output: true, book: true }),
      day('2026-06-02', null, { output: true }),
    ];
    const rates = buildHabitRates(records, 5);
    const output = rates.find((r) => r.key === 'output')!;
    const book = rates.find((r) => r.key === 'book')!;
    const exercise = rates.find((r) => r.key === 'exercise')!;
    expect(output.checked).toBe(2);
    expect(output.rate).toBeCloseTo(0.4);
    expect(book.checked).toBe(1);
    expect(exercise.rate).toBe(0);
  });

  it('matches habit keys case-insensitively (Notion property names are capitalized)', () => {
    // Notion-month-get keys habits by the raw property name, e.g. "Output".
    const records: DayRecord[] = [
      { date: '2026-06-01', feeling: null, habits: { Output: true, Exercise: true } },
      { date: '2026-06-02', feeling: null, habits: { Output: true } },
    ];
    const rates = buildHabitRates(records, 2);
    expect(rates.find((r) => r.key === 'output')!.checked).toBe(2);
    expect(rates.find((r) => r.key === 'exercise')!.checked).toBe(1);
  });

  it('returns every habit and clamps rate to <= 1', () => {
    const records = [day('2026-06-01', null, { output: true })];
    const rates = buildHabitRates(records, 0); // 0 denominator → no division by zero
    expect(rates).toHaveLength(5);
    expect(rates.every((r) => r.rate >= 0 && r.rate <= 1)).toBe(true);
  });
});

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    const dates = ['2026-06-03', '2026-06-04', '2026-06-05'];
    const streak = computeStreak(dates, TODAY);
    expect(streak.current).toBe(3);
    expect(streak.recordedToday).toBe(true);
    expect(streak.longest).toBe(3);
  });

  it('keeps the streak alive from yesterday when today is unlogged', () => {
    const dates = ['2026-06-02', '2026-06-03', '2026-06-04']; // up to yesterday
    const streak = computeStreak(dates, TODAY);
    expect(streak.current).toBe(3);
    expect(streak.recordedToday).toBe(false);
  });

  it('breaks when neither today nor yesterday is recorded', () => {
    const dates = ['2026-06-01', '2026-06-02'];
    const streak = computeStreak(dates, TODAY);
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(2);
  });

  it('finds the longest run across gaps', () => {
    const dates = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-20', '2026-06-05'];
    const streak = computeStreak(dates, TODAY);
    expect(streak.longest).toBe(3);
    expect(streak.current).toBe(1);
  });

  it('handles an empty set', () => {
    const streak = computeStreak([], TODAY);
    expect(streak).toEqual({ current: 0, longest: 0, recordedToday: false });
  });
});

describe('monthsToFetch', () => {
  it('returns the last 6 calendar months for the month period', () => {
    expect(monthsToFetch('month', TODAY)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });

  it('covers every month touched by the 6-week window', () => {
    // Oldest Monday = 2026-06-01 − 5 weeks = 2026-04-27, so April–June.
    expect(monthsToFetch('week', TODAY)).toEqual(['2026-04', '2026-05', '2026-06']);
  });
});

describe('aggregateInsights', () => {
  const records = [
    day('2026-06-01', '(^^)', { output: true }),
    day('2026-06-04', '(- -)', { output: true, book: true }),
    day('2026-06-05', '(˙-˙)', { output: true }),
  ];

  it('builds weekly trend and current-week habit rates', () => {
    const data = aggregateInsights('week', records, TODAY);
    expect(data.period).toBe('week');
    expect(data.trend).toHaveLength(6);
    expect(data.recordedDays).toBe(3);
    // Current week (Mon 6/1 .. Fri 6/5) → 5 elapsed days.
    const output = data.habitRates.find((r) => r.key === 'output')!;
    expect(output.total).toBe(5);
    expect(output.checked).toBe(3);
    expect(output.rate).toBeCloseTo(0.6);
  });

  it('uses day-of-month as the denominator for the month period', () => {
    const data = aggregateInsights('month', records, TODAY);
    const output = data.habitRates.find((r) => r.key === 'output')!;
    expect(output.total).toBe(5); // June 5th
    expect(output.checked).toBe(3);
  });

  it('exposes the habit window range per period', () => {
    const week = aggregateInsights('week', records, TODAY);
    // Current week: Monday 6/1 → today 6/5.
    expect(week.habitWindow).toEqual({ start: '2026-06-01', end: '2026-06-05', days: 5 });

    const month = aggregateInsights('month', records, TODAY);
    // Current month: 6/1 → today 6/5.
    expect(month.habitWindow).toEqual({ start: '2026-06-01', end: '2026-06-05', days: 5 });
  });

  it('reports the last 7 days as recorded flags ending today', () => {
    const data = aggregateInsights('week', records, TODAY);
    // index 6 = today (6/5, recorded), index 5 = 6/4 (recorded), index 3 = 6/2 (no)
    expect(data.last7Recorded).toHaveLength(7);
    expect(data.last7Recorded[6]).toBe(true);
    expect(data.last7Recorded[5]).toBe(true);
    expect(data.last7Recorded[3]).toBe(false);
    expect(data.streak.current).toBe(2); // 6/4 + 6/5
  });
});

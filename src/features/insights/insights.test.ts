import { describe, expect, it } from '@jest/globals';

import {
  buildDailyTrend,
  buildHabitRates,
  feelingToScore,
  type DayRecord,
} from './insights';

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

describe('buildDailyTrend', () => {
  it('produces one point per day with weekday labels, Monday first', () => {
    const trend = buildDailyTrend([], '2026-06-01', '2026-06-07');
    expect(trend).toHaveLength(7);
    expect(trend.map((p) => p.key)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ]);
    expect(trend.map((p) => p.label)).toEqual(['月', '火', '水', '木', '金', '土', '日']);
  });

  it('maps recorded feelings onto their day and leaves gaps null', () => {
    const records = [
      day('2026-06-01', '(^^)'), // 5
      day('2026-06-03', '(- -)'), // 3
      day('2026-06-04', null, { output: true }), // habit only → no score
    ];
    const trend = buildDailyTrend(records, '2026-06-01', '2026-06-07');
    expect(trend[0]).toMatchObject({ score: 5, count: 1 });
    expect(trend[1]).toMatchObject({ score: null, count: 0 });
    expect(trend[2]).toMatchObject({ score: 3, count: 1 });
    expect(trend[3]).toMatchObject({ score: null, count: 0 });
  });

  it('ignores records outside the range', () => {
    const records = [day('2026-05-31', '(^^)'), day('2026-06-08', '(^^)')];
    const trend = buildDailyTrend(records, '2026-06-01', '2026-06-07');
    expect(trend.every((p) => p.score === null)).toBe(true);
  });

  it('returns an empty list when end is before start', () => {
    expect(buildDailyTrend([], '2026-06-07', '2026-06-01')).toEqual([]);
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

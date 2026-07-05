import { describe, expect, it } from '@jest/globals';

import {
  formatWeekLabel,
  getWeekRange,
  isSameWeek,
  relativeWeekLabel,
  shiftWeek,
  weekElapsedDays,
} from './week-range';

describe('getWeekRange', () => {
  it('anchors to Monday for a mid-week date', () => {
    // 2026-05-20 is a Wednesday.
    expect(getWeekRange(new Date(2026, 4, 20))).toEqual({
      start: '2026-05-18',
      end: '2026-05-24',
    });
  });

  it('returns the same week when given the Monday itself', () => {
    expect(getWeekRange(new Date(2026, 4, 18))).toEqual({
      start: '2026-05-18',
      end: '2026-05-24',
    });
  });

  it('keeps Sunday in the prior week (Monday-anchored)', () => {
    // 2026-05-24 is the Sunday closing the week starting 2026-05-18.
    expect(getWeekRange(new Date(2026, 4, 24))).toEqual({
      start: '2026-05-18',
      end: '2026-05-24',
    });
  });

  it('handles month boundaries', () => {
    // 2026-06-01 is a Monday — should anchor to itself.
    expect(getWeekRange(new Date(2026, 5, 1))).toEqual({
      start: '2026-06-01',
      end: '2026-06-07',
    });
    // 2026-05-31 (Sunday) belongs to the week starting 2026-05-25.
    expect(getWeekRange(new Date(2026, 4, 31))).toEqual({
      start: '2026-05-25',
      end: '2026-05-31',
    });
  });

  it('handles year boundary (Mon 2025-12-29 → Sun 2026-01-04)', () => {
    expect(getWeekRange(new Date(2026, 0, 3))).toEqual({
      start: '2025-12-29',
      end: '2026-01-04',
    });
  });
});

describe('shiftWeek', () => {
  const base = { start: '2026-05-18', end: '2026-05-24' };

  it('shifts back by one week', () => {
    expect(shiftWeek(base, -1)).toEqual({ start: '2026-05-11', end: '2026-05-17' });
  });

  it('shifts forward by one week', () => {
    expect(shiftWeek(base, 1)).toEqual({ start: '2026-05-25', end: '2026-05-31' });
  });

  it('shifts across a month boundary', () => {
    expect(shiftWeek(base, 2)).toEqual({ start: '2026-06-01', end: '2026-06-07' });
  });

  it('shifts across a year boundary', () => {
    const newYearWeek = { start: '2025-12-29', end: '2026-01-04' };
    expect(shiftWeek(newYearWeek, -1)).toEqual({ start: '2025-12-22', end: '2025-12-28' });
  });

  it('round-trip: -n then +n returns the original week', () => {
    expect(shiftWeek(shiftWeek(base, -3), 3)).toEqual(base);
  });
});

describe('isSameWeek', () => {
  it('compares by start date', () => {
    expect(
      isSameWeek({ start: '2026-05-18', end: '2026-05-24' }, { start: '2026-05-18', end: '2026-05-24' }),
    ).toBe(true);
    expect(
      isSameWeek({ start: '2026-05-18', end: '2026-05-24' }, { start: '2026-05-11', end: '2026-05-17' }),
    ).toBe(false);
  });
});

describe('formatWeekLabel', () => {
  it('formats same-month range', () => {
    expect(formatWeekLabel({ start: '2026-05-18', end: '2026-05-24' })).toBe('5/18 - 5/24');
  });

  it('formats cross-month range', () => {
    expect(formatWeekLabel({ start: '2026-05-25', end: '2026-05-31' })).toBe('5/25 - 5/31');
    expect(formatWeekLabel({ start: '2026-06-01', end: '2026-06-07' })).toBe('6/1 - 6/7');
  });
});

describe('weekElapsedDays', () => {
  const week = { start: '2026-06-01', end: '2026-06-07' }; // Mon–Sun

  it('returns 7 for a completed past week', () => {
    expect(weekElapsedDays(week, new Date(2026, 5, 10))).toBe(7);
  });

  it('counts Monday→today for the current week', () => {
    expect(weekElapsedDays(week, new Date(2026, 5, 1))).toBe(1); // Monday
    expect(weekElapsedDays(week, new Date(2026, 5, 5))).toBe(5); // Friday
    expect(weekElapsedDays(week, new Date(2026, 5, 7))).toBe(7); // Sunday
  });

  it('returns 0 for a week that has not started', () => {
    expect(weekElapsedDays(week, new Date(2026, 4, 31))).toBe(0);
  });

  it('ignores the time of day', () => {
    expect(weekElapsedDays(week, new Date(2026, 5, 5, 23, 59))).toBe(5);
  });
});

describe('relativeWeekLabel', () => {
  const today = new Date(2026, 4, 25); // Mon 2026-05-25

  it('returns 今週 for the current week', () => {
    expect(relativeWeekLabel({ start: '2026-05-25', end: '2026-05-31' }, today)).toBe('今週');
  });

  it('returns 先週 for the previous week', () => {
    expect(relativeWeekLabel({ start: '2026-05-18', end: '2026-05-24' }, today)).toBe('先週');
  });

  it('returns null for older weeks', () => {
    expect(relativeWeekLabel({ start: '2026-05-11', end: '2026-05-17' }, today)).toBeNull();
  });

  it('returns null for future weeks', () => {
    expect(relativeWeekLabel({ start: '2026-06-01', end: '2026-06-07' }, today)).toBeNull();
  });
});

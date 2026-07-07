import { describe, expect, it } from '@jest/globals';

import {
  formatWeekLabel,
  getWeekRange,
  groupWeeksByMonth,
  isSameWeek,
  listRecentWeeks,
  listWeeksSince,
  relativeWeekLabel,
  shiftWeek,
  weekElapsedDays,
  weekName,
  weekStartOf,
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

describe('weekName', () => {
  it('numbers weeks by their Monday within the month', () => {
    expect(weekName({ start: '2026-07-06', end: '2026-07-12' })).toBe('7月 第1週');
    expect(weekName({ start: '2026-07-13', end: '2026-07-19' })).toBe('7月 第2週');
    expect(weekName({ start: '2026-07-27', end: '2026-08-02' })).toBe('7月 第4週');
  });

  it('assigns a month-crossing week to its Monday month', () => {
    expect(weekName({ start: '2026-06-29', end: '2026-07-05' })).toBe('6月 第5週');
    expect(weekName({ start: '2025-12-29', end: '2026-01-04' })).toBe('12月 第5週');
  });

  it('treats a Monday on the 1st as 第1週', () => {
    expect(weekName({ start: '2026-06-01', end: '2026-06-07' })).toBe('6月 第1週');
  });
});

describe('listWeeksSince', () => {
  // 2026-06-05 is a Friday; its week starts Monday 2026-06-01.
  const today = new Date(2026, 5, 5);

  it('spans from the earliest entry week to the current week', () => {
    const weeks = listWeeksSince('2026-05-20', today); // Wed → week of 5/18
    expect(weeks[0]).toEqual({ start: '2026-05-18', end: '2026-05-24' });
    expect(weeks[weeks.length - 1]).toEqual({ start: '2026-06-01', end: '2026-06-07' });
    expect(weeks).toHaveLength(3);
  });

  it('returns just the current week when earliest is inside it', () => {
    expect(listWeeksSince('2026-06-03', today)).toEqual([
      { start: '2026-06-01', end: '2026-06-07' },
    ]);
  });
});

describe('weekStartOf', () => {
  it('returns the Monday of the containing week', () => {
    expect(weekStartOf('2026-07-05')).toBe('2026-06-29'); // Sunday → its Monday
    expect(weekStartOf('2026-07-06')).toBe('2026-07-06'); // Monday → itself
    expect(weekStartOf('2026-07-09')).toBe('2026-07-06'); // mid-week
  });
});

describe('listRecentWeeks', () => {
  // 2026-06-05 is a Friday; its week starts Monday 2026-06-01.
  const today = new Date(2026, 5, 5);

  it('ends at the current week, oldest first', () => {
    const weeks = listRecentWeeks(today, 3);
    expect(weeks).toEqual([
      { start: '2026-05-18', end: '2026-05-24' },
      { start: '2026-05-25', end: '2026-05-31' },
      { start: '2026-06-01', end: '2026-06-07' },
    ]);
  });

  it('returns exactly `count` consecutive weeks', () => {
    const weeks = listRecentWeeks(today, 10);
    expect(weeks).toHaveLength(10);
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i]).toEqual(shiftWeek(weeks[i - 1], 1));
    }
  });
});

describe('groupWeeksByMonth', () => {
  it('groups consecutive weeks by their Monday month, oldest first', () => {
    const weeks = [
      { start: '2025-12-22', end: '2025-12-28' },
      { start: '2025-12-29', end: '2026-01-04' }, // year-crossing → 2025-12
      { start: '2026-01-05', end: '2026-01-11' },
      { start: '2026-01-12', end: '2026-01-18' },
    ];
    const groups = groupWeeksByMonth(weeks);
    expect(groups.map((g) => [g.year, g.month])).toEqual([
      [2025, 12],
      [2026, 1],
    ]);
    expect(groups[0].weeks.map((w) => w.start)).toEqual(['2025-12-22', '2025-12-29']);
    expect(groups[1].weeks.map((w) => w.start)).toEqual(['2026-01-05', '2026-01-12']);
  });

  it('handles an empty list', () => {
    expect(groupWeeksByMonth([])).toEqual([]);
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

import { describe, expect, it } from '@jest/globals';

import { buildMonthWeeks } from './build-month-grid';

describe('buildMonthWeeks', () => {
  it('returns only the weeks the month actually spans', () => {
    // May 2026: May 1 = Friday, 31 days → 5 leading cells + 31 = 36 → 6 weeks
    expect(buildMonthWeeks(2026, 4).length).toBe(6);
    // June 2026: Jun 1 = Monday, 30 days → 1 leading + 30 = 31 → 5 weeks
    expect(buildMonthWeeks(2026, 5).length).toBe(5);
    // February 2026: Feb 1 = Sunday, 28 days → exactly 4 weeks
    expect(buildMonthWeeks(2026, 1).length).toBe(4);
  });

  it('keeps every week at exactly 7 cells', () => {
    for (const weeks of [buildMonthWeeks(2026, 4), buildMonthWeeks(2026, 1)]) {
      for (const week of weeks) {
        expect(week.length).toBe(7);
      }
    }
  });

  it('marks every day of the requested month as in-month', () => {
    const cells = buildMonthWeeks(2026, 4).flat(); // May 2026 — 31 days
    const inMonth = cells.filter((c) => c.inMonth);
    expect(inMonth.length).toBe(31);
    expect(inMonth[0].dateKey).toBe('2026-05-01');
    expect(inMonth[30].dateKey).toBe('2026-05-31');
  });

  it('starts weeks on Sunday and ends them on Saturday', () => {
    const weeks = buildMonthWeeks(2026, 4);
    for (const week of weeks) {
      expect(week[0].date.getDay()).toBe(0); // Sun
      expect(week[6].date.getDay()).toBe(6); // Sat
    }
  });

  it('fills leading days from the previous month as out-of-month cells', () => {
    // June 1, 2026 is a Monday → leading day is May 31 (Sunday)
    const cells = buildMonthWeeks(2026, 5).flat();
    expect(cells[0].dateKey).toBe('2026-05-31');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].dateKey).toBe('2026-06-01');
    expect(cells[1].inMonth).toBe(true);
  });

  it('fills trailing days from the next month as out-of-month cells', () => {
    // May 31, 2026 is a Sunday → trailing days Mon Jun 1 … Sat Jun 6
    const cells = buildMonthWeeks(2026, 4).flat();
    const may31 = cells.find((c) => c.dateKey === '2026-05-31');
    expect(may31?.inMonth).toBe(true);
    const jun1 = cells.find((c) => c.dateKey === '2026-06-01');
    expect(jun1?.inMonth).toBe(false);
    expect(cells[cells.length - 1].dateKey).toBe('2026-06-06');
  });

  it('handles year boundaries (December 2026 → January 2027)', () => {
    const cells = buildMonthWeeks(2026, 11).flat();
    const dec31 = cells.find((c) => c.dateKey === '2026-12-31');
    expect(dec31?.inMonth).toBe(true);
    const jan1 = cells.find((c) => c.dateKey === '2027-01-01');
    expect(jan1?.inMonth).toBe(false);
  });
});

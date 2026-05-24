import { describe, expect, it } from '@jest/globals';

import { buildMonthGrid } from './build-month-grid';

describe('buildMonthGrid', () => {
  it('always produces a 42-cell grid (6 weeks × 7 days)', () => {
    expect(buildMonthGrid(2026, 4).length).toBe(42);
    expect(buildMonthGrid(2026, 1).length).toBe(42); // February
  });

  it('marks every day of the requested month as in-month', () => {
    const cells = buildMonthGrid(2026, 4); // May 2026 — 31 days
    const inMonth = cells.filter((c) => c.inMonth);
    expect(inMonth.length).toBe(31);
    expect(inMonth[0].dateKey).toBe('2026-05-01');
    expect(inMonth[30].dateKey).toBe('2026-05-31');
  });

  it('starts on a Sunday and ends on a Saturday', () => {
    const cells = buildMonthGrid(2026, 4);
    expect(cells[0].date.getDay()).toBe(0); // Sun
    expect(cells[41].date.getDay()).toBe(6); // Sat
  });

  it('fills leading days from the previous month', () => {
    // June 1, 2026 is a Monday → leading day is May 31 (Sunday)
    const cells = buildMonthGrid(2026, 5);
    expect(cells[0].dateKey).toBe('2026-05-31');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].dateKey).toBe('2026-06-01');
    expect(cells[1].inMonth).toBe(true);
  });

  it('fills trailing days from the next month', () => {
    // May 2026: 31 days, May 1 = Friday → leading: Sun-Thu (Apr 26-30)
    // first row: Apr 26, 27, 28, 29, 30, May 1, 2 → May 1 at index 5
    // last day of May (31) is Sunday → trailing days start Mon Jun 1
    const cells = buildMonthGrid(2026, 4);
    const may31 = cells.find((c) => c.dateKey === '2026-05-31');
    expect(may31?.inMonth).toBe(true);
    const jun1 = cells.find((c) => c.dateKey === '2026-06-01');
    expect(jun1?.inMonth).toBe(false);
  });

  it('handles year boundaries (December 2026 → January 2027)', () => {
    const cells = buildMonthGrid(2026, 11);
    const dec31 = cells.find((c) => c.dateKey === '2026-12-31');
    expect(dec31?.inMonth).toBe(true);
    const jan1 = cells.find((c) => c.dateKey === '2027-01-01');
    expect(jan1?.inMonth).toBe(false);
  });
});

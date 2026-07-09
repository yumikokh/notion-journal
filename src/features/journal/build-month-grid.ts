import { toDateKey } from '@/lib/date';

export type MonthCell = {
  /** The calendar date this cell represents. */
  date: Date;
  /** Same date as `YYYY-MM-DD` for use as a map key. */
  dateKey: string;
  /** False for leading/trailing days from adjacent months. */
  inMonth: boolean;
};

/**
 * Build the weeks of a month as rows of 7 cells, Sunday-first.
 *
 * Unlike a fixed 6-week grid, this returns only the weeks the month
 * actually spans (4–6), so months can be stacked in a continuous
 * vertical scroll without dead rows. Leading/trailing cells that belong
 * to adjacent months are included to keep rows at 7 cells but marked
 * `inMonth: false` (the calendar renders them blank — the adjacent month
 * owns those days in its own section).
 *
 * `year` is the full year (e.g. 2026). `month` is **0-indexed** to match
 * the JavaScript `Date` constructor (0 = January, 11 = December).
 */
export function buildMonthWeeks(year: number, month: number): MonthCell[][] {
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
  const start = new Date(year, month, 1 - firstDayOfWeek);

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < totalCells; i++) {
    if (i % 7 === 0) weeks.push([]);
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    weeks[weeks.length - 1].push({
      date: d,
      dateKey: toDateKey(d),
      inMonth: d.getMonth() === month && d.getFullYear() === year,
    });
  }
  return weeks;
}

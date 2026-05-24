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
 * Build a 6-week × 7-day grid (42 cells) for the given month.
 *
 * Week starts on **Sunday** (locale-independent). Leading days come from
 * the previous month, trailing days from the next month, so the grid is
 * always exactly 42 cells and rendered as a flat list.
 *
 * `year` is the full year (e.g. 2026). `month` is **0-indexed** to match
 * the JavaScript `Date` constructor (0 = January, 11 = December).
 */
export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
  const start = new Date(year, month, 1 - firstDayOfWeek);

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      dateKey: toDateKey(d),
      inMonth: d.getMonth() === month && d.getFullYear() === year,
    });
  }
  return cells;
}

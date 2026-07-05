import type { MonthEntry } from '@/lib/supabase';

export type JournalDayItem = {
  /** YYYY-MM-DD */
  dateKey: string;
  /** The Notion entry for the day, when one exists (may be habit-only). */
  entry: MonthEntry | null;
  /**
   * True when the day has journal content worth a full card (diary text or
   * a cover photo). Days without it render as a slim "未記入" row that
   * invites filling the day in.
   */
  hasContent: boolean;
};

/**
 * Every day of a month in reading order (the 1st at the top — each month
 * page reads front-to-back like a book), including days with no entry yet.
 * Future days are omitted so the current month ends at today.
 */
export function buildMonthDayItems(
  yearMonth: string,
  entries: MonthEntry[],
  todayKey: string,
): JournalDayItem[] {
  const [yearStr, monthStr] = yearMonth.split('-');
  const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const byDate = new Map(entries.map((e) => [e.date, e]));

  const items: JournalDayItem[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${yearMonth}-${String(day).padStart(2, '0')}`;
    if (dateKey > todayKey) break;
    const entry = byDate.get(dateKey) ?? null;
    const hasContent =
      entry !== null && ((entry.diary ?? '').trim().length > 0 || entry.coverUrl !== null);
    items.push({ dateKey, entry, hasContent });
  }
  return items;
}

/**
 * Shift a `YYYY-MM` string by `delta` months (may be negative). Handles
 * year boundaries, e.g. `shiftYearMonth('2026-01', -1) === '2025-12'`.
 */
export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // 0-indexed
  const total = year * 12 + monthIndex + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonthIndex = ((total % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}`;
}

/** Format a `YYYY-MM` string as a Japanese section header, e.g. "2026年7月". */
export function formatMonthHeader(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  return `${Number(yearStr)}年${Number(monthStr)}月`;
}

/**
 * Months selectable in the journal list's month picker: the current month
 * followed by `monthsBack` older months, newest first.
 */
export function buildMonthOptions(currentYearMonth: string, monthsBack: number): string[] {
  const options: string[] = [];
  for (let offset = 0; offset >= -monthsBack; offset--) {
    options.push(shiftYearMonth(currentYearMonth, offset));
  }
  return options;
}

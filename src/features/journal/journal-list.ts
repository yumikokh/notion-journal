import type { MonthEntry } from '@/lib/supabase';

/**
 * Entries worth showing in the journal list screen: those with diary text
 * or a cover photo, newest first. Entries with neither are dropped (e.g.
 * placeholder pages created only to track habits).
 */
export function selectJournalListEntries(entries: MonthEntry[]): MonthEntry[] {
  const filtered = entries.filter(
    (entry) => (entry.diary ?? '').trim().length > 0 || entry.coverUrl !== null,
  );
  return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
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

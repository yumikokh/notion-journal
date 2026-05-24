/**
 * Date helpers for journal entries.
 *
 * Journals are keyed by local calendar date. The Notion daily page title
 * follows the `@<Month> <Day>, <Year>` format (e.g. `@May 7, 2026`).
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Local-time `YYYY-MM-DD` key used to identify a journal entry. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Notion daily page title, e.g. `@May 7, 2026`. */
export function formatJournalTitle(date: Date): string {
  return `@${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Returns a new Date shifted by `days`, without mutating the input. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

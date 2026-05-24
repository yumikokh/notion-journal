import * as JapaneseHolidays from 'japanese-holidays';

/**
 * Returns the Japanese holiday name for a date, or null when it isn't one.
 * `furikae` (substitute holidays for Sunday-falling national holidays) is
 * always on — the user expects the calendar to mark the Monday in those cases.
 */
export function getJapaneseHoliday(date: Date): string | null {
  const result = JapaneseHolidays.isHoliday(date, true);
  return typeof result === 'string' ? result : null;
}

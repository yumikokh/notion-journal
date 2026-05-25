import type { QueryClient } from '@tanstack/react-query';

import type { MonthEntry } from '@/lib/supabase';

import { loadReminderSettings } from './reminder-prefs';
import { rescheduleReminders, type RescheduleResult } from './scheduler';

/**
 * Collect `YYYY-MM-DD` keys of journal entries that are already in the
 * TanStack Query cache for the months touched by the scheduling horizon.
 *
 * We deliberately read from the cache only (no network) so reminder
 * rescheduling — which can run on app foregrounding, save-success, or a
 * settings toggle — never blocks on a Notion round-trip. Months the user
 * hasn't visited simply contribute an empty set; the worst case is a
 * spurious reminder on an already-recorded day, which the next sync after
 * the user opens the calendar will correct.
 */
export function collectRecordedDatesFromCache(
  qc: QueryClient,
  now: Date,
  horizonDays: number,
): Set<string> {
  const months = new Set<string>();
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.add(ym);
  }
  const recorded = new Set<string>();
  for (const ym of months) {
    const data = qc.getQueryData<MonthEntry[]>(['journal', 'month', ym]);
    if (!data) continue;
    for (const e of data) recorded.add(e.date);
  }
  return recorded;
}

const HORIZON_DAYS = 14;

/**
 * Load the latest settings and reschedule, using whatever month data is
 * already cached to compute the `recorded` set. Safe to call repeatedly.
 */
export async function rescheduleFromCache(
  qc: QueryClient,
  now: Date = new Date(),
): Promise<RescheduleResult> {
  const settings = await loadReminderSettings();
  const recordedDates = collectRecordedDatesFromCache(qc, now, HORIZON_DAYS);
  return rescheduleReminders({ settings, recordedDates, now });
}

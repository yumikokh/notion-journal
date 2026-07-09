import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  buildDailyTrend,
  buildHabitRates,
  type DayRecord,
  type HabitRate,
  type TrendPoint,
} from '@/features/insights/insights';
import { invokeNotionMonthGet, type MonthEntry } from '@/lib/supabase';

import { weekElapsedDays, type WeekRange } from './week-range';

export type WeekInsightsData = {
  /** One point per day, Monday → Sunday; unrecorded days are null. */
  trend: TrendPoint[];
  /** Achievement per habit over the elapsed part of the week. */
  habitRates: HabitRate[];
  /** Elapsed-days denominator (7 for past weeks, 1..7 for the current one). */
  elapsedDays: number;
  /** Distinct recorded days inside the week (drives the empty state). */
  recordedDays: number;
};

export type UseWeekInsightsResult = {
  data: WeekInsightsData;
  isLoading: boolean;
};

/**
 * Fetch the month(s) the selected week touches and derive the week's chart
 * data. Reuses the calendar's `['journal','month',ym]` query key so
 * already-viewed months hydrate instantly and the reads stay persisted.
 */
export function useWeekInsights(
  range: WeekRange,
  today: Date,
  options: { enabled?: boolean } = {},
): UseWeekInsightsResult {
  const enabled = options.enabled ?? true;

  // A Monday→Sunday week spans at most two calendar months.
  const months = useMemo(
    () => [...new Set([range.start.slice(0, 7), range.end.slice(0, 7)])],
    [range.start, range.end],
  );

  const results = useQueries({
    queries: months.map((yearMonth) => ({
      queryKey: ['journal', 'month', yearMonth] as const,
      queryFn: async (): Promise<MonthEntry[]> => {
        const { entries } = await invokeNotionMonthGet({ yearMonth });
        return entries;
      },
      // Match useMonthEntries so shared cache entries age consistently.
      staleTime: 5 * 60 * 1000,
      enabled,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);

  // Re-derive only when the underlying query data actually changes.
  const updatedSignal = results.map((r) => r.dataUpdatedAt).join(',');
  const records = useMemo<DayRecord[]>(() => {
    const byDate = new Map<string, DayRecord>();
    for (const result of results) {
      for (const entry of result.data ?? []) {
        if (entry.date < range.start || entry.date > range.end) continue;
        byDate.set(entry.date, {
          date: entry.date,
          feeling: entry.feeling,
          habits: entry.habits,
        });
      }
    }
    return [...byDate.values()];
  }, [updatedSignal, range.start, range.end]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayKey = today.toISOString().slice(0, 10);
  const data = useMemo<WeekInsightsData>(
    () => ({
      trend: buildDailyTrend(records, range.start, range.end),
      habitRates: buildHabitRates(records, weekElapsedDays(range, today)),
      elapsedDays: weekElapsedDays(range, today),
      recordedDays: records.length,
    }),
    [records, range.start, range.end, todayKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { data, isLoading };
}

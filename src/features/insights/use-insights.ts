import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { invokeNotionMonthGet, type MonthEntry } from '@/lib/supabase';

import {
  aggregateInsights,
  monthsToFetch,
  type DayRecord,
  type InsightsData,
  type InsightsPeriod,
} from './insights';

type UseInsightsOptions = {
  enabled?: boolean;
};

export type UseInsightsResult = {
  data: InsightsData;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
};

/**
 * Fetch the months needed for the selected period and aggregate them into the
 * dashboard data. Reuses the calendar's `['journal','month',ym]` query key so
 * already-viewed months hydrate instantly and the reads stay persisted.
 */
export function useInsights(
  period: InsightsPeriod,
  today: Date,
  options: UseInsightsOptions = {},
): UseInsightsResult {
  const enabled = options.enabled ?? true;
  const todayKey = today.toISOString().slice(0, 10);

  const months = useMemo(() => monthsToFetch(period, today), [period, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useQueries({
    queries: months.map((yearMonth) => ({
      queryKey: ['journal', 'month', yearMonth] as const,
      queryFn: async (): Promise<MonthEntry[]> => {
        const { entries } = await invokeNotionMonthGet({ yearMonth });
        return entries;
      },
      enabled,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const isFetching = results.some((r) => r.isFetching);
  const error = (results.find((r) => r.error)?.error as Error | undefined) ?? null;

  // Re-derive only when the underlying query data actually changes.
  const updatedSignal = results.map((r) => r.dataUpdatedAt).join(',');
  const records = useMemo<DayRecord[]>(() => {
    const byDate = new Map<string, DayRecord>();
    for (const result of results) {
      for (const entry of result.data ?? []) {
        byDate.set(entry.date, {
          date: entry.date,
          feeling: entry.feeling,
          habits: entry.habits,
        });
      }
    }
    return [...byDate.values()];
  }, [updatedSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(
    () => aggregateInsights(period, records, today),
    [period, records, todayKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch: () => results.forEach((r) => r.refetch()),
  };
}

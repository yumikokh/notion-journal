import { useQuery } from '@tanstack/react-query';

import { invokeNotionMonthGet, type MonthEntry } from '@/lib/supabase';

type UseMonthEntriesOptions = {
  enabled?: boolean;
};

/**
 * Fetch all journal entries for a given month (YYYY-MM).
 * Returns minimal info per day (date + feeling + pageId) for the
 * calendar grid; full entry data is loaded per-day on demand.
 */
export function useMonthEntries(yearMonth: string, options: UseMonthEntriesOptions = {}) {
  return useQuery<MonthEntry[]>({
    queryKey: ['journal', 'month', yearMonth],
    queryFn: async () => {
      const { entries } = await invokeNotionMonthGet({ yearMonth });
      return entries;
    },
    enabled: options.enabled ?? true,
  });
}

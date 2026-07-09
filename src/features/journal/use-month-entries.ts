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
    // Months mount/unmount constantly while the continuous calendar scrolls;
    // without a staleTime every remount would refire the Notion query.
    staleTime: 5 * 60 * 1000,
    enabled: options.enabled ?? true,
  });
}

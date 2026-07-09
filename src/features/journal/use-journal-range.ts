import { useQuery } from '@tanstack/react-query';

import { invokeNotionJournalRange } from '@/lib/supabase';

type UseJournalRangeOptions = {
  /** Skip the query (e.g. when Supabase env isn't configured yet). */
  enabled?: boolean;
};

/**
 * The earliest Daily entry date — the real lower bound for week/month
 * pickers. The value only ever moves when history is backfilled, so it is
 * cached long and persisted; callers fall back to a fixed window while it
 * loads (or when the Edge Function isn't deployed).
 */
export function useJournalRange(options: UseJournalRangeOptions = {}) {
  return useQuery<string | null>({
    queryKey: ['journal', 'range'],
    queryFn: async () => (await invokeNotionJournalRange()).earliest,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    enabled: options.enabled ?? true,
  });
}

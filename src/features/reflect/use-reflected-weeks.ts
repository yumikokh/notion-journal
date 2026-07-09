import { useQuery } from '@tanstack/react-query';

import { invokeNotionWeeklyList } from '@/lib/supabase';

import { weekStartOf } from './week-range';

type UseReflectedWeeksOptions = {
  /** Skip the query (e.g. when Supabase env isn't configured yet). */
  enabled?: boolean;
};

/**
 * The set of week-start (Monday) keys that already have a saved weekly
 * reflection in Notion — one list call instead of a per-week lookup. Backs
 * the reflected marks in the week picker; when the query fails (e.g. the
 * Edge Function isn't deployed yet) callers get `undefined` and simply
 * render no marks.
 */
export function useReflectedWeeks(options: UseReflectedWeeksOptions = {}) {
  return useQuery<string[], Error, Set<string>>({
    queryKey: ['weekly-reflection', 'list'],
    queryFn: async () => (await invokeNotionWeeklyList()).dates,
    // Saved pages can be dated on any day inside their week — normalize.
    select: (dates) => new Set(dates.map(weekStartOf)),
    staleTime: 60 * 1000,
    retry: 1,
    enabled: options.enabled ?? true,
  });
}

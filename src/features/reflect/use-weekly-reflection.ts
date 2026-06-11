import { useQuery } from '@tanstack/react-query';

import { invokeNotionWeeklyGet } from '@/lib/supabase';

import { notionPageToWeeklyReflection, type WeeklyReflection } from './weekly-reflection';
import type { WeekRange } from './week-range';

type UseWeeklyReflectionOptions = {
  /** Skip the query (e.g. when Supabase env isn't configured yet). */
  enabled?: boolean;
};

/**
 * Fetch the weekly reflection (Reflection DB, Type=Weekly) for a range.
 *
 * Keyed by `[weekStart, weekEnd]` so switching to a previously-loaded week
 * paints from cache instantly and revalidates in the background
 * (stale-while-revalidate, per DATA_MODEL.md). Unlike the AI weekly
 * analysis, this is durable Notion data, so it uses the default staleTime.
 */
export function useWeeklyReflection(range: WeekRange, options: UseWeeklyReflectionOptions = {}) {
  return useQuery<WeeklyReflection>({
    queryKey: ['weekly-reflection', range.start, range.end],
    queryFn: async () => {
      const { page, bodyMarkdown } = await invokeNotionWeeklyGet({
        weekStart: range.start,
        weekEnd: range.end,
      });
      return notionPageToWeeklyReflection(page, range.start, range.end, bodyMarkdown);
    },
    enabled: options.enabled ?? true,
  });
}

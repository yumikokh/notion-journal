import { useQuery } from '@tanstack/react-query';

import { notionPageToSnapshot } from '@/features/notion/mapping';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import { invokeNotionTodayGet } from '@/lib/supabase';

type UseTodayEntryOptions = {
  /** Skip the query (e.g. when Supabase env isn't configured yet). */
  enabled?: boolean;
};

export function useTodayEntry(date: string, options: UseTodayEntryOptions = {}) {
  return useQuery<TodayEntrySnapshot>({
    queryKey: ['journal', 'today', date],
    queryFn: async () => {
      const { page, bodyMarkdown } = await invokeNotionTodayGet({ date });
      return notionPageToSnapshot(page, bodyMarkdown, date);
    },
    enabled: options.enabled ?? true,
  });
}

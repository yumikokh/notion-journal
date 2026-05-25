import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { TodayEntrySnapshot } from '@/features/notion/types';
import { invokeNotionCoverRemove, type MonthEntry } from '@/lib/supabase';

type RemoveInput = {
  notionPageId: string;
  /** Date key (YYYY-MM-DD) for cache updates. */
  date: string;
};

/**
 * Clear `coverUrl` on the today snapshot for `date` if it exists.
 * Pure for testability — the hook below wires it to TanStack Query.
 */
export function clearTodayCover(
  prev: TodayEntrySnapshot | undefined,
): TodayEntrySnapshot | undefined {
  if (!prev) return prev;
  return { ...prev, coverUrl: null };
}

/**
 * Clear `coverUrl` on the matching month entry while leaving siblings
 * untouched. Returns the same reference when nothing changes so TanStack
 * Query can short-circuit re-renders.
 */
export function clearMonthCover(
  prev: MonthEntry[] | undefined,
  date: string,
): MonthEntry[] | undefined {
  if (!prev) return prev;
  let changed = false;
  const next = prev.map((e) => {
    if (e.date !== date || e.coverUrl === null) return e;
    changed = true;
    return { ...e, coverUrl: null };
  });
  return changed ? next : prev;
}

/**
 * Remove the cover image from a Notion page (PATCH cover: null) and
 * optimistically clear it from the today + month caches so the UI updates
 * immediately.
 */
export function useRemoveCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ notionPageId }: RemoveInput) => {
      return invokeNotionCoverRemove({ notionPageId });
    },
    onSuccess: (_data, variables) => {
      const { date } = variables;
      qc.setQueryData<TodayEntrySnapshot>(['journal', 'today', date], clearTodayCover);
      const yearMonth = date.slice(0, 7);
      qc.setQueryData<MonthEntry[]>(['journal', 'month', yearMonth], (prev) =>
        clearMonthCover(prev, date),
      );
    },
  });
}

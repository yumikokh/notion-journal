import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Feeling, HabitKey } from '@/features/journal/draft';
import { feelingOnlyNotionUpdate, habitsOnlyNotionUpdate } from '@/features/notion/mapping';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import { invokeNotionTodaySave } from '@/lib/supabase';

/**
 * One-tap "today state" mutations for the きろく surface: feeling and
 * habit checkboxes. Each sends only its own properties (never the whole
 * snapshot) so quick taps can't clobber edits made elsewhere, updates the
 * today cache optimistically, and refreshes the month cache the calendar
 * cells read from.
 */
export function useQuickState(date: string) {
  const queryClient = useQueryClient();
  const queryKey = ['journal', 'today', date];

  const patchCache = (patch: (prev: TodayEntrySnapshot) => TodayEntrySnapshot) => {
    const previous = queryClient.getQueryData<TodayEntrySnapshot>(queryKey);
    if (previous) queryClient.setQueryData(queryKey, patch(previous));
    return previous;
  };

  const finish = (notionPageId: string) => {
    patchCache((prev) => ({ ...prev, notionPageId }));
    queryClient.invalidateQueries({ queryKey: ['journal', 'month', date.slice(0, 7)] });
  };

  const setFeeling = useMutation({
    mutationFn: async ({
      feeling,
      notionPageId,
    }: {
      feeling: Feeling | null;
      notionPageId: string | null;
    }) => {
      return invokeNotionTodaySave({
        notionPageId,
        date,
        ...feelingOnlyNotionUpdate(feeling),
      });
    },
    onMutate: async ({ feeling }) => {
      await queryClient.cancelQueries({ queryKey });
      return { previous: patchCache((prev) => ({ ...prev, feeling })) };
    },
    onError: (_err, _args, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (saved) => finish(saved.notionPageId),
  });

  const toggleHabit = useMutation({
    mutationFn: async ({
      habits,
      notionPageId,
    }: {
      habits: TodayEntrySnapshot['habits'];
      notionPageId: string | null;
    }) => {
      return invokeNotionTodaySave({
        notionPageId,
        date,
        ...habitsOnlyNotionUpdate(habits),
      });
    },
    onMutate: async ({ habits }) => {
      await queryClient.cancelQueries({ queryKey });
      return { previous: patchCache((prev) => ({ ...prev, habits })) };
    },
    onError: (_err, _args, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (saved) => finish(saved.notionPageId),
  });

  return { setFeeling, toggleHabit };
}

/** Next habit state after toggling one key (pure, for tests). */
export function toggledHabits(
  habits: TodayEntrySnapshot['habits'],
  key: HabitKey,
): TodayEntrySnapshot['habits'] {
  return { ...habits, [key]: !habits[key] };
}

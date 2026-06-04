import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invokeNotionWeeklySave } from '@/lib/supabase';

import { formatWeekLabel } from './week-range';
import { reflectionToNotionUpdate, type WeeklyReflection } from './weekly-reflection';

/**
 * Save a weekly reflection to the Reflection DB.
 *
 * Creates a Type=Weekly page anchored on the week's Sunday when none exists,
 * otherwise updates the four reflection fields in place. The just-saved value
 * is written straight back into the `['weekly-reflection', start, end]` cache
 * so the UI reflects the save without a network round trip.
 */
export function useSaveWeeklyReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reflection: WeeklyReflection): Promise<WeeklyReflection> => {
      const { properties } = reflectionToNotionUpdate(reflection);
      const { notionPageId } = await invokeNotionWeeklySave({
        notionPageId: reflection.notionPageId,
        date: reflection.weekEnd, // anchor a new page on the week's Sunday
        name: formatWeekLabel({ start: reflection.weekStart, end: reflection.weekEnd }),
        properties,
      });
      return {
        ...reflection,
        notionPageId,
        // A newly created page is anchored on the week end; an existing page
        // keeps whatever Date the user set.
        date: reflection.date ?? reflection.weekEnd,
      };
    },
    onSuccess: (saved) => {
      qc.setQueryData<WeeklyReflection>(
        ['weekly-reflection', saved.weekStart, saved.weekEnd],
        saved,
      );
    },
  });
}

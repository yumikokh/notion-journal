import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isValidAIOutput } from '@/features/journal/ai-prompt';
import { diaryOnlyNotionUpdate } from '@/features/notion/mapping';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import { loadCustomPrompt } from '@/features/settings/prompt-storage';
import { invokeAiStructure, invokeNotionTodaySave } from '@/lib/supabase';

type SummarizeArgs = {
  bodyMarkdown: string;
  notionPageId: string | null;
  /** That day's calendar events, pre-formatted as markdown (optional). */
  calendarContext?: string;
};

/**
 * One-tap「まとめる」: run the day's accumulated body through the AI
 * summarizer and save the result straight into the DIARY property —
 * no drawer round-trip. Only DIARY is written, so feeling/habits edited
 * elsewhere are never clobbered.
 */
export function useSummarizeDay(date: string) {
  const queryClient = useQueryClient();
  const queryKey = ['journal', 'today', date];

  return useMutation({
    mutationFn: async ({ bodyMarkdown, notionPageId, calendarContext }: SummarizeArgs) => {
      const systemPrompt = (await loadCustomPrompt()) ?? undefined;
      const result = await invokeAiStructure({
        bodyText: bodyMarkdown,
        systemPrompt,
        calendarContext,
      });
      if (!isValidAIOutput(result)) {
        throw new Error('AI returned an invalid output shape');
      }
      const diary = result.diary.trim();
      const { notionPageId: pageId } = await invokeNotionTodaySave({
        notionPageId,
        date,
        ...diaryOnlyNotionUpdate(diary),
      });
      return { diary, notionPageId: pageId };
    },
    onSuccess: (saved) => {
      const current = queryClient.getQueryData<TodayEntrySnapshot>(queryKey);
      if (current) {
        queryClient.setQueryData<TodayEntrySnapshot>(queryKey, {
          ...current,
          diary: saved.diary,
          notionPageId: saved.notionPageId,
        });
      }
      // The diary text also shows on calendar cells / the month list.
      queryClient.invalidateQueries({ queryKey: ['journal', 'month', date.slice(0, 7)] });
    },
  });
}

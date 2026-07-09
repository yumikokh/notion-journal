import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { TodayEntrySnapshot } from '@/features/notion/types';
import { invokeNotionTodayAppend } from '@/lib/supabase';

import { buildLogLine } from './today-log';

type AppendArgs = {
  timeLabel: string;
  text: string;
};

/**
 * Append one quick-capture fragment to the day's page body.
 *
 * Optimistic: the log line lands in the `['journal','today',date]` cache
 * immediately (capture must feel instant), then the server's post-append
 * body replaces it on success so client and Notion stay byte-identical —
 * that also keeps the day drawer's conflict detection happy.
 */
export function useAppendLog(date: string) {
  const queryClient = useQueryClient();
  const queryKey = ['journal', 'today', date];

  return useMutation({
    mutationFn: async ({ timeLabel, text }: AppendArgs) => {
      return invokeNotionTodayAppend({ date, timeLabel, text });
    },
    onMutate: async ({ timeLabel, text }: AppendArgs) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TodayEntrySnapshot>(queryKey);
      if (previous) {
        const trimmed = previous.bodyMarkdown.replace(/\s+$/, '');
        const line = buildLogLine(timeLabel, text);
        queryClient.setQueryData<TodayEntrySnapshot>(queryKey, {
          ...previous,
          bodyMarkdown: trimmed.length > 0 ? `${trimmed}\n\n${line}` : line,
        });
      }
      return { previous };
    },
    onError: (_err, _args, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (saved) => {
      const current = queryClient.getQueryData<TodayEntrySnapshot>(queryKey);
      if (current) {
        queryClient.setQueryData<TodayEntrySnapshot>(queryKey, {
          ...current,
          notionPageId: saved.notionPageId,
          bodyMarkdown: saved.bodyMarkdown,
        });
      }
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invokeNotionWeeklyGet, invokeNotionWeeklySave } from '@/lib/supabase';

import { formatWeekLabel, type WeekRange } from './week-range';
import type { WeeklyAnalysis } from './weekly-analysis';
import {
  weeklyAnalysisToMarkdown,
  weeklyAnalysisToReflectionFields,
} from './weekly-analysis-notion';
import {
  notionPageToWeeklyReflection,
  reflectionToNotionUpdate,
  type WeeklyReflection,
} from './weekly-reflection';

type SaveArgs = { analysis: WeeklyAnalysis; dailyCount: number; calendarEventCount: number };

/**
 * Persist an AI weekly analysis to the Notion Reflection DB (issue #16).
 *
 * The AI analysis lives only in the React Query cache and is dropped on app
 * restart; this writes it to Notion so it survives. The week's existing page
 * is resolved first (range match) so re-saving the same week updates in place
 * instead of creating a duplicate. KPT/focus go to the four properties; the
 * full analysis (incl. summary + patterns) goes to the page body as markdown.
 */
export function useSaveWeeklyAnalysis(range: WeekRange) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      analysis,
      dailyCount,
      calendarEventCount,
    }: SaveArgs): Promise<WeeklyReflection> => {
      const { page, bodyMarkdown: existingBody } = await invokeNotionWeeklyGet({
        weekStart: range.start,
        weekEnd: range.end,
      });
      // `bodyMarkdown` is optional on the response type only so the client
      // keeps working against an older `notion-weekly-get` deployment.
      const existing = notionPageToWeeklyReflection(
        page,
        range.start,
        range.end,
        existingBody ?? '',
      );
      const next: WeeklyReflection = { ...existing, ...weeklyAnalysisToReflectionFields(analysis) };
      const { properties } = reflectionToNotionUpdate(next);
      const bodyMarkdown = weeklyAnalysisToMarkdown(analysis, dailyCount, calendarEventCount);

      const { notionPageId } = await invokeNotionWeeklySave({
        notionPageId: existing.notionPageId,
        date: range.end, // anchor a new page on the week's Sunday
        name: formatWeekLabel(range),
        properties,
        bodyMarkdown,
      });

      // Reflect the just-saved body in the returned reflection so the cache
      // (and the saved-reflection view) shows it without a round trip.
      return { ...next, notionPageId, date: existing.date ?? range.end, bodyMarkdown };
    },
    onSuccess: (saved) => {
      // Keep the reflection cache in sync so a future read paints the saved
      // KPT fields without a round trip.
      qc.setQueryData<WeeklyReflection>(
        ['weekly-reflection', saved.weekStart, saved.weekEnd],
        saved,
      );
      // The week picker's reflected marks come from the list query.
      qc.invalidateQueries({ queryKey: ['weekly-reflection', 'list'] });
    },
  });
}

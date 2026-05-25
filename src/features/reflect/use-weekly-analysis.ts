import { useQuery } from '@tanstack/react-query';

import { invokeAiWeeklyAnalyze } from '@/lib/supabase';

import { isWeeklyAnalysisResponse, type WeeklyAnalysisResponse } from './weekly-analysis';
import type { WeekRange } from './week-range';

/**
 * Fetch the weekly AI analysis for a given range.
 *
 * The query is gated by `enabled` so it only fires after the user taps
 * "分析する". Once cached for a week, switching to that week shows the
 * result instantly with no re-fetch — `staleTime: Infinity` plus the
 * weekStart/weekEnd queryKey makes each analyzed week immutable in cache.
 * The user can re-generate via `refetch()` (issue #26).
 *
 * No persistence: results live in the in-memory React Query cache only
 * and are dropped on app restart (per CLAUDE.md & DATA_MODEL.md).
 */
export function useWeeklyAnalysis(range: WeekRange, enabled: boolean) {
  return useQuery<WeeklyAnalysisResponse>({
    queryKey: ['weekly-analysis', range.start, range.end],
    queryFn: async () => {
      const result = await invokeAiWeeklyAnalyze({
        weekStart: range.start,
        weekEnd: range.end,
      });
      if (!isWeeklyAnalysisResponse(result)) {
        throw new Error('AI returned an invalid weekly analysis shape');
      }
      return result;
    },
    enabled,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // keep results for an hour after the screen unmounts
    retry: false, // analysis is expensive; surface failures immediately
  });
}

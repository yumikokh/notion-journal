/**
 * Shape returned by the `ai-weekly-analyze` Edge Function.
 *
 * The function asks Claude for JSON-only output and validates the shape
 * server-side, but client code re-validates before rendering so a single
 * malformed AI response can't crash the screen.
 */

export type WeeklyAnalysisKpt = {
  keep: string[];
  problem: string[];
  try: string[];
};

export type WeeklyAnalysis = {
  summary: string;
  patterns: string[];
  kpt: WeeklyAnalysisKpt;
  nextFocus: string[];
};

export type WeeklyAnalysisResponse = {
  analysis: WeeklyAnalysis;
  source: {
    dailyCount: number;
    /**
     * Count of Google Calendar events folded into the prompt. 0 when
     * the user hasn't connected Google Calendar (or the fetch
     * gracefully degraded).
     */
    calendarEventCount: number;
  };
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function isWeeklyAnalysis(v: unknown): v is WeeklyAnalysis {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.summary !== 'string' || o.summary.trim().length === 0) return false;
  if (!isStringArray(o.patterns)) return false;
  if (!isStringArray(o.nextFocus)) return false;
  const kpt = o.kpt as Record<string, unknown> | undefined;
  if (!kpt || typeof kpt !== 'object') return false;
  return isStringArray(kpt.keep) && isStringArray(kpt.problem) && isStringArray(kpt.try);
}

export function isWeeklyAnalysisResponse(v: unknown): v is WeeklyAnalysisResponse {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!isWeeklyAnalysis(o.analysis)) return false;
  const source = o.source as
    | { dailyCount?: unknown; calendarEventCount?: unknown }
    | undefined;
  if (!source) return false;
  if (typeof source.dailyCount !== 'number') return false;
  if (typeof source.calendarEventCount !== 'number') return false;
  return true;
}

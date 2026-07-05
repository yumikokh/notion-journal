/**
 * Persist an AI weekly analysis (the #26 `WeeklyAnalysis` shape) into the
 * Notion "↩️ Reflection DB" so it survives an app restart (issue #16).
 *
 * The analysis has six logical sections but the Reflection DB only exposes
 * four rich_text properties, so the data is split two ways:
 *   - KPT lists + next focus map onto the four properties for an
 *     at-a-glance, queryable summary (reusing the #14 field mapping).
 *   - The full analysis — including `summary` and `patterns`, which have no
 *     property home — is written to the page BODY as markdown so the exact
 *     on-screen format is preserved for a human reading it in Notion.
 */

import type { WeeklyAnalysis } from './weekly-analysis';
import type { WeeklyReflection } from './weekly-reflection';

/** Markdown bullet list; mirrors AnalysisResult's （該当なし） empty state. */
function bullets(items: string[]): string {
  if (items.length === 0) return '（該当なし）';
  return items.map((item) => `- ${item}`).join('\n');
}

/**
 * Render the analysis as page-body markdown, mirroring the on-screen
 * sections (サマリー / 気付き・パターン / KPT / 来週のフォーカス). The summary
 * subtitle mirrors AnalysisResult: it notes the calendar event count too when
 * the analysis drew on calendar data.
 */
export function weeklyAnalysisToMarkdown(
  analysis: WeeklyAnalysis,
  dailyCount: number,
  calendarEventCount: number,
): string {
  const { summary, patterns, kpt, nextFocus } = analysis;
  const subtitle =
    calendarEventCount > 0
      ? `${dailyCount}日分のジャーナル + 予定 ${calendarEventCount} 件から`
      : `${dailyCount}日分のジャーナルから`;
  return [
    '## サマリー',
    `_${subtitle}_`,
    '',
    summary,
    '',
    '## 気付き・パターン',
    bullets(patterns),
    '',
    '## KPT',
    '**Keep**',
    bullets(kpt.keep),
    '',
    '**Problem**',
    bullets(kpt.problem),
    '',
    '**Try**',
    bullets(kpt.try),
    '',
    '## 来週のフォーカス',
    bullets(nextFocus),
  ].join('\n');
}

/**
 * Map the analysis onto the four Reflection rich_text fields. `summary` and
 * `patterns` intentionally have no field here — they live only in the body.
 * Each list is newline-joined into a single rich_text value; an empty list
 * yields '' so the property mapper clears that cell.
 */
export function weeklyAnalysisToReflectionFields(
  analysis: WeeklyAnalysis,
): Pick<WeeklyReflection, 'good' | 'problem' | 'tryNext' | 'nextGoal'> {
  return {
    good: analysis.kpt.keep.join('\n'),
    problem: analysis.kpt.problem.join('\n'),
    tryNext: analysis.kpt.try.join('\n'),
    nextGoal: analysis.nextFocus.join('\n'),
  };
}

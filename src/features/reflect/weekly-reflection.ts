/**
 * App-side type + mapping for a weekly reflection stored in the Notion
 * "↩️ Reflection DB" — a KPT-style retrospective DB shared by Weekly and
 * Monthly entries through its `Type` select.
 *
 * Notion property → app field:
 *   よかったこと (rich_text)    → good      (Keep)
 *   よくなかったこと (rich_text) → problem   (Problem)
 *   トライできること (rich_text) → tryNext   (Try)
 *   次の具体目標 (rich_text)    → nextGoal  (Next focus)
 *   Date (date)                → date
 *   Type (select: "Weekly")    → fixed; this app reads/writes Weekly only
 *   Name (title)               → page title (set to the week label on create)
 *
 * 充電/放電ログは Daily 本文（Moment / 自由記述）の役割なので、この型には
 * 含めない。Weekly は分析的なふりかえりに専念する。
 */

import type { NotionPage, NotionRichText } from '@/features/notion/types';

/** Notion column name for each app field. Single source of truth. */
export const REFLECTION_PROPERTY_NAMES = {
  name: 'Name',
  date: 'Date',
  type: 'Type',
  good: 'よかったこと',
  problem: 'よくなかったこと',
  tryNext: 'トライできること',
  nextGoal: '次の具体目標',
} as const;

/** The `Type` select value this app reads and writes. */
export const REFLECTION_TYPE_WEEKLY = 'Weekly';

export type WeeklyReflection = {
  /** null when no Weekly page exists for the week yet. */
  notionPageId: string | null;
  /** Monday of the week, YYYY-MM-DD (range start used for the query). */
  weekStart: string;
  /** Sunday of the week, YYYY-MM-DD (range end, inclusive). */
  weekEnd: string;
  /** Actual `Date` on the Notion page; null when no page exists yet. */
  date: string | null;
  good: string; // よかったこと
  problem: string; // よくなかったこと
  tryNext: string; // トライできること
  nextGoal: string; // 次の具体目標
  /**
   * The Notion page body as markdown (the full saved AI analysis). This is the
   * source of truth the app renders, so edits made directly in Notion show up.
   * Empty when no page exists or the page has no body.
   */
  bodyMarkdown: string;
};

function richTextToString(rt: NotionRichText[] | undefined): string {
  if (!rt || rt.length === 0) return '';
  return rt.map((r) => r.plain_text).join('');
}

function richTextPayload(text: string): { rich_text: { text: { content: string } }[] } {
  return { rich_text: text ? [{ text: { content: text } }] : [] };
}

/** Empty reflection used when no Notion page exists for the week yet. */
export function emptyWeeklyReflection(weekStart: string, weekEnd: string): WeeklyReflection {
  return {
    notionPageId: null,
    weekStart,
    weekEnd,
    date: null,
    good: '',
    problem: '',
    tryNext: '',
    nextGoal: '',
    bodyMarkdown: '',
  };
}

/**
 * Convert a Notion Reflection page (its rich_text properties) to the
 * app-side weekly reflection. Returns an empty reflection if `page` is null.
 */
export function notionPageToWeeklyReflection(
  page: NotionPage | null,
  weekStart: string,
  weekEnd: string,
  bodyMarkdown = '',
): WeeklyReflection {
  if (!page) return emptyWeeklyReflection(weekStart, weekEnd);

  const props = page.properties;
  const readText = (key: string): string => {
    const prop = props[key];
    return prop?.type === 'rich_text' ? richTextToString(prop.rich_text) : '';
  };
  const dateProp = props[REFLECTION_PROPERTY_NAMES.date];
  const date = dateProp?.type === 'date' ? dateProp.date?.start ?? null : null;

  return {
    notionPageId: page.id,
    weekStart,
    weekEnd,
    date,
    good: readText(REFLECTION_PROPERTY_NAMES.good),
    problem: readText(REFLECTION_PROPERTY_NAMES.problem),
    tryNext: readText(REFLECTION_PROPERTY_NAMES.tryNext),
    nextGoal: readText(REFLECTION_PROPERTY_NAMES.nextGoal),
    bodyMarkdown,
  };
}

export type NotionReflectionUpdate = { properties: Record<string, unknown> };

/**
 * Build the Notion property payload for the four reflection fields.
 * Name/Date/Type are owned by the Edge Function (set on create, left alone
 * on update), so they are intentionally not included here. A blank field
 * maps to an empty rich_text array, which clears the cell in Notion.
 */
export function reflectionToNotionUpdate(r: WeeklyReflection): NotionReflectionUpdate {
  return {
    properties: {
      [REFLECTION_PROPERTY_NAMES.good]: richTextPayload(r.good),
      [REFLECTION_PROPERTY_NAMES.problem]: richTextPayload(r.problem),
      [REFLECTION_PROPERTY_NAMES.tryNext]: richTextPayload(r.tryNext),
      [REFLECTION_PROPERTY_NAMES.nextGoal]: richTextPayload(r.nextGoal),
    },
  };
}

/**
 * True when a Weekly page exists in Notion for this week AND it carries at
 * least one non-empty reflection field. Used by the Reflect screen to show
 * the saved reflection (and skip a wasted re-analysis) when reopening a week.
 */
export function hasSavedReflection(r: WeeklyReflection): boolean {
  return (
    r.notionPageId !== null &&
    (r.bodyMarkdown.trim() !== '' ||
      r.good !== '' ||
      r.problem !== '' ||
      r.tryNext !== '' ||
      r.nextGoal !== '')
  );
}

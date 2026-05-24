/**
 * Today screen draft state.
 *
 * Schema:
 *   freeText — Notion page body (Markdown). Manually saved by the user.
 *   feeling  — select (auto-saved with properties)
 *   diary    — single rich_text property: AI-extracted structured diary
 *              (was 4 separate Plus/Highlight/Minus/Next; collapsed into one)
 *   habits   — 5 checkbox properties (auto-saved with properties)
 *
 * The Today screen is conceptually an editor for today's Notion 2026/Daily
 * entry: on mount it loads the existing entry; structured field edits
 * debounce-save to Notion; body edits are saved only when the user clicks
 * the body-save button (with conflict detection).
 */

import type { TodayEntrySnapshot } from '@/features/notion/types';

export const FEELINGS = ['(^^)', '(˙-˙)', '(- -)', '(TT)', '(`A´)'] as const;
export type Feeling = (typeof FEELINGS)[number];

/**
 * Habits ordered as they appear in the Notion Daily DB.
 *
 * `icon` is an emoji chosen on the app side to match the property name —
 * Notion checkbox properties have no native icon field, so we infer one
 * from the label. Used in the calendar to mark days that have the habit
 * checked, when the user enables habit overlay.
 */
export const HABITS = [
  { key: 'output', label: 'Output', icon: '✍️' },
  { key: 'book', label: 'Book', icon: '📚' },
  { key: 'design', label: 'Design', icon: '🎨' },
  { key: 'english', label: 'English', icon: '🗽' },
  { key: 'exercise', label: 'Exercise', icon: '🏃' },
] as const;
export type HabitKey = (typeof HABITS)[number]['key'];

export const HABIT_KEYS = HABITS.map((h) => h.key) as readonly HabitKey[];
export const HABIT_ICONS: Record<HabitKey, string> = Object.fromEntries(
  HABITS.map((h) => [h.key, h.icon]),
) as Record<HabitKey, string>;

/** Structured (= property-level) fields, the slice we auto-save. */
export type StructuredFields = {
  feeling: Feeling | null;
  diary: string;
  habits: Record<HabitKey, boolean>;
};

export type JournalDraft = StructuredFields & {
  freeText: string;
};

export const EMPTY_DRAFT: JournalDraft = {
  freeText: '',
  feeling: null,
  diary: '',
  habits: {
    output: false,
    book: false,
    design: false,
    english: false,
    exercise: false,
  },
};

export type DraftAction =
  | { type: 'set-free-text'; value: string }
  | { type: 'set-feeling'; value: Feeling | null }
  | { type: 'set-diary'; value: string }
  | { type: 'toggle-habit'; key: HabitKey }
  | { type: 'apply-ai'; diary: string }
  | { type: 'init'; from: TodayEntrySnapshot };

/** User-driven actions only — `init` is dispatched internally on Notion load. */
export type UserDraftAction = Exclude<DraftAction, { type: 'init' }>;

export function draftReducer(state: JournalDraft, action: DraftAction): JournalDraft {
  switch (action.type) {
    case 'set-free-text':
      return { ...state, freeText: action.value };
    case 'set-feeling':
      return { ...state, feeling: action.value };
    case 'set-diary':
      return { ...state, diary: action.value };
    case 'toggle-habit':
      return {
        ...state,
        habits: { ...state.habits, [action.key]: !state.habits[action.key] },
      };
    case 'apply-ai':
      return { ...state, diary: action.diary };
    case 'init':
      return snapshotToDraft(action.from);
  }
}

/**
 * Whether the in-memory draft differs from the last-known Notion state.
 *
 * - `serverSnap`: the snapshot most recently loaded from Notion (or `null`
 *   when the page doesn't yet exist).
 * - `lastSyncedBody`: the body markdown as last persisted; preferred over
 *   `serverSnap.bodyMarkdown` so a successful save updates the baseline
 *   without re-fetching.
 * - `pendingCover`: `true` when the user has picked a cover photo that
 *   hasn't been uploaded yet.
 *
 * Returns `true` if ANY field would need to be sent to Notion.
 */
export function isDraftDirty(
  draft: JournalDraft,
  serverSnap: TodayEntrySnapshot | null,
  lastSyncedBody: string | null,
  pendingCover: boolean,
): boolean {
  if (pendingCover) return true;
  if (!serverSnap) {
    if (draft.freeText.trim().length > 0) return true;
    if (draft.feeling) return true;
    if (draft.diary.trim().length > 0) return true;
    for (const { key } of HABITS) if (draft.habits[key]) return true;
    return false;
  }
  if (draft.freeText !== (lastSyncedBody ?? serverSnap.bodyMarkdown)) return true;
  if (draft.feeling !== serverSnap.feeling) return true;
  if (draft.diary !== serverSnap.diary) return true;
  for (const { key } of HABITS) {
    if (draft.habits[key] !== serverSnap.habits[key]) return true;
  }
  return false;
}

/** Project a Notion snapshot down to the editable draft fields. */
export function snapshotToDraft(snap: TodayEntrySnapshot): JournalDraft {
  return {
    freeText: snap.bodyMarkdown,
    feeling: snap.feeling,
    diary: snap.diary,
    habits: snap.habits,
  };
}

/** Merge editable draft back onto a base snapshot, preserving non-draft fields. */
export function draftToSnapshot(
  draft: JournalDraft,
  base: TodayEntrySnapshot,
): TodayEntrySnapshot {
  return {
    notionPageId: base.notionPageId,
    date: base.date,
    feeling: draft.feeling,
    feelingColor: draft.feeling === base.feeling ? base.feelingColor : null,
    icon: base.icon,
    diary: draft.diary,
    habits: draft.habits,
    tracked: base.tracked,
    bodyMarkdown: draft.freeText,
    coverUrl: base.coverUrl,
  };
}

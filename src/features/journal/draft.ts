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

export const HABITS = [
  { key: 'output', label: 'Output' },
  { key: 'book', label: 'Book' },
  { key: 'design', label: 'Design' },
  { key: 'english', label: 'English' },
  { key: 'exercise', label: 'Exercise' },
] as const;
export type HabitKey = (typeof HABITS)[number]['key'];

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

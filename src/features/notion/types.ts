/**
 * App-side type for today's Notion daily entry (DB: 2026/Daily).
 *
 * Notion property → app field (actual DB schema):
 *   Feeling (select)              → feeling
 *   Diary (rich_text)             → diary  (was "Highlight", renamed)
 *   Tracked (rich_text)           → tracked   ※Toggl 自動同期、書き込みしない
 *   Output / Book / Design /
 *     English / Exercise (checkbox) → habits[*]
 *   Date (date)                   → date
 *   Page body blocks              → bodyMarkdown
 *
 * Plus / Minus / Next properties are intentionally omitted — the schema
 * collapsed to a single Diary field.
 */

import type { Feeling, HabitKey } from '@/features/journal/draft';
import type { MonthEntryIcon, NotionSelectColor } from '@/lib/supabase';

export type TodayEntrySnapshot = {
  notionPageId: string | null; // null when no entry exists for the date yet
  date: string; // YYYY-MM-DD
  feeling: Feeling | null;
  /** Notion select color for the current feeling; null when no feeling set. */
  feelingColor: NotionSelectColor | null;
  /** Page icon as set in Notion (emoji or URL); null when unset. */
  icon: MonthEntryIcon | null;
  diary: string;
  habits: Record<HabitKey, boolean>;
  tracked: string;
  bodyMarkdown: string; // free-form body (murmur, etc.)
  coverUrl: string | null; // page cover image URL (Notion-hosted or external)
};

/**
 * Minimal Notion API page shape we actually read. Defined locally so we
 * don't pull the official `@notionhq/client` types onto the device bundle.
 */
export type NotionRichText = { plain_text: string };

export type NotionProperty =
  | { type: 'title'; title: NotionRichText[] }
  | { type: 'rich_text'; rich_text: NotionRichText[] }
  | { type: 'select'; select: { name: string; color?: NotionSelectColor } | null }
  | { type: 'checkbox'; checkbox: boolean }
  | { type: 'date'; date: { start: string } | null };

/** Notion page icon shape — emoji or URL. */
export type NotionIcon =
  | { type: 'emoji'; emoji: string }
  | { type: 'external'; external: { url: string } }
  | { type: 'file'; file: { url: string } };

/** Notion cover shape — varies by how the image was attached. */
export type NotionCover =
  | { type: 'external'; external: { url: string } }
  | { type: 'file'; file: { url: string; expiry_time?: string } }
  | { type: 'file_upload'; file_upload: { id: string; url?: string } };

export type NotionPage = {
  id: string;
  properties: Record<string, NotionProperty>;
  cover?: NotionCover | null;
  icon?: NotionIcon | null;
};

/** Notion column name for each app field. Single source of truth. */
export const PROPERTY_NAMES = {
  feeling: 'Feeling',
  diary: 'Diary',
  tracked: 'Tracked',
  output: 'Output',
  book: 'Book',
  design: 'Design',
  english: 'English',
  exercise: 'Exercise',
} as const;

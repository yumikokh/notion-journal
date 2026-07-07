import { FEELINGS, type Feeling } from '@/features/journal/draft';
import type { MonthEntryIcon } from '@/lib/supabase';

import {
  PROPERTY_NAMES,
  type NotionIcon,
  type NotionPage,
  type NotionRichText,
  type TodayEntrySnapshot,
} from './types';

function extractCoverUrl(page: NotionPage): string | null {
  const cover = page.cover;
  if (!cover) return null;
  if (cover.type === 'external') return cover.external.url;
  if (cover.type === 'file') return cover.file.url;
  if (cover.type === 'file_upload') return cover.file_upload.url ?? null;
  return null;
}

function extractIcon(icon: NotionIcon | null | undefined): MonthEntryIcon | null {
  if (!icon) return null;
  if (icon.type === 'emoji') return { type: 'emoji', emoji: icon.emoji };
  if (icon.type === 'external') return { type: 'external', url: icon.external.url };
  if (icon.type === 'file') return { type: 'external', url: icon.file.url };
  return null;
}

function richTextToString(rt: NotionRichText[] | undefined): string {
  if (!rt || rt.length === 0) return '';
  return rt.map((r) => r.plain_text).join('');
}

function isFeeling(value: string | undefined | null): value is Feeling {
  return typeof value === 'string' && (FEELINGS as readonly string[]).includes(value);
}

/** Empty snapshot used when no Notion page exists for the date yet. */
export function emptySnapshot(date: string): TodayEntrySnapshot {
  return {
    notionPageId: null,
    date,
    feeling: null,
    feelingColor: null,
    icon: null,
    diary: '',
    habits: {
      output: false,
      book: false,
      design: false,
      english: false,
      exercise: false,
    },
    tracked: '',
    bodyMarkdown: '',
    coverUrl: null,
  };
}

/**
 * Convert a Notion page (its properties + accumulated body markdown) to the
 * app-side snapshot. Returns an empty snapshot if `page` is null.
 */
export function notionPageToSnapshot(
  page: NotionPage | null,
  bodyMarkdown: string,
  date: string,
): TodayEntrySnapshot {
  if (!page) return emptySnapshot(date);

  const props = page.properties;
  const feelingProp = props[PROPERTY_NAMES.feeling];
  const feelingName = feelingProp?.type === 'select' ? feelingProp.select?.name : undefined;
  const feelingColor =
    feelingProp?.type === 'select' ? feelingProp.select?.color ?? null : null;

  const readText = (key: string): string => {
    const prop = props[key];
    return prop?.type === 'rich_text' ? richTextToString(prop.rich_text) : '';
  };
  const readCheckbox = (key: string): boolean => {
    const prop = props[key];
    return prop?.type === 'checkbox' ? prop.checkbox : false;
  };

  return {
    notionPageId: page.id,
    date,
    feeling: isFeeling(feelingName) ? feelingName : null,
    feelingColor: isFeeling(feelingName) ? feelingColor : null,
    icon: extractIcon(page.icon),
    diary: readText(PROPERTY_NAMES.diary),
    habits: {
      output: readCheckbox(PROPERTY_NAMES.output),
      book: readCheckbox(PROPERTY_NAMES.book),
      design: readCheckbox(PROPERTY_NAMES.design),
      english: readCheckbox(PROPERTY_NAMES.english),
      exercise: readCheckbox(PROPERTY_NAMES.exercise),
    },
    tracked: readText(PROPERTY_NAMES.tracked),
    bodyMarkdown,
    coverUrl: extractCoverUrl(page),
  };
}

/** Property payload for `PATCH /v1/pages/{id}` or `POST /v1/pages`. */
export type NotionUpdatePayload = {
  properties: Record<string, unknown>;
};

function richTextPayload(text: string): { rich_text: { text: { content: string } }[] } {
  return { rich_text: text ? [{ text: { content: text } }] : [] };
}

/**
 * Property payload that updates only DIARY — used by the one-tap
 * summarize, which must not clobber feeling/habits that may have
 * changed elsewhere since the snapshot was loaded.
 */
export function diaryOnlyNotionUpdate(diary: string): NotionUpdatePayload {
  return { properties: { [PROPERTY_NAMES.diary]: richTextPayload(diary) } };
}

/** Property payload that updates only the feeling (きろく quick state). */
export function feelingOnlyNotionUpdate(feeling: Feeling | null): NotionUpdatePayload {
  return {
    properties: {
      [PROPERTY_NAMES.feeling]: feeling ? { select: { name: feeling } } : { select: null },
    },
  };
}

/** Property payload that updates only the habit checkboxes (きろく quick state). */
export function habitsOnlyNotionUpdate(
  habits: TodayEntrySnapshot['habits'],
): NotionUpdatePayload {
  return {
    properties: {
      [PROPERTY_NAMES.output]: { checkbox: habits.output },
      [PROPERTY_NAMES.book]: { checkbox: habits.book },
      [PROPERTY_NAMES.design]: { checkbox: habits.design },
      [PROPERTY_NAMES.english]: { checkbox: habits.english },
      [PROPERTY_NAMES.exercise]: { checkbox: habits.exercise },
    },
  };
}

/**
 * Build the Notion API property payload from an app snapshot.
 * Note: `Tracked` is omitted because it is populated externally by Toggl
 * and treated as read-only by this app.
 */
export function snapshotToNotionUpdate(snap: TodayEntrySnapshot): NotionUpdatePayload {
  return {
    properties: {
      [PROPERTY_NAMES.feeling]: snap.feeling
        ? { select: { name: snap.feeling } }
        : { select: null },
      [PROPERTY_NAMES.diary]: richTextPayload(snap.diary),
      [PROPERTY_NAMES.output]: { checkbox: snap.habits.output },
      [PROPERTY_NAMES.book]: { checkbox: snap.habits.book },
      [PROPERTY_NAMES.design]: { checkbox: snap.habits.design },
      [PROPERTY_NAMES.english]: { checkbox: snap.habits.english },
      [PROPERTY_NAMES.exercise]: { checkbox: snap.habits.exercise },
      // Tracked: intentionally omitted (Toggl-managed)
    },
  };
}

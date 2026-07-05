import 'react-native-url-polyfill/auto';

import { FunctionsHttpError, createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { NotionPage } from '@/features/notion/types';

import { getSupabaseEnv } from './env';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const { url, anonKey } = getSupabaseEnv();
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
  });
  return _client;
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let detail: unknown = null;
      try {
        detail = await error.context.json();
      } catch {
        // body was not JSON
      }
      throw new Error(
        `${name} failed: ${detail != null ? JSON.stringify(detail) : error.message}`,
      );
    }
    throw new Error(`${name} failed: ${error.message}`);
  }
  if (data == null) throw new Error(`${name} returned null`);
  return data;
}

export function invokeNotionTodayGet(payload: { date: string }) {
  return invoke<{ page: NotionPage | null; bodyMarkdown: string }>('notion-today-get', payload);
}

/**
 * `notion-today-save` is split into two paths:
 *   - properties present, bodyMarkdown undefined → property-only update
 *   - bodyMarkdown present, properties undefined → body-only replacement
 *   - both present → full update (used on create)
 */
export function invokeNotionTodaySave(payload: {
  notionPageId: string | null;
  date: string;
  properties?: Record<string, unknown>;
  bodyMarkdown?: string;
  /** Previous body for targeted update; preserves non-text blocks. */
  lastSyncedBody?: string;
}) {
  return invoke<{ notionPageId: string }>('notion-today-save', payload);
}

export function invokeAiStructure(payload: {
  bodyText: string;
  systemPrompt?: string;
  /** That day's calendar events, pre-formatted as a markdown list. */
  calendarContext?: string;
}) {
  return invoke<{ diary: unknown }>('ai-structure', payload);
}

export function invokeNotionCoverUpload(payload: {
  notionPageId: string;
  base64: string;
  mimeType: string;
  filename?: string;
}) {
  return invoke<{ fileUploadId: string }>('notion-cover-upload', payload);
}

export function invokeNotionCoverRemove(payload: { notionPageId: string }) {
  return invoke<{ ok: true }>('notion-cover-remove', payload);
}

/**
 * Notion's built-in `select` palette name (e.g. 'green', 'red'). The set is
 * fixed by Notion; mapped to theme colors in `features/notion/colors.ts`.
 */
export type NotionSelectColor =
  | 'default'
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red';

export type MonthEntryIcon =
  | { type: 'emoji'; emoji: string }
  | { type: 'external'; url: string };

export type MonthEntry = {
  pageId: string;
  date: string;
  feeling: string | null;
  /** Notion select color name; null when no feeling is set. */
  feelingColor: NotionSelectColor | null;
  /** Page icon set in Notion (emoji or URL); null when unset. */
  icon: MonthEntryIcon | null;
  /**
   * Habit checkbox state by property key (output/book/design/english/exercise).
   * Lower-case keys match the app's `HabitKey`; Notion property names are
   * mapped on the server side.
   */
  habits: Record<string, boolean>;
  /** Diary rich_text property contents. Used in the month list view. */
  diary: string;
  /** Page cover URL (Notion-hosted or external); null when unset. */
  coverUrl: string | null;
};

export function invokeNotionMonthGet(payload: { yearMonth: string }) {
  return invoke<{ entries: MonthEntry[] }>('notion-month-get', payload);
}

export function invokeAiWeeklyAnalyze(payload: { weekStart: string; weekEnd: string }) {
  return invoke<unknown>('ai-weekly-analyze', payload);
}

/**
 * Read the weekly reflection (Notion "↩️ Reflection DB", Type=Weekly) for a
 * Monday→Sunday range. Returns the raw Notion page (or null); the caller maps
 * it via `notionPageToWeeklyReflection`.
 */
export function invokeNotionWeeklyGet(payload: { weekStart: string; weekEnd: string }) {
  return invoke<{ page: NotionPage | null }>('notion-weekly-get', payload);
}

/**
 * Create or update a weekly reflection. On create the server sets
 * Name/Date/Type="Weekly"; on update only `properties` are touched.
 * When `bodyMarkdown` is supplied, the page body is replaced with it
 * (used to persist the full AI weekly analysis, #16).
 */
export function invokeNotionWeeklySave(payload: {
  notionPageId: string | null;
  date: string;
  name?: string;
  properties: Record<string, unknown>;
  bodyMarkdown?: string;
}) {
  return invoke<{ notionPageId: string }>('notion-weekly-save', payload);
}

export type GoogleOAuthStatus =
  | { connected: false }
  | { connected: true; scope: string; connectedAt: string };

export function invokeGoogleOAuthStatus() {
  return invoke<GoogleOAuthStatus>('google-oauth-status', {});
}

export function invokeGoogleOAuthExchange(payload: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  return invoke<{ ok: true; scope: string }>('google-oauth-exchange', payload);
}

export function invokeGoogleOAuthDisconnect() {
  return invoke<{ ok: true }>('google-oauth-disconnect', {});
}

export type CalendarEvent = {
  start: string;
  end: string;
  summary: string;
  description?: string;
  calendarId: string;
};

export function invokeGoogleCalendarList(payload: {
  /** ISO 8601 inclusive lower bound */
  timeMin: string;
  /** ISO 8601 exclusive upper bound */
  timeMax: string;
  calendarId?: string;
}) {
  return invoke<{ events: CalendarEvent[] }>('google-calendar-list', payload);
}

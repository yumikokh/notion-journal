import { useMutation, useQueryClient } from '@tanstack/react-query';

import { rescheduleFromCache } from '@/features/notifications/reschedule-from-cache';
import { snapshotToNotionUpdate } from '@/features/notion/mapping';
import { PROPERTY_NAMES } from '@/features/notion/types';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import { invokeNotionTodaySave, type MonthEntry } from '@/lib/supabase';

type SaveInput = {
  snapshot: TodayEntrySnapshot;
  /**
   * The body markdown as previously loaded from Notion. When present
   * AND the snapshot's body differs, the Edge Function uses Notion's
   * `update_content` mode to preserve non-text blocks (images, embeds,
   * …) — these would otherwise be wiped by a full `replace_content`.
   * Pass `null` on a brand-new page (no previous body exists).
   */
  lastSyncedBody: string | null;
};

/**
 * One-shot save: pushes properties (always) and the body (only when it
 * actually changed) to Notion. When body is unchanged we skip sending it
 * at all, which leaves the page body — including any images Notion
 * stores there — completely untouched.
 */
export function useSaveAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ snapshot, lastSyncedBody }: SaveInput): Promise<TodayEntrySnapshot> => {
      const { properties } = snapshotToNotionUpdate(snapshot);

      const isNewPage = !snapshot.notionPageId;
      const bodyChanged = lastSyncedBody !== null && snapshot.bodyMarkdown !== lastSyncedBody;

      // Body is only sent when it actually needs to change. On a brand-new
      // page we send the initial body (which may be empty — fine).
      const bodyMarkdown = bodyChanged || isNewPage ? snapshot.bodyMarkdown : undefined;

      // `lastSyncedBody` flag goes through only for edits of existing pages.
      // For new pages there's nothing to diff against, so the Edge Function
      // falls back to `replace_content`.
      const lastSyncedBodyArg = bodyChanged && !isNewPage ? (lastSyncedBody ?? undefined) : undefined;

      const { notionPageId } = await invokeNotionTodaySave({
        notionPageId: snapshot.notionPageId,
        date: snapshot.date,
        properties,
        bodyMarkdown,
        lastSyncedBody: lastSyncedBodyArg,
      });
      return { ...snapshot, notionPageId };
    },
    onSuccess: (saved) => {
      qc.setQueryData<TodayEntrySnapshot>(['journal', 'today', saved.date], saved);
      // Patch the month-level cache directly from the just-saved snapshot so
      // the calendar reflects the change without a network round trip.
      // If the month entries haven't been fetched yet, leave the cache alone
      // — the next mount will fetch fresh data.
      const yearMonth = saved.date.slice(0, 7);
      qc.setQueryData<MonthEntry[]>(['journal', 'month', yearMonth], (prev) => {
        if (!prev) return prev;
        return upsertMonthEntry(prev, snapshotToMonthEntry(saved));
      });
      // Reschedule reminders so today's reminder is dropped if
      // `skipIfRecorded` is on. Fire-and-forget — the cache patch above
      // already made today visible to `rescheduleFromCache`.
      void rescheduleFromCache(qc);
    },
  });
}

/**
 * Project a TodayEntrySnapshot to the MonthEntry shape the calendar uses.
 * The server keys habits by raw Notion property name (e.g. "Output"); we
 * remap from the app-side lowercase HabitKey via PROPERTY_NAMES.
 */
export function snapshotToMonthEntry(snap: TodayEntrySnapshot): MonthEntry | null {
  if (!snap.notionPageId) return null;
  return {
    pageId: snap.notionPageId,
    date: snap.date,
    feeling: snap.feeling,
    feelingColor: snap.feelingColor,
    icon: snap.icon,
    habits: {
      [PROPERTY_NAMES.output]: snap.habits.output,
      [PROPERTY_NAMES.book]: snap.habits.book,
      [PROPERTY_NAMES.design]: snap.habits.design,
      [PROPERTY_NAMES.english]: snap.habits.english,
      [PROPERTY_NAMES.exercise]: snap.habits.exercise,
    },
    diary: snap.diary,
    coverUrl: snap.coverUrl,
  };
}

export function upsertMonthEntry(list: MonthEntry[], next: MonthEntry | null): MonthEntry[] {
  if (!next) return list;
  const idx = list.findIndex((e) => e.date === next.date);
  if (idx === -1) return [...list, next];
  const copy = list.slice();
  // Preserve any habit columns the server reported but the app doesn't model
  // (the snapshot only knows the 5 typed habits).
  copy[idx] = { ...next, habits: { ...copy[idx].habits, ...next.habits } };
  return copy;
}

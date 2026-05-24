import { useMutation, useQueryClient } from '@tanstack/react-query';

import { snapshotToNotionUpdate } from '@/features/notion/mapping';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import { invokeNotionTodaySave } from '@/lib/supabase';

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
    },
  });
}

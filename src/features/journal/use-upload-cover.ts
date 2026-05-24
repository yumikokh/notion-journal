import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { TodayEntrySnapshot } from '@/features/notion/types';
import { invokeNotionCoverUpload, type MonthEntry } from '@/lib/supabase';

type UploadInput = {
  notionPageId: string;
  date: string; // for cache invalidation
  base64: string;
  mimeType: string;
  filename?: string;
  /**
   * Local image URI from `expo-image-picker`. Used to optimistically update
   * the today + month caches so the new cover appears immediately, without
   * waiting for a Notion round trip. The canonical Notion-hosted URL replaces
   * this on the next month fetch.
   */
  uri?: string;
};

/**
 * Upload a photo as the Notion page cover image. The Edge Function
 * handles the 3-step Notion file_upload dance (create session →
 * POST bytes → PATCH page.cover) and we just hand it the base64 blob.
 */
export function useUploadCover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ notionPageId, base64, mimeType, filename }: UploadInput) => {
      return invokeNotionCoverUpload({ notionPageId, base64, mimeType, filename });
    },
    onSuccess: (_data, variables) => {
      const { date, uri } = variables;
      // Notion's upload endpoint returns only a fileUploadId — not the final
      // cover URL — so we patch the caches with the locally-picked URI for
      // instant feedback. The canonical Notion-hosted URL will arrive on the
      // next month/today fetch (e.g. when the user changes months).
      if (uri) {
        qc.setQueryData<TodayEntrySnapshot>(['journal', 'today', date], (prev) =>
          prev ? { ...prev, coverUrl: uri } : prev,
        );
        const yearMonth = date.slice(0, 7);
        qc.setQueryData<MonthEntry[]>(['journal', 'month', yearMonth], (prev) =>
          prev
            ? prev.map((e) => (e.date === date ? { ...e, coverUrl: uri } : e))
            : prev,
        );
      } else {
        // No URI provided (shouldn't happen from the drawer flow). Fall back
        // to invalidation so the canonical URL is fetched.
        qc.invalidateQueries({ queryKey: ['journal', 'today', date] });
        qc.invalidateQueries({ queryKey: ['journal', 'month', date.slice(0, 7)] });
      }
    },
  });
}

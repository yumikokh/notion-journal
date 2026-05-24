import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invokeNotionCoverUpload } from '@/lib/supabase';

type UploadInput = {
  notionPageId: string;
  date: string; // for cache invalidation
  base64: string;
  mimeType: string;
  filename?: string;
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
      // Force-refetch today's entry so the new cover URL flows into the UI.
      qc.invalidateQueries({ queryKey: ['journal', 'today', variables.date] });
    },
  });
}

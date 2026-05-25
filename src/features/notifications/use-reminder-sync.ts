import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { rescheduleFromCache } from './reschedule-from-cache';

/**
 * Mount once at the app root. Reschedules reminders:
 *   - on initial mount, and
 *   - whenever the app returns to the foreground (covers the case where
 *     the user crossed midnight or recorded entries on another device).
 *
 * Settings changes call `rescheduleFromCache` directly from the settings
 * screen, and save success from `useSaveAll.onSuccess` — this hook only
 * owns the lifecycle-driven syncs.
 */
export function useReminderSync(): void {
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      rescheduleFromCache(qc).catch(() => {
        // Best-effort: scheduling failures (denied permission, missing
        // native module on web/preview) should not surface to the user.
      });
    };

    run();

    const handler = (next: AppStateStatus) => {
      if (cancelled) return;
      if (next === 'active') run();
    };
    const sub = AppState.addEventListener('change', handler);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [qc]);
}
